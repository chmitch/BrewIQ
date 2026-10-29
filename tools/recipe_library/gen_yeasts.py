import json
import re
from pathlib import Path

W = json.load(open("wyeast_all.json", encoding="utf8"))
F = []  # (code, name, species, floc, att, abv, tmin_c10F, tmax, note, slug)


def fz(code, name, att, floc, abv, tmin, tmax, species, slug, note=None):
    a = [int(x) for x in att.split("-")]
    return dict(brand="Fermentis", code=code, name=name, form="dry", species=species,
                flocculation=floc, attenuationMinPct=a[0], attenuationMaxPct=a[1], abvTolerance=abv,
                tempMinTenthsF=tmin, tempMaxTenthsF=tmax, notes=note, category="Beer", source="fermentis.com",
                sourceUrl=f"https://fermentis.com/en/product/{slug}/")


SC = "Saccharomyces cerevisiae"
SP = "Saccharomyces pastorianus"
ALE = (644, 788)
LAG = (536, 644)
ferm = [
    fz("S-04", "SafAle S-04", "74-82", "High", "9-11%", *ALE, SC, "safale-s%e2%80%9104", "English ale. Fermentis lists sedimentation time: fast."),
    fz("US-05", "SafAle US-05", "78-82", "Medium", "9-11%", *ALE, SC, "safale-us-05", "Neutral American ale. Sedimentation: medium."),
    fz("W-68", "SafAle W-68", "78-84", "Medium", None, *ALE, "Saccharomyces cerevisiae (POF+)", "safale-w-68", "German wheat beer; phenolic (clove) and banana esters."),
    fz("S-33", "SafAle S-33", "68-72", "Medium", "9-11%", *ALE, SC, "safale-s%e2%80%9133", "General purpose ale. Sedimentation: medium."),
    fz("T-58", "SafAle T-58", "72-78", "Medium", "9-11%", *ALE, SC, "safale-t%e2%80%9158", "Belgian-style ale, spicy; phenolic."),
    fz("K-97", "SafAle K-97", "80-84", "Low", "9-11%", *ALE, SC, "safale-k%e2%80%9197", "German ale / Kolsch; sedimentation: slow."),
    fz("BE-256", "SafAle BE-256", "82-86", "High", "9-11%", *ALE, SC, "safale-be%e2%80%91256", "Abbey / Belgian ale; fast sedimentation."),
    fz("BE-134", "SafAle BE-134", "89-93", "Low", "9-11%", *ALE, "Saccharomyces cerevisiae var. diastaticus", "safale-be-134", "Saison; sedimentation: slow. Diastaticus: ferments dextrins."),
    fz("WB-06", "SafAle WB-06", "86-90", "Low", "9-11%", *ALE, "Saccharomyces cerevisiae var. diastaticus", "safale-wb-06", "Wheat beer; sedimentation: slow; phenolic."),
    fz("BW-20", "SafAle BW-20", "77-83", "Low", None, *ALE, "Saccharomyces cerevisiae (POF+)", "safale-bw%e2%80%9120", "Belgian witbier; sedimentation: medium."),
    fz("W-34/70", "SafLager W-34/70", "80-84", "High", "9-11%", *LAG, SP, "saflager-w-34-70", "Lager; fast sedimentation."),
    fz("S-189", "SafLager S-189", "80-84", "High", "9-11%", *LAG, SP, "saflager-s-189", "Swiss-style lager; fast sedimentation."),
    fz("S-23", "SafLager S-23", "80-84", "High", "9-11%", *LAG, SP, "saflager-s%e2%80%9123", "German-style lager; fast sedimentation."),
    fz("E-30", "SafLager E-30", "80-84", "Medium", None, *LAG, SP, "saflager-e%e2%80%9130", "Lager"),
    fz("SH-45", "SafLager SH-45", "77-82", "Medium", None, None, None, SP, "saflager-sh-45", "Lager (hybrid temperature range per Fermentis)."),
]
# Kit-only strains: ranges come from the Northern Brewer kit instructions.
KIT = [
    ("Imperial", "A01", "House", "liquid", 620, 700),
    ("Imperial", "G01", "Stefon", "liquid", 630, 730),
    ("Omega", "OYL-006", "British Ale I", "liquid", 640, 720),
    ("Omega", "OYL-021", "Hefeweizen Ale", "liquid", 640, 750),
    ("Danstar", "Nottingham", "Nottingham Ale Yeast", "dry", 570, 700),
]
out = []


def rng(s):
    if not s:
        return None, None
    n = [int(x) for x in re.findall(r"\d+", s.split("%")[0])]
    return (n[0], n[-1]) if n else (None, None)


for w in W:
    code = w["code"]
    a = rng(w["attenuation"])
    tm = re.match(r"(\d+)\s*-\s*(\d+)\s*°F", w["temp"] or "")
    out.append(dict(
        brand="Wyeast", code=code, name=w["name"].replace("®", "").replace("™", "").strip(), form="liquid",
        species=w["species"], flocculation=w["flocculation"], attenuationMinPct=a[0], attenuationMaxPct=a[1],
        abvTolerance=w["abv"].replace(" ", "") if w["abv"] else None,
        tempMinTenthsF=int(tm.group(1)) * 10 if tm else None, tempMaxTenthsF=int(tm.group(2)) * 10 if tm else None,
        notes=("Private Collection / limited availability." if code.endswith("-PC") else None),
        category=", ".join(w.get("cats") or []) or None, source="wyeastlab.com", sourceUrl=w["url"]))
out += ferm
for b, c, n, f, lo, hi in KIT:
    out.append(dict(brand=b, code=c, name=n, form=f, category="Beer", tempMinTenthsF=lo, tempMaxTenthsF=hi,
                    notes="Temperature range from the Northern Brewer kit instructions; manufacturer spec not yet captured.",
                    source="Northern Brewer kit"))
for o in out:
    for k in list(o):
        if o[k] is None:
            del o[k]
body = json.dumps(out, indent=2, ensure_ascii=False)
open(Path(__file__).resolve().parents[2] / "brewiq-app/packages/frontend/src/seed/yeasts.ts", "w", encoding="utf8").write(
    "import type { YeastRecord } from '@rayfin-app/shared';\n\n"
    "/** Manufacturer yeast specs. Where a kit and the manufacturer disagree, the manufacturer wins. */\n"
    "export type YeastSeed = Omit<YeastRecord, 'id'>;\n\n"
    f"export const YEAST_SEED: YeastSeed[] = {body};\n")
print(len(out))

