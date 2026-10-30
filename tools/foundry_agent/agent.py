"""Create / refresh the BrewIQ analyst agent in Foundry.

1. Regenerates the knowledge markdown (build_knowledge.mjs).
2. Uploads it to a vector store (replacing any store with the same name).
3. Creates a new version of the prompt agent: instructions + file search.

Needs `az login` and the 'Foundry User' role on the Foundry account.
Usage: python agent.py [--ask "question"]   (--ask runs a quick test through the agent)
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
_ALL = json.loads((ROOT / "infra" / "config.json").read_text())
CFG = _ALL["foundry"]
PREFIX = _ALL.get("prefix", "")
if "--prefix" in sys.argv:
    PREFIX = sys.argv[sys.argv.index("--prefix") + 1]
CFG["name"] = PREFIX + CFG["name"]
ENDPOINT = f"https://{CFG['name']}.services.ai.azure.com/api/projects/{CFG['project']}"
STORE_NAME = "brewiq-knowledge"
AGENT_NAME = CFG.get("agent", "brewiq-analyst-agent")


SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["health", "summary", "findings", "next_check"],
    "properties": {
        "health": {"type": "string", "enum": ["good", "watch", "problem"]},
        "summary": {"type": "string"},
        "next_check": {"type": "string"},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["title", "severity", "evidence", "recommendation"],
                "properties": {
                    "title": {"type": "string"},
                    "severity": {"type": "string", "enum": ["info", "warning", "critical"]},
                    "evidence": {"type": "string"},
                    "recommendation": {"type": "string"},
                },
            },
        },
    },
}


def token() -> str:
    return subprocess.run(
        "az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv",
        capture_output=True, text=True, shell=True, check=True,
    ).stdout.strip()


def call(method, path, **kw):
    kw.setdefault("headers", {})["Authorization"] = f"Bearer {token()}"
    r = requests.request(method, f"{ENDPOINT}{path}", timeout=120, **kw)
    if not r.ok:
        sys.exit(f"{method} {path} -> {r.status_code}\n{r.text[:800]}")
    return r.json() if r.text else {}


def instructions() -> str:
    js = "import('./brewiq-app/packages/functions/dist/analyst-prompt.js').then(m=>process.stdout.write(m.AGENT_INSTRUCTIONS))"
    return subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=ROOT, check=True, encoding="utf-8").stdout


def build_vector_store() -> str:
    subprocess.run(["node", str(HERE / "build_knowledge.mjs")], check=True)
    for vs in call("GET", "/openai/v1/vector_stores").get("data", []):
        if vs["name"] == STORE_NAME:
            call("DELETE", f"/openai/v1/vector_stores/{vs['id']}")
    file_ids = []
    for f in sorted((HERE / "knowledge").glob("*.md")):
        up = call("POST", "/openai/v1/files", files={"file": (f.name, f.read_bytes(), "text/markdown")}, data={"purpose": "assistants"})
        file_ids.append(up["id"])
        print("uploaded", f.name, up["id"])
    vs = call("POST", "/openai/v1/vector_stores", json={"name": STORE_NAME, "file_ids": file_ids})
    for _ in range(60):
        vs = call("GET", f"/openai/v1/vector_stores/{vs['id']}")
        if vs["file_counts"]["in_progress"] == 0:
            break
        time.sleep(2)
    print("vector store", vs["id"], vs["file_counts"])
    return vs["id"]


def existing_store() -> str:
    return next(v["id"] for v in call("GET", "/openai/v1/vector_stores")["data"] if v["name"] == STORE_NAME)


def create_agent(store_id: str):
    body = {
        "definition": {
            "kind": "prompt",
            "model": CFG["deployment"],
            "instructions": instructions(),
            "tools": [{"type": "file_search", "vector_store_ids": [store_id]}],
            "reasoning": {"effort": "low"},
            "text": {"format": {"type": "json_schema", "name": "batch_analysis", "strict": True, "schema": SCHEMA}},
        }
    }
    v = call("POST", f"/agents/{AGENT_NAME}/versions?api-version=v1", json=body)
    print("agent", AGENT_NAME, "version", v.get("version"))


def ask(text: str):
    return _ask(text)


def _ask(text: str):
    t0 = time.time()
    r = call("POST", "/openai/v1/responses", json={"input": text, "agent_reference": {"type": "agent_reference", "name": AGENT_NAME}})
    print(f"{time.time() - t0:.1f}s")
    for o in r.get("output", []):
        if o["type"] == "message":
            print("".join(c.get("text", "") for c in o["content"]))
        else:
            print("[", o["type"], "]")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ask")
    ap.add_argument("--prefix")
    ap.add_argument("--skip-build", action="store_true")
    a = ap.parse_args()
    if a.ask == "all":
        for s in json.loads((ROOT / "tools" / "analysis_eval" / "briefs.json").read_text(encoding="utf-8")):
            print("=====", s["id"])
            ask("Analyze this batch brief. Reply with JSON only.\n" + json.dumps(s["brief"]))
    elif a.ask:
        ask(a.ask)
    else:
        create_agent(existing_store() if a.skip_build else build_vector_store())
