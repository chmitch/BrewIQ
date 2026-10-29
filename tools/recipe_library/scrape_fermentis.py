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


cat = get("https://fermentis.com/en/fermentation/beer-brewing-solutions/active-dry-yeast-beer/")
slugs = []
for s in re.findall(r"https://fermentis\.com/en/product/([^/\"'#?]+)/", cat):
    if s not in slugs:
        slugs.append(s)
print(len(slugs), "slugs", slugs)

out = []
for s in slugs:
    u = f"https://fermentis.com/en/product/{s}/"
    t = text(get(u))

    def f(label):
        m = re.search(label + r"\n([^\n]+)", t)
        return m.group(1).strip() if m else None

    name = re.search(r"Active dry yeast beer\n([^\n]+)", t)
    desc = re.search(r"\nDescription\n([^\n]+)\n([^\n]+)", t)
    species = re.search(r"Yeast \(([A-Z][a-z]+ [a-z]+(?: var\. [a-z]+)?)\)", t)
    temp = re.search(r"at ideally ([^\n.]*?\(\d+(?:\.\d)?-\d+(?:\.\d)?°F\))", t) or re.search(r"(\d+(?:\.\d)?\s*(?:to|-|–)\s*\d+(?:\.\d)?\s*°C[^\n]*)", t[t.find("DOSAGE"):] if "DOSAGE" in t else "")
    out.append(
        dict(
            slug=s,
            name=name.group(1).strip() if name else None,
            tagline=desc.group(1).strip() if desc else None,
            species=species.group(1) if species else None,
            attenuation=f("Apparent attenuation"),
            sedimentation=f("Sedimentation time"),
            alcohol=f("Alcohol tolerance"),
            phenolic=f("Phenolic Off-Flavor"),
            temp=temp.group(1) if temp else None,
            url=u,
        )
    )
json.dump(out, open("fermentis.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)
for o in out:
    print(o["name"], "|", o["attenuation"], "|", o["sedimentation"], "|", o["alcohol"], "|", o["species"], "|", o["temp"])
