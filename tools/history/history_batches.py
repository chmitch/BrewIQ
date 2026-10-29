"""Generate and ingest historical Tilt batches into the BrewIQ Eventhouse.

Same curve and temperature model as the TiltEvent-Simulator, with each batch's
parameters set explicitly. Usage:
    python history_batches.py            # dry run: print stats, write history_batches.csv
    python history_batches.py --ingest   # also ingest (needs KUSTO_TOKEN)
"""
import math
import os
import sys
from datetime import datetime, timedelta, timezone

import numpy as np

URI = os.environ.get("KUSTO_URI", "")  # Eventhouse query URI (printed by infra/provision.py)
DB = "BrewIQEventhouse"
TABLE = "TiltEvents"
CONDITION_H = 24
BAND_F = 2.0
COOL_DOWN_H = 12
K, M = 8.0, 0.35

# name, yeast, start (UTC), og, fg, ferment days, onset h, pitch F, band low F
BATCHES = [
    ("Bavarian Hefeweizen", "Wyeast 3068", "2026-05-02T15:12", 1050, 1012, 10, 14, 78.6, 66.0),
    ("American IPA", "Safale US-05", "2026-05-30T13:40", 1064, 1013, 14, 12, 79.2, 66.0),
    ("Belgian Saison", "Belle Saison", "2026-07-08T16:05", 1060, 1006, 14, 10, 79.8, 76.0),
    ("Irish Red Ale", "Safale S-04", "2026-08-10T14:20", 1052, 1014, 16, 18, 78.3, 64.0),
    ("Imperial Stout", "Wyeast 1056", "2026-09-04T17:30", 1088, 1022, 30, 24, 79.0, 64.0),
]


def sig(x):
    return 1.0 / (1.0 + math.exp(-x))


def progress(onset, ferment_h, h):
    x = (h - onset) / (ferment_h - onset)
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lo, hi = sig(-K * M), sig(K * (1 - M))
    return (sig(K * (x - M)) - lo) / (hi - lo)


def temp_f(onset, pitch, mid, phase, h, t_h, rng):
    if h < onset:
        base = pitch
    else:
        w = min(1.0, (h - onset) / COOL_DOWN_H)
        w = w * w * (3 - 2 * w)
        base = pitch + (mid - pitch) * w
    half = BAND_F / 2
    swing = half * 0.6 * math.sin(2 * math.pi * (t_h % 24) / 24 + phase) + rng.normal(0, half * 0.12)
    t = base + max(-half, min(half, swing))
    if h < onset:
        t = max(78.0, min(80.0, t))
    return t


def generate():
    rows = []
    for i, (name, _yeast, start, og, fg, days, onset, pitch, lo) in enumerate(BATCHES):
        t0 = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
        ferment_h = days * 24.0
        active_h = ferment_h + CONDITION_H
        mid = lo + BAND_F / 2
        phase = float(np.random.default_rng([7, i, 0]).uniform(0, 2 * math.pi))
        n = int(active_h * 60)
        for s in range(n):
            h = s / 60.0
            rng = np.random.default_rng([7, i, 2, s])
            g = fg + (og - fg) * (1.0 - progress(onset, ferment_h, h))
            tc = (temp_f(onset, pitch, mid, phase, h, (t0.hour + t0.minute / 60 + h), rng) - 32.0) * 5.0 / 9.0
            ts = t0 + timedelta(minutes=s)
            rows.append((i, ts.strftime("%Y-%m-%dT%H:%M:%SZ"), int(round(g + rng.normal(0, 0.3))), round(float(tc), 1)))
    return rows


def ingest(rows, chunk=2000):
    import requests

    token = os.environ["KUSTO_TOKEN"]
    for i in range(0, len(rows), chunk):
        csv = "\n".join(f"{r[1]},{r[2]},{r[3]}" for r in rows[i:i + chunk])
        resp = requests.post(
            f"{URI}/v1/rest/mgmt",
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
            json={"db": DB, "csl": f".ingest inline into table {TABLE} with (format='csv') <|\n{csv}"},
            timeout=120,
        )
        resp.raise_for_status()
        print(f"ingested {min(i + chunk, len(rows))}/{len(rows)}", flush=True)


if __name__ == "__main__":
    rows = generate()
    for i, b in enumerate(BATCHES):
        r = [x for x in rows if x[0] == i]
        gs = [x[2] for x in r]
        ts = [x[3] * 9 / 5 + 32 for x in r]
        print(f"{b[0]:<20} {r[0][1]} .. {r[-1][1]}  n={len(r):>6}  grav {gs[0]}->{gs[-1]}  "
              f"temp F early {max(ts[:600]):.1f} / ferment {min(ts[len(ts)//2:]):.1f}-{max(ts[len(ts)//2:]):.1f}")
    print("total rows", len(rows))
    if "--ingest" in sys.argv:
        ingest(rows)
