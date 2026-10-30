# Brewing playbook

BREWING PLAYBOOK (general guidance; the brief's yeast data and recipe take precedence)
Tags: [F]=Fermentis product pages, [L]=Lallemand Brewing pages, [G]=widely accepted general brewing practice (not taken from a fetched page; treat as heuristics, not hard limits).
The Tilt floats inside the fermenter, so gravity is a real, continuous measurement. Never recommend manual hydrometer checks; use the Tilt trend.

1. NORMAL FERMENTATION CURVE
- Expect four phases: lag (little gravity change, often several hours up to about a day), active (steady, fastest gravity drop), slowing (drop rate tapers), stable (flat at or near expected FG). [G]
- A healthy dry-yeast pitch at the right temperature starts quickly; Fermentis stresses correct dosage and pitching temperature for good kinetics. [F]
- Typical ale fermentations show most gravity drop in the first several days, then a long tail. Lagers run slower and colder, so judge them on a longer time scale. [G]
- Stable means gravity flat for roughly 2-3 days at or near expected FG; one flat day alone is not proof, especially in a cold or high-gravity beer. [G]

2. LAG, SLOW, STALL: DIAGNOSE BEFORE ACTING
- Lag: no drop yet. Check hours since pitch and wort temperature. Cold wort or a low pitch rate lengthens lag; wait before concluding anything unless temperature is clearly outside the yeast range. [G]
- Slow: dropping, but well behind the typical curve. Likely causes: wort below the yeast's range, underpitching, high OG, low oxygen at pitch, or old/poorly stored yeast. [G]
- Stalled: gravity flat while still clearly above expected FG (and the yeast's attenuation says more drop is possible). Rule out a sensor artefact: a single odd reading is an anomaly, not a stall; require a sustained flat trend. [G]
- Fix order for slow/stall: (1) if below the yeast range, raise temperature gently toward the lower-middle of the range, a few degrees at a time; (2) gently rouse or swirl the yeast back into suspension without splashing (avoid oxygen once fermenting); (3) wait 24-48h and watch the Tilt trend; (4) if still flat above FG, repitch fresh, healthy yeast (a strong-attenuating, alcohol-tolerant strain for strong beers). [G]
- Storage matters: dry yeast kept warm or in opened packs loses viability. Fermentis: unopened below 24C for under 6 months, below 15C for longer, opened sachets resealed at 4C and used within 7 days. Lallemand: store dry below 4C, discard sachets that lost vacuum. [F][L]
- Dosage: Fermentis suggests 50-80 g/hl for its ale strains and 80-120 g/hl for lagers; high-gravity wort needs the upper end or more. [F]

3. TEMPERATURE EFFECTS
- Fermentis ale strains (US-05, S-04, S-33) are rated for roughly 18-26C (64-79F); W-34/70 and S-23 lager strains for roughly 12-18C (54-64F). [F]
- Lallemand NovaLager is a hybrid lager strain working at about 10-20C (50-68F), low diacetyl, no sulfur. [L]
- Warm end or above the range: more esters (fruity), higher alcohols/fusel (hot, solvent-like), more diacetyl and stress flavors; fermentation can run away fast. [G]
- Cold end or below the range: slow or sluggish yeast, possible stall, flocculation too early, and sulfur notes in lagers. [G]
- Yeast metabolism releases heat: beer temperature can run a few degrees above ambient during the active phase. If the brief shows a rising trend during active phase, expect it to peak then fall; recommend cooling or a lower ambient setpoint rather than waiting. [G]
- Judge by hours outside the range: a brief excursion is minor; many hours above the range during active fermentation matter much more than the same hours near the end. Temperature swings (cycles of several degrees) stress yeast and can stall or restart activity. [G]
- Do not ramp temperature fast: sudden cooling can drop yeast out of suspension; gradual steps are safer. [G]

4. OVER-ATTENUATION (FG BELOW EXPECTED)
- Compare final gravity with the yeast's attenuation range and the recipe's fermentability. Mash temperature, simple sugars (sugar, honey, adjuncts) and low-dextrin grists give a thinner, drier beer than the estimate. [G]
- Strains differ: Fermentis lists S-33 as giving a fuller body; US-05 as neutral and clean. Pick expectation from the brief's attenuation field, not assumptions. [F]
- Diastatic or wild yeast and bacterial contamination can keep eating dextrins, so gravity keeps falling below expected FG; also watch for pellicle, sourness, or phenolic off-flavors, and a gravity that keeps drifting down after being stable. [G]
- Fermentation warmer than the range often adds extra attenuation. [G]
- If OVER_ATTENUATED fires: confirm trend is real (not a sensor anomaly), check mash temperature and sugar additions in the recipe, check temperature history, and consider infection if gravity is still falling after the beer had stabilized. Packaging a still-dropping beer risks over-carbonation. [G]

5. DIACETYL, CLEAN-UP, AND "REALLY DONE"
- Diacetyl (butter/butterscotch) is made during active fermentation and reabsorbed by healthy yeast near the end. Leave the beer on the yeast after gravity flattens. [G]
- Diacetyl rest: once gravity is within a few points of expected FG (about 70-80% done is common for lager practice), hold or raise temperature a few degrees for roughly 2 days, then cool. Ales usually clean up on their own if kept at the yeast's normal range for a few extra days. [G]
- Lallemand notes NovaLager is low-diacetyl and needs reduced maturation versus classic lagers. [L]
- FG_REACHED means gravity is near the expected FG; the beer is done only when it is flat for 2-3 days AND temperature has stayed in range through the finish. Recommend waiting for clean-up even once gravity is flat. [G]

6. COLD CRASH AND PACKAGING
- Safe to crash or package only when gravity is stable for 2-3 days at or near FG and clean-up time has passed. Crashing early halts yeast and leaves diacetyl or acetaldehyde (green apple). [G]
- If gravity is still falling or the beer stalled above FG, do not crash or bottle; resolve the stall first. [G]
- Do not crash a fermenter in a way that sucks in air; keep closed. [G]

7. INFECTION AND OFF-FLAVOR SIGNS
- Infection signs: pellicle or film, ropy/slimy appearance, sourness, band-aid/medicinal phenol, and gravity that keeps dropping past expected FG. Cannot be confirmed from gravity alone; report as suspicion and suggest inspecting and tasting. [G]
- Fermentis states its dry yeasts are above 99.9% pure, so contamination more likely comes from equipment or handling. [F]
- Sulfur/eggy: common in lager or cold ferments, often fades with time warm. Solvent/hot alcohol: temperature too high. Butter: not enough clean-up. [G]

8. STRAIN NOTES (verify against the brief's yeast data)
- SafAle US-05: neutral, clean, firm foam head, stays in suspension; used for American styles. [F]
- SafAle S-04: fast English strain, balanced fruity-floral, high flocculation, good clarity. [F]
- SafAle S-33: fruity, fuller body; for Belgian, strong English ales and NEIPA; medium sedimentation with powdery haze when disturbed. [F]
- SafLager W-34/70: clean lager with balanced floral-fruity aroma; S-23: fruitier, more estery lagers. [F]
- LalBrew NovaLager: lager at warmer temps, 78-84% attenuation, up to 13% ABV, 50-100 g/hl. [L]
- Lallemand prefers dry pitching over rehydration for consistency and lower contamination risk; Fermentis allows either (rehydrate in at least 10x yeast weight of water at 25-29C for ales, 15-25C for lagers, 15-30 min). [L][F]

9. HOW TO APPLY TO THE BRIEF
- Use the gravity phase first, then hours since pitch and temperature history, before deciding whether a problem exists.
- Do not escalate STALLED while phase is lag or while hours since pitch is short; do escalate when flat above FG after the active window.
- Always mention the likely cause(s) from the temperature fields and give a ranked, specific action using the Tilt trend as the check.
- Treat anomalies (single reading outliers) as sensor noise and say so.
- Distinguish certainty: state what the data shows versus what is a hypothesis.

SOURCES
[F] https://fermentis.com/en/product/safale-us-05/ ; https://fermentis.com/en/product/safale-s-04/ ; https://fermentis.com/en/product/safale-s-33/ ; https://fermentis.com/en/product/saflager-w-34-70/ ; https://fermentis.com/en/product/saflager-s-23/
[L] https://www.lallemandbrewing.com/en/united-states/resources/brewers-corner/re-hydration-and-quality/ ; https://www.lallemandbrewing.com/en/united-states/products/brewing-yeast/lalbrew-novalager/
[G] General brewing practice (in the tradition of Palmer, How to Brew; howtobrew.com was not retrievable)

