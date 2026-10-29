"""Builds the RecipeImport notebook (.ipynb) that reads a recipe PDF with Fabric's built-in gpt-5.1.

Usage: python build_notebook.py [python|spark] [output.ipynb]
Publish with notebooks/publish_notebook.py.
"""
import json, sys
from pathlib import Path

RUNTIME = sys.argv[1] if len(sys.argv) > 1 else "python"  # python | spark

PARAMS = '''# Parameters (injected by the job run)
url = ""
job_id = "local"
'''

CODE = r'''
import io, ipaddress, json, os, socket, subprocess, sys, traceback, urllib.request, urllib.error
from urllib.parse import urljoin, urlparse

OUT_DIR = "/lakehouse/default/Files/import"
MAX_PDF_BYTES = 15 * 1024 * 1024
MAX_TEXT_CHARS = 60000
MODEL = "gpt-5.1"

SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["name", "style", "source", "kitCode", "batchSizeGal", "ogPoints", "abvTenths", "ibuTenths",
                 "primaryDaysMin", "primaryDaysMax", "totalWeeks", "pitchTempMaxTenthsF", "yeastNotes",
                 "suggestedYeasts", "timeline", "instructions", "ingredients"],
    "properties": {
        "name": {"type": "string"},
        "style": {"type": "string"},
        "source": {"type": ["string", "null"], "description": "Vendor, e.g. Northern Brewer"},
        "kitCode": {"type": ["string", "null"]},
        "batchSizeGal": {"type": "number"},
        "ogPoints": {"type": "integer", "description": "Original gravity in points, 1.050 = 1050"},
        "abvTenths": {"type": ["integer", "null"], "description": "ABV x10, 4.8% = 48"},
        "ibuTenths": {"type": ["integer", "null"], "description": "IBU x10, 25 IBU = 250"},
        "primaryDaysMin": {"type": ["integer", "null"]},
        "primaryDaysMax": {"type": ["integer", "null"]},
        "totalWeeks": {"type": ["integer", "null"]},
        "pitchTempMaxTenthsF": {"type": ["integer", "null"], "description": "Max pitch temp in tenths of F, 78 F = 780"},
        "yeastNotes": {"type": ["string", "null"], "description": "Yeast guidance as written in the recipe"},
        "suggestedYeasts": {
            "type": "array", "description": "Each yeast the recipe names, e.g. Safale S-04, Wyeast 1098",
            "items": {"type": "object", "additionalProperties": False, "required": ["brand", "code", "name"],
                      "properties": {"brand": {"type": "string"}, "code": {"type": "string"},
                                     "name": {"type": ["string", "null"]}}}},
        "timeline": {"type": ["string", "null"]},
        "instructions": {"type": "string", "description": "Short paraphrased summary of the brewing steps, not a verbatim copy"},
        "ingredients": {
            "type": "array",
            "items": {"type": "object", "additionalProperties": False, "required": ["kind", "name", "amount", "timing"],
                      "properties": {"kind": {"type": "string", "enum": ["fermentable", "hop", "yeast", "adjunct", "other"]},
                                     "name": {"type": "string"}, "amount": {"type": ["string", "null"]},
                                     "timing": {"type": ["string", "null"]}}}},
    },
}

PROMPT = (
    "You extract homebrew recipe data from the text of a recipe or kit instruction sheet. "
    "Return only what the text supports; use null when a value is not stated. "
    "Use these units: gravity in points (1.050 = 1050), ABV and IBU in tenths, temperatures in tenths of degrees F. "
    "Summarize the brewing steps in your own words; do not copy long passages. "
    "totalWeeks is the stated overall brew time or ready-in figure (for example 'BREW TIME: 4 WEEKS'), not a later conditioning milestone. "
    "primaryDaysMin and primaryDaysMax come from the stated primary fermentation stage, converted to days. "
    "pitchTempMaxTenthsF is the temperature the wort must reach before adding yeast. "
    "kitCode is the vendor kit or item code; it may appear only in the source URL file name."
)


def check_url(u):
    p = urlparse(u)
    if p.scheme != "https" or not p.hostname:
        raise ValueError("Only https URLs are supported.")
    for info in socket.getaddrinfo(p.hostname, p.port or 443):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError("URL resolves to a non-public address.")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def fetch_pdf(u):
    opener = urllib.request.build_opener(NoRedirect)
    for _ in range(4):
        check_url(u)
        try:
            with opener.open(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
                data = r.read(MAX_PDF_BYTES + 1)
                break
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                u = urljoin(u, e.headers["Location"])
                continue
            raise
    else:
        raise ValueError("Too many redirects.")
    if len(data) > MAX_PDF_BYTES:
        raise ValueError("PDF is larger than 15 MB.")
    if not data.startswith(b"%PDF"):
        raise ValueError("URL did not return a PDF.")
    return data


def ensure(mod, pkg):
    try:
        __import__(mod)
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", *pkg.split()], check=True, timeout=240)


def run():
    ensure("pypdf", "pypdf")
    ensure("openai", "openai httpx")
    from pypdf import PdfReader
    import openai
    from synapse.ml.fabric.credentials import get_openai_httpx_sync_client

    data = fetch_pdf(url)
    text = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages).strip()[:MAX_TEXT_CHARS]
    if len(text) < 200:
        raise ValueError("The PDF has no readable text (it may be a scanned image).")
    client = openai.AzureOpenAI(http_client=get_openai_httpx_sync_client(), api_version="2025-04-01-preview")
    r = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": PROMPT}, {"role": "user", "content": f"Source URL: {url}\n\n{text}"}],
        response_format={"type": "json_schema", "json_schema": {"name": "recipe", "strict": True, "schema": SCHEMA}},
        reasoning_effort="low",
    )
    recipe = json.loads(r.choices[0].message.content)
    recipe["sourceUrl"] = url
    return {"status": "ok", "recipe": recipe}


try:
    result = run()
except Exception as e:
    result = {"status": "error", "error": f"{type(e).__name__}: {e}"[:500], "trace": traceback.format_exc()[-800:]}
os.makedirs(OUT_DIR, exist_ok=True)
with open(f"{OUT_DIR}/{job_id}.json", "w") as f:
    json.dump(result, f)
print(result["status"])
'''

def cell(src, tag=None):
    return {"cell_type": "code", "metadata": ({"tags": [tag]} if tag else {}), "execution_count": None,
            "outputs": [], "source": src.strip("\n").splitlines(True)}

meta = {}  # publish_notebook.py attaches the default lakehouse
if RUNTIME == "python":
    meta.update({"kernel_info": {"name": "jupyter"}, "kernelspec": {"name": "jupyter", "display_name": "Jupyter"},
                 "language_info": {"name": "python"},
                 "microsoft": {"language": "python", "language_group": "jupyter_python"}})
else:
    meta.update({"kernel_info": {"name": "synapse_pyspark"}, "language_info": {"name": "python"}})

nb = {"nbformat": 4, "nbformat_minor": 5, "metadata": meta, "cells": [cell(PARAMS, "parameters"), cell(CODE)]}


out = sys.argv[2] if len(sys.argv) > 2 else str(Path(__file__).with_name("RecipeImport.ipynb"))
Path(out).write_text(json.dumps(nb, indent=1), encoding="utf-8")
print("wrote", out)
