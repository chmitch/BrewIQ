"""Runs each brief through several Foundry deployments and records latency, tokens and output.

  python run_eval.py [deployment ...]      # default: all deployments listed in MODELS
Results are written to results.json next to this script.
"""
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib import request, error

ENDPOINT = "https://cgmbrewiq-foundry.cognitiveservices.azure.com"
API_VERSION = "2025-04-01-preview"
MODELS = [
    "gpt-4.1-mini", "bench-gpt-5.4-mini", "brewiq-analyst", "bench-gpt-5.6-sol",
    "bench-gpt-6-astra", "bench-gpt-6.1-sol", "bench-gpt-6.1-terra",
]
HERE = Path(__file__).parent

def load_prompt():
    """The production prompt (instructions + playbook), compiled from the functions package."""
    dist = (HERE / "../../brewiq-app/packages/functions/dist/analyst-prompt.js").resolve().as_uri()
    return subprocess.check_output(
        ["node", "-e", f"import(\"{dist}\").then(m=>process.stdout.write(m.ANALYST_PROMPT))"], text=True, encoding="utf-8")


SYSTEM = load_prompt()


def token():
    return subprocess.check_output(
        "az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv",
        shell=True, text=True).strip()


def call(tok, model, brief):
    body = json.dumps({
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": json.dumps(brief)}],
        "response_format": {"type": "json_object"},
        "max_completion_tokens": 6000,
    }).encode()
    req = request.Request(
        f"{ENDPOINT}/openai/deployments/{model}/chat/completions?api-version={API_VERSION}",
        data=body, headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    start = time.time()
    try:
        with request.urlopen(req, timeout=300) as r:
            j = json.load(r)
    except error.HTTPError as e:
        return {"error": f"{e.code} {e.read().decode()[:300]}", "seconds": round(time.time() - start, 1)}
    secs = round(time.time() - start, 1)
    u = j.get("usage", {})
    text = j["choices"][0]["message"]["content"]
    try:
        parsed = json.loads(text)
    except Exception:
        parsed = None
    return {"seconds": secs, "prompt_tokens": u.get("prompt_tokens"), "completion_tokens": u.get("completion_tokens"),
            "reasoning_tokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens"),
            "valid_json": parsed is not None, "output": parsed if parsed is not None else text}


def main():
    models = sys.argv[1:] or MODELS
    briefs = json.loads((HERE / "briefs.json").read_text(encoding="utf-8"))
    tok = token()
    jobs = [(m, s) for m in models for s in briefs]
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(lambda ms: call(tok, ms[0], ms[1]["brief"]), jobs))
    out = [{"model": m, "scenario": s["id"], **r} for (m, s), r in zip(jobs, res)]
    (HERE / "results.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    for m in models:
        rows = [o for o in out if o["model"] == m]
        ok = [o for o in rows if "error" not in o]
        if ok:
            print(f"{m:24s} ok={len(ok)}/{len(rows)} avg {sum(o['seconds'] for o in ok) / len(ok):5.1f}s "
                  f"max {max(o['seconds'] for o in ok):5.1f}s  avg out tokens {sum(o['completion_tokens'] for o in ok) // len(ok)}")
        else:
            print(f"{m:24s} FAILED: {rows[0].get('error')}")


if __name__ == "__main__":
    main()
