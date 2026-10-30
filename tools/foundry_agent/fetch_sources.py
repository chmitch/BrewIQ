"""Fetch public, openly licensed sources into knowledge/sources/ for the recipe advisor.

PMC articles are kept only when their license is a Creative Commons one that
allows redistribution. Wikipedia text is CC BY-SA 4.0. Each output file starts
with an attribution header. Reference lists are dropped.

    python tools/foundry_agent/fetch_sources.py
"""
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

HERE = Path(__file__).parent
OUT = HERE / "knowledge" / "sources"
UA = {"User-Agent": "BrewIQ-research/1.0 (homebrew project)"}
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
WIKI = "https://en.wikipedia.org/w/api.php"
XLINK = "{http://www.w3.org/1999/xlink}href"
OK_LICENSE = re.compile(r"creativecommons\.org/(licenses/by(-sa)?|publicdomain)", re.I)


def text_of(el):
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def body_md(el, depth=2):
    out = []
    for ch in el:
        if ch.tag == "sec":
            title = ch.find("title")
            if title is not None:
                out.append("\n" + "#" * min(depth + 1, 4) + " " + text_of(title))
            out.extend(body_md(ch, depth + 1))
        elif ch.tag == "p":
            out.append(text_of(ch))
        elif ch.tag == "table-wrap":
            cap = ch.find("caption")
            if cap is not None:
                out.append("Table: " + text_of(cap))
    return out


def fetch_pmc(entry):
    pid = entry["id"]
    r = requests.get(EUTILS, params={"db": "pmc", "id": pid.replace("PMC", ""), "retmode": "xml"}, headers=UA, timeout=60)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    art = root.find(".//article")
    lic = art.find(".//permissions/license")
    lic_url = ""
    if lic is not None:
        m = re.search(r"https?://creativecommons\.org/[^\s\"'<>)]+", ET.tostring(lic, encoding="unicode"))
        lic_url = m.group(0) if m else (lic.get(XLINK) or "")
    if not OK_LICENSE.search(lic_url):
        print(f"SKIP {pid}: license '{lic_url}' does not allow redistribution")
        return None
    title = text_of(art.find(".//article-title"))
    journal = text_of(art.find(".//journal-title"))
    year = art.find(".//pub-date/year")
    doi = art.find(".//article-id[@pub-id-type='doi']")
    authors = []
    for c in art.findall(".//contrib[@contrib-type='author']")[:6]:
        sn, gn = c.find(".//surname"), c.find(".//given-names")
        if sn is not None:
            authors.append(f"{gn.text if gn is not None else ''} {sn.text}".strip())
    abstract = art.find(".//abstract")
    body = art.find("body")
    lines = [
        f"# {title}",
        "",
        f"- Source: PubMed Central {pid} (https://pmc.ncbi.nlm.nih.gov/articles/{pid}/)",
        f"- Authors: {', '.join(authors)}{' et al.' if len(authors) == 6 else ''}",
        f"- Journal: {journal} ({year.text if year is not None else 'n.d.'})",
        f"- DOI: {doi.text if doi is not None else 'n/a'}",
        f"- License: {lic_url}",
        f"- Relevance to BrewIQ: {entry['topic']}",
        "",
    ]
    if abstract is not None:
        lines += ["## Abstract", text_of(abstract), ""]
    if body is not None:
        lines += body_md(body)
    return f"{pid}.md", "\n\n".join(l for l in lines if l is not None)


def fetch_wiki(title):
    params = {
        "action": "query", "prop": "extracts|revisions", "explaintext": 1, "redirects": 1,
        "rvprop": "ids", "titles": title, "format": "json",
    }
    for attempt in range(6):
        r = requests.get(WIKI, params=params, headers=UA, timeout=60)
        if r.status_code != 429:
            break
        time.sleep(5 * (attempt + 1))
    r.raise_for_status()
    page = next(iter(r.json()["query"]["pages"].values()))
    extract = page.get("extract", "")
    if not extract or len(extract) < 500:
        print(f"SKIP wikipedia '{title}': missing or too short")
        return None
    extract = re.split(r"\n== (See also|References|External links|Notes|Further reading|Bibliography) ==", extract)[0]
    rev = page["revisions"][0]["revid"]
    name = re.sub(r"[^a-z0-9]+", "-", page["title"].lower()).strip("-")
    url = "https://en.wikipedia.org/wiki/" + page["title"].replace(" ", "_")
    head = (
        f"# {page['title']} (Wikipedia)\n\n"
        f"- Source: {url} (revision {rev})\n"
        f"- License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); text by Wikipedia contributors\n\n"
    )
    return f"wikipedia-{name}.md", head + extract


def main():
    cfg = json.loads((HERE / "sources.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.md"):
        f.unlink()
    written = 0
    jobs = [(fetch_pmc, e) for e in cfg["pmc"]] + [(fetch_wiki, t) for t in cfg["wikipedia"]]
    for fn, arg in jobs:
        try:
            res = fn(arg)
        except Exception as ex:
            print(f"ERROR {arg}: {ex}")
            continue
        if res:
            name, content = res
            if (OUT / name).exists():
                print(f"dup  {name} (redirect target already fetched)")
                continue
            (OUT / name).write_text(content, encoding="utf-8", newline="\n")
            print(f"ok   {name} ({len(content) // 1024} KB)")
            written += 1
        time.sleep(2)
    print(f"{written} source files written to {OUT}")
    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
