"""Recipe advisor prototype: a conversational Foundry agent grounded in public sources.

Knowledge = recipe library + yeast library + BJCP numeric ranges + the openly licensed
papers and Wikipedia pages fetched by fetch_sources.py (knowledge/sources/).

    python advisor.py             build vector store + publish a new agent version
    python advisor.py --skip-build   publish a new agent version only
    python advisor.py --chat      interactive chat with the advisor
    python advisor.py --ask "..." one-off question
"""
import argparse
import sys
import time

from agent import CFG, HERE, call, existing_store as _unused  # noqa: F401  (reuses auth + endpoint)

STORE_NAME = "brewiq-advisor-knowledge"
AGENT_NAME = "brewiq-advisor-agent"
KNOWLEDGE = HERE / "knowledge"
CORE_FILES = ["recipe-library.md", "yeast-library.md", "bjcp-styles.md"]

INSTRUCTIONS = """You are BrewIQ's recipe advisor, helping a homebrewer decide what to brew next.

How to behave:
- Be conversational and concise. Ask at most two short questions at a time, then move on.
- Typical things to learn: flavor direction (e.g. fruity, clovey, hoppy, malty, roasty, dry, sweet), strength, how soon they want it, season/cellar temperature they can hold, and whether they want a simple kit or a challenge. Do not interrogate; if the user gives a lot up front, skip ahead.
- Once you know enough, recommend 2 or 3 candidates. Prefer recipes from the recipe library (recipe-library.md); mention when a style is not in the library. For each candidate give: the style, the expected flavor in plain words, and the choices that most change that flavor (for example yeast, fermentation temperature, hop variety, malt) with the specific options.
- Finish by asking which direction they prefer, and offer to go deeper on yeast, temperature or hops.

Grounding rules (important):
- Use file search for every recommendation. Draw flavor claims from the knowledge files (scientific papers, Wikipedia pages, yeast library, recipe library, BJCP numeric ranges).
- Cite the source file name in brackets after claims taken from it, for example [PMC5916228] or [wikipedia-wheat-beer] or [yeast-library].
- If the files do not support a claim, say it is general brewing knowledge, or leave it out. Never invent numbers, temperatures or hop descriptors.
- Scientific papers describe tendencies, not guarantees. Phrase effects as tendencies ("warmer fermentation tends to increase esters").
- For yeast, use the manufacturer temperature range from the yeast library and point out when a recommended temperature sits at the edge of it.
- The user monitors fermentation with a sealed Tilt hydrometer and cannot take manual readings, so do not suggest manual hydrometer checks.
- Keep answers under about 250 words unless the user asks for more detail."""


def files_to_upload():
    core = [KNOWLEDGE / n for n in CORE_FILES]
    return core + sorted((KNOWLEDGE / "sources").glob("*.md"))


def build_vector_store() -> str:
    for vs in call("GET", "/openai/v1/vector_stores").get("data", []):
        if vs["name"] == STORE_NAME:
            call("DELETE", f"/openai/v1/vector_stores/{vs['id']}")
    ids = []
    for f in files_to_upload():
        up = call("POST", "/openai/v1/files", files={"file": (f.name, f.read_bytes(), "text/markdown")}, data={"purpose": "assistants"})
        ids.append(up["id"])
        print("uploaded", f.name)
    vs = call("POST", "/openai/v1/vector_stores", json={"name": STORE_NAME, "file_ids": ids})
    for _ in range(120):
        vs = call("GET", f"/openai/v1/vector_stores/{vs['id']}")
        if vs["file_counts"]["in_progress"] == 0:
            break
        time.sleep(3)
    print("vector store", vs["id"], vs["file_counts"])
    return vs["id"]


def existing_store() -> str:
    return next(v["id"] for v in call("GET", "/openai/v1/vector_stores")["data"] if v["name"] == STORE_NAME)


def create_agent(store_id: str):
    body = {
        "definition": {
            "kind": "prompt",
            "model": CFG["deployment"],
            "instructions": INSTRUCTIONS,
            "tools": [{"type": "file_search", "vector_store_ids": [store_id]}],
            "reasoning": {"effort": "low"},
        }
    }
    v = call("POST", f"/agents/{AGENT_NAME}/versions?api-version=v1", json=body)
    print("agent", AGENT_NAME, "version", v.get("version"))


def ask(text: str, previous=None):
    t0 = time.time()
    body = {"input": text, "agent_reference": {"type": "agent_reference", "name": AGENT_NAME}}
    if previous:
        body["previous_response_id"] = previous
    r = call("POST", "/openai/v1/responses", json=body)
    out = "".join(c.get("text", "") for o in r.get("output", []) if o["type"] == "message" for c in o["content"])
    print(f"\n[{time.time() - t0:.1f}s]\n{out}\n")
    return r["id"]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ask")
    ap.add_argument("--chat", action="store_true")
    ap.add_argument("--skip-build", action="store_true")
    ap.add_argument("--prefix")
    a = ap.parse_args()
    if a.chat:
        prev = None
        while True:
            q = input("you> ").strip()
            if q in ("", "exit", "quit"):
                sys.exit(0)
            prev = ask(q, prev)
    elif a.ask:
        ask(a.ask)
    else:
        create_agent(existing_store() if a.skip_build else build_vector_store())
