import html
import json
import re
import subprocess

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"


def get(u):
    r = subprocess.run(["curl.exe", "-sL", "-A", UA, u], capture_output=True)
    return r.stdout.decode("utf8", "replace")


def text(h):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S)
    t = re.sub(r"<[^>]+>", "\n", t)
    return html.unescape(re.sub(r"[ \t]*\n\s*", "\n", t))


idx = get("https://wyeastlab.com/yeast-cultures/")
slugs = []
for s in re.findall(r"https://wyeastlab\.com/product/([a-z0-9\-_%]+)/", idx):
    if s not in slugs:
        slugs.append(s)
print(len(slugs), "slugs")

out = []
for s in slugs:
    u = f"https://wyeastlab.com/product/{s}/"
    raw = get(u)
    t = text(raw)
    m = re.search(r"Strain:\s*(\S+)\s*\n+(?:Magnified[^\n]*\n+)?\s*#*\s*(.+)", t)
    if not m:
        print("SKIP", s)
        continue
    nm = re.search(r'<h3 class="subheadline">([^<]+)</h3>', raw)
    if not m:
        print("SKIP", s)
        continue
    nameval = html.unescape(nm.group(1)).strip() if nm else m.group(2).strip()

    def field(label):
        mm = re.search(label + r"\s*\n+\s*([^\n]+)", t)
        return mm.group(1).strip() if mm else None

    sp = re.search(r"Species:\s*([^\n]+)", t)
    cats = []
    ui = t.find("Used in:")
    if ui >= 0:
        for ln in t[ui + 8 :].split("\n")[1:8]:
            ln = ln.strip()
            if ln in ("Beer", "Cider", "Mead", "Wine", "Wild & Sour", "Spirits", "Saké", "Sake", "Seltzer", "Kombucha"):
                cats.append(ln)
            elif ln.startswith("Flocculation") or ln.startswith("Apparent") or ln.startswith("Temperature"):
                break
    out.append(
        dict(
            cats=cats,
            code=m.group(1).strip(),
            name=nameval,
            species=sp.group(1).strip(" _*") if sp else None,
            flocculation=field("Flocculation"),
            attenuation=field("Apparent Attenuation"),
            abv=field("Apparent ABV Tolerance"),
            temp=field("Temperature Range"),
            url=u,
        )
    )
json.dump(out, open("wyeast_all.json", "w", encoding="utf8"), indent=1)
for o in out:
    print(o["code"], "|", o["name"], "|", o["flocculation"], "|", o["attenuation"], "|", o["abv"], "|", o["temp"])

