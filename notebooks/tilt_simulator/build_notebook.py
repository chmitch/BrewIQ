"""Builds the TiltEvent-Simulator notebook (.ipynb).

Usage: python build_notebook.py [output.ipynb] [local_test.py]
Publish with notebooks/publish_notebook.py, which injects the Eventhouse URI and the
device connection string (never commit those).
"""
import json, sys
from pathlib import Path

cells = []

def md(s):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": s.strip("\n").splitlines(True)})

def code(s, params=False):
    meta = {"tags": ["parameters"]} if params else {}
    cells.append({"cell_type": "code", "metadata": meta, "execution_count": None, "outputs": [],
                  "source": s.strip("\n").splitlines(True)})

md('''
# Tilt Event Simulator (v2)

Generates synthetic Tilt hydrometer events shaped like `TiltEvents` (`gravity`, `temp`, `eventtime`) and sends
them to Azure IoT Hub. The eventstream writes them to the Eventhouse. The device reports temperature in
**Celsius**; the model is authored in Fahrenheit and converted on output.

**Batch model** - by default (`SINGLE_BATCH = True`) one batch is simulated and the run ends when it finishes. Set it to `False` for batches back to back. The batch draws its parameters (deterministically from `SEED`; change `SEED` for a different batch):
- **Duration**: fermentation lasts `FERMENT_DAYS_RANGE` days (7-30), then a conditioning hold, then an idle gap that emits the `999 / 20` sentinel.
- **OG / FG**: OG is drawn from `OG_RANGE`; FG comes from a per-batch apparent attenuation (`ATTENUATION_RANGE`).
- **Temperature**: the batch pitches warm (`PITCH_TEMP_RANGE_F`, 78-80 F). When gravity starts dropping (the onset, 12-36 h in), temperature
  eases down over `COOL_DOWN_HOURS` into the batch's fermentation band: a `TEMP_BAND_F` (2 F) window placed anywhere between
  `FERMENT_TEMP_RANGE_F` (60-80 F). Readings fluctuate inside that band.

**Fast-forward** - the simulated batch follows the wall clock. Any events whose time has already passed are written straight to the Eventhouse
(`BACKFILL_TARGET = "eventhouse"`), then live events continue through IoT Hub. This covers both a mid-batch start (`BATCH_ELAPSED_HOURS`, e.g. 96 =
"the batch started 96 hours ago") and a restart after downtime such as a nightly capacity shutdown: the gap since the checkpoint is filled in with
correctly timestamped readings and the run resumes at "now". (Replaying a gap through the IoT Hub would blow the free tier's 8,000 messages/day limit.)

**Checkpointing** - readings are a pure function of `(SEED, sequence number)`, so the checkpoint is just the next sequence number.
It is saved after every send / ingest chunk, so a restart resumes where it left off. Delivery is at-least-once (a crash can repeat one message or one ingest chunk).

**Setup** - attach `BrewIQLakehouse` (checkpoints go to `Files/checkpoints`); supply the device connection string via `IOTHUB_CONNECTION_STRING`, the env var, or Key Vault.
''')

code('''
%pip install azure-iot-device --quiet
''')

code('''
# ---- Parameters (this cell is tagged "parameters" so a pipeline can override them) ----
RUN_ID = "tilt-sim-002"          # checkpoint identity; change it to start a fresh simulation
SEED = 42                        # makes the generated series reproducible
RESET_CHECKPOINT = False         # True = ignore any existing checkpoint for RUN_ID and start over
SINGLE_BATCH = True              # simulate one batch (batch 0 for this SEED) and stop when it finishes; False = batches run back to back

# Start mid-batch: pretend the first batch started this many hours ago
BATCH_ELAPSED_HOURS = 0
BACKFILL_TARGET = "eventhouse"   # how elapsed events (mid-batch start, or downtime since the checkpoint) are handled:
                                 # "eventhouse" = write them directly | "iothub" = replay them through the hub | "none" = skip them
FAST_FORWARD_MIN_EVENTS = 5      # gaps smaller than this are just caught up through the hub
KUSTO_QUERY_URI = ""             # injected by publish_notebook.py / infra/provision.py
KUSTO_DATABASE = "BrewIQEventhouse"
KUSTO_TABLE = "TiltEvents"
BACKFILL_CHUNK = 2000            # rows per ingest command

# Pacing
INTERVAL_SECONDS = 60            # source cadence (the real device reports once a minute)
SPEED_FACTOR = 1.0               # 1.0 = real time, 60.0 = one event per second
CATCH_UP = True                  # after downtime, send the missed backlog without sleeping
CATCH_UP_PAUSE_SECONDS = 0.05
BATCH_SIZE = 1                   # events per IoT Hub message (sent as a JSON array, like the device)

# Stop conditions (None = run until the cell is stopped)
MAX_EVENTS = None
MAX_RUNTIME_MINUTES = None

# Destination
DRY_RUN = False                  # True = print messages instead of sending / ingesting
IOTHUB_CONNECTION_STRING = ""    # device connection string; prefer Key Vault below
KEY_VAULT_URL = ""
KEY_VAULT_SECRET_NAME = ""
CHECKPOINT_DIR = ""              # empty = <default lakehouse>/Files/checkpoints

# Per-batch fermentation model
FERMENT_DAYS_RANGE = (7, 30)     # fermentation length; each batch draws its own
CONDITION_HOURS = 24
IDLE_HOURS = 6                   # device idle between batches, reports 999 / 20
OG_RANGE = (1040, 1085)          # original gravity in points (1.048 SG -> 1048)
ATTENUATION_RANGE = (0.68, 0.82) # apparent attenuation; FG = 1000 + (OG-1000) * (1 - attenuation)
PITCH_TEMP_RANGE_F = (78.0, 80.0)  # warm start until gravity starts dropping
ONSET_HOURS_RANGE = (12, 36)     # hours from pitch until gravity starts dropping
COOL_DOWN_HOURS = 12             # ease from pitch temp to the fermentation band after onset
FERMENT_TEMP_RANGE_F = (60.0, 80.0)  # the band is placed somewhere in here
TEMP_BAND_F = 2.0                # temperature stays within a band this wide during fermentation
GRAVITY_NOISE = 0.3
TEMP_NOISE_FRACTION = 0.12       # noise as a fraction of the half-band

# Fault injection: occasional bad readings, so anomaly detection has something to find
ANOMALIES_PER_DAY = 2.0          # average anomalous readings per day of active fermentation (0 = off)
GRAVITY_ANOMALY_POINTS = (8, 20) # gravity spike or dip size in points (1.008-1.020 SG)
TEMP_ANOMALY_F = (4.0, 9.0)      # temperature jump or drop in F
''', params=True)

code('''
import bisect, hashlib, json, math, os, time
from datetime import datetime, timedelta, timezone

import numpy as np

MODEL = {
    "seed": SEED, "interval_seconds": INTERVAL_SECONDS,
    "ferment_days": list(FERMENT_DAYS_RANGE), "condition_hours": CONDITION_HOURS, "idle_hours": IDLE_HOURS,
    "og": list(OG_RANGE), "attenuation": list(ATTENUATION_RANGE),
    "pitch_f": list(PITCH_TEMP_RANGE_F), "onset_hours": list(ONSET_HOURS_RANGE), "cool_down_hours": COOL_DOWN_HOURS,
    "ferment_temp_f": list(FERMENT_TEMP_RANGE_F), "band_f": TEMP_BAND_F,
    "gravity_noise": GRAVITY_NOISE, "temp_noise_fraction": TEMP_NOISE_FRACTION,
    "anomalies_per_day": ANOMALIES_PER_DAY, "gravity_anomaly": list(GRAVITY_ANOMALY_POINTS), "temp_anomaly_f": list(TEMP_ANOMALY_F),
}
MODEL_HASH = hashlib.md5(json.dumps(MODEL, sort_keys=True).encode()).hexdigest()
IDLE_READING = (999, 20)
_K, _M = 8.0, 0.35   # shape of the gravity curve over the fermentation window

_batches, _starts = [], []


def _sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


def _make_batch(idx, start_h):
    r = np.random.default_rng([SEED, idx, 1])
    og = int(r.integers(OG_RANGE[0], OG_RANGE[1] + 1))
    att = float(r.uniform(*ATTENUATION_RANGE))
    fg = max(1004, int(round(1000 + (og - 1000) * (1 - att))))
    ferment_h = float(r.uniform(*FERMENT_DAYS_RANGE)) * 24
    onset = float(r.uniform(*ONSET_HOURS_RANGE))
    band_lo = float(r.uniform(FERMENT_TEMP_RANGE_F[0], FERMENT_TEMP_RANGE_F[1] - TEMP_BAND_F))
    pitch = float(r.uniform(*PITCH_TEMP_RANGE_F))
    active = ferment_h + CONDITION_HOURS
    return {"idx": idx, "start_h": start_h, "end_h": start_h + active + IDLE_HOURS, "active_h": active,
            "og": og, "fg": fg, "ferment_h": ferment_h, "onset": min(onset, ferment_h / 2),
            "band_mid": band_lo + TEMP_BAND_F / 2, "pitch": pitch, "phase": float(r.uniform(0, 2 * math.pi))}


def batch_at(t_h):
    while not _batches or _batches[-1]["end_h"] <= t_h:
        start = _batches[-1]["end_h"] if _batches else 0.0
        _batches.append(_make_batch(len(_batches), start))
        _starts.append(start)
    return _batches[bisect.bisect_right(_starts, t_h) - 1]


def _progress(b, h):
    # 0 until the onset, then a logistic drop that reaches 1 at the end of fermentation
    x = (h - b["onset"]) / (b["ferment_h"] - b["onset"])
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lo, hi = _sigmoid(-_K * _M), _sigmoid(_K * (1 - _M))
    return (_sigmoid(_K * (x - _M)) - lo) / (hi - lo)


def _temp_f(b, h, t_h, rng):
    if h < b["onset"]:
        base = b["pitch"]
    else:
        w = min(1.0, (h - b["onset"]) / max(COOL_DOWN_HOURS, 1e-9))
        w = w * w * (3 - 2 * w)
        base = b["pitch"] + (b["band_mid"] - b["pitch"]) * w
    half = TEMP_BAND_F / 2
    swing = half * 0.6 * math.sin(2 * math.pi * (t_h % 24) / 24 + b["phase"]) + rng.normal(0, half * TEMP_NOISE_FRACTION)
    t = base + max(-half, min(half, swing))
    if h < b["onset"]:
        t = max(PITCH_TEMP_RANGE_F[0], min(PITCH_TEMP_RANGE_F[1], t))
    return t


def reading(seq):
    # Deterministic (gravity, temp in C) for a sequence number, so a restart never replays history.
    t_h = seq * INTERVAL_SECONDS / 3600.0
    b = batch_at(t_h)
    h = t_h - b["start_h"]
    if h >= b["active_h"]:
        return IDLE_READING
    rng = np.random.default_rng([SEED, b["idx"], 2, seq])
    gravity = b["fg"] + (b["og"] - b["fg"]) * (1.0 - _progress(b, h))
    temp_f = _temp_f(b, h, t_h, rng)
    gravity += rng.normal(0, GRAVITY_NOISE)
    if ANOMALIES_PER_DAY > 0:
        # Separate stream, so turning anomalies on or off never changes the normal series.
        a = np.random.default_rng([SEED, b["idx"], 3, seq])
        if a.random() < ANOMALIES_PER_DAY * INTERVAL_SECONDS / 86400.0:
            sign = 1 if a.random() < 0.5 else -1
            kind = a.integers(0, 3)   # 0 = gravity, 1 = temperature, 2 = both
            if kind != 1:
                gravity += sign * a.uniform(*GRAVITY_ANOMALY_POINTS)
            if kind != 0:
                temp_f += (1 if a.random() < 0.5 else -1) * a.uniform(*TEMP_ANOMALY_F)
    temp_c = (temp_f - 32.0) * 5.0 / 9.0
    return int(round(gravity)), round(float(temp_c), 1)


def make_event(start_time, seq):
    g, t = reading(seq)
    ev_time = start_time + timedelta(seconds=seq * INTERVAL_SECONDS)
    return {"gravity": g, "temp": t, "eventtime": ev_time.strftime("%Y-%m-%dT%H:%M:%SZ")}


b0 = batch_at(0)
TOTAL_EVENTS = math.ceil(b0["active_h"] * 3600 / INTERVAL_SECONDS)   # events in one batch (used when SINGLE_BATCH)
print(f"Model hash {MODEL_HASH}. First batch: OG {b0['og']}, FG {b0['fg']}, ferment {b0['ferment_h'] / 24:.1f} days, "
      f"pitch {b0['pitch']:.1f} F, onset {b0['onset']:.0f} h, band {b0['band_mid'] - TEMP_BAND_F / 2:.1f}-{b0['band_mid'] + TEMP_BAND_F / 2:.1f} F")
''')

code('''
# Optional preview: first three batches (no IoT Hub traffic)
try:
    import matplotlib.pyplot as plt
    while len(_batches) < (1 if SINGLE_BATCH else 3):
        batch_at(_batches[-1]["end_h"] if _batches else 0)
    end_h = _batches[-1]["active_h"] if SINGLE_BATCH else _batches[-1]["end_h"]
    step = max(1, int(900 / INTERVAL_SECONDS))
    seqs = range(0, int(end_h * 3600 / INTERVAL_SECONDS), step)
    data = [reading(i) for i in seqs]
    days = [i * INTERVAL_SECONDS / 86400 for i in seqs]
    fig, ax = plt.subplots(2, 1, figsize=(11, 5), sharex=True)
    ax[0].plot(days, [d[0] for d in data]); ax[0].set_ylabel("gravity (points)")
    ax[1].plot(days, [d[1] * 9 / 5 + 32 for d in data]); ax[1].set_ylabel("temp F"); ax[1].set_xlabel("days")
    plt.show()
except Exception as e:
    print("Preview skipped:", e)
''')

code('''
# ---- Checkpoint helpers ----

def _checkpoint_path():
    if CHECKPOINT_DIR:
        base = CHECKPOINT_DIR
    elif os.path.isdir("/lakehouse/default/Files"):
        base = "/lakehouse/default/Files/checkpoints"
    else:
        try:
            base = os.path.join(notebookutils.nbResPath, "builtin")
        except NameError:
            base = os.path.abspath("checkpoints")
        print(f"WARNING: no default lakehouse attached; checkpointing to {base}")
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, f"tilt_simulator_{RUN_ID}.json")


CHECKPOINT_PATH = _checkpoint_path()


def load_checkpoint():
    try:
        with open(CHECKPOINT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def save_checkpoint(cp):
    cp["updated_utc"] = datetime.now(timezone.utc).isoformat()
    tmp = CHECKPOINT_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cp, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    try:
        os.replace(tmp, CHECKPOINT_PATH)
    except OSError:
        with open(CHECKPOINT_PATH, "w", encoding="utf-8") as f:
            json.dump(cp, f, indent=2)


def init_checkpoint():
    cp = None if RESET_CHECKPOINT else load_checkpoint()
    if cp:
        if cp.get("model_hash") != MODEL_HASH:
            raise ValueError("Model parameters changed since this checkpoint was written. "
                             "Use a new RUN_ID or set RESET_CHECKPOINT = True.")
        print(f"Resuming run '{RUN_ID}' at seq {cp['next_seq']} "
              f"(start {cp['start_time']}, {cp['total_sent']} events sent, last checkpoint {cp.get('updated_utc')})")
        return cp
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start = now - timedelta(hours=BATCH_ELAPSED_HOURS)
    cp = {"run_id": RUN_ID, "model_hash": MODEL_HASH, "start_time": start.isoformat(),
          "next_seq": 0, "total_sent": 0, "last_eventtime": None, "status": "running"}
    save_checkpoint(cp)
    print(f"Started new run '{RUN_ID}' at {cp['start_time']} ({BATCH_ELAPSED_HOURS} h already elapsed)")
    return cp


print("Checkpoint file:", CHECKPOINT_PATH)
''')

code('''
# ---- Backfill: write the already-elapsed history straight into the Eventhouse ----

def _kusto_token():
    try:
        return notebookutils.credentials.getToken(KUSTO_QUERY_URI)
    except NameError:
        return os.environ["KUSTO_TOKEN"]


def _ingest(rows):
    csv = "\\n".join(f"{r['eventtime']},{r['gravity']},{r['temp']}" for r in rows)
    csl = f".ingest inline into table {KUSTO_TABLE} with (format='csv') <|\\n{csv}"
    if DRY_RUN:
        print(f"DRY RUN ingest {len(rows)} rows {rows[0]['eventtime']} .. {rows[-1]['eventtime']}")
        return
    import requests
    resp = requests.post(f"{KUSTO_QUERY_URI}/v1/rest/mgmt",
                         headers={"Authorization": f"Bearer {_kusto_token()}", "Content-Type": "application/json"},
                         json={"db": KUSTO_DATABASE, "csl": csl}, timeout=120)
    resp.raise_for_status()


def fast_forward(cp):
    # Events whose time has already passed (a mid-batch start, or downtime since the checkpoint) are written
    # straight to the Eventhouse, then the checkpoint jumps to "now" so live sending resumes from there.
    start_time = datetime.fromisoformat(cp["start_time"])
    due = int((datetime.now(timezone.utc) - start_time).total_seconds() // INTERVAL_SECONDS) + 1
    if SINGLE_BATCH:
        due = min(due, TOTAL_EVENTS)
    gap = due - cp["next_seq"]
    if gap < FAST_FORWARD_MIN_EVENTS or BACKFILL_TARGET == "iothub":
        return
    if BACKFILL_TARGET == "none":
        cp["next_seq"] = due
        save_checkpoint(cp)
        print(f"Skipped {gap} elapsed events (BACKFILL_TARGET = none)")
        return
    print(f"Fast-forwarding {gap} events ({gap * INTERVAL_SECONDS / 3600:.1f} h) straight into {KUSTO_DATABASE}.{KUSTO_TABLE}")
    seq = cp["next_seq"]
    while seq < due:
        end = min(seq + BACKFILL_CHUNK, due)
        _ingest([make_event(start_time, s) for s in range(seq, end)])
        seq = end
        cp["next_seq"] = seq
        save_checkpoint(cp)
    print(f"Fast-forward complete; resuming live at seq {cp['next_seq']}")
''')

code('''
# ---- IoT Hub sender ----

def resolve_connection_string():
    if IOTHUB_CONNECTION_STRING:
        return IOTHUB_CONNECTION_STRING
    if os.environ.get("IOTHUB_CONNECTION_STRING"):
        return os.environ["IOTHUB_CONNECTION_STRING"]
    if KEY_VAULT_URL and KEY_VAULT_SECRET_NAME:
        return notebookutils.credentials.getSecret(KEY_VAULT_URL, KEY_VAULT_SECRET_NAME)
    raise ValueError("No IoT Hub connection string: set IOTHUB_CONNECTION_STRING, "
                     "the IOTHUB_CONNECTION_STRING env var, or KEY_VAULT_URL + KEY_VAULT_SECRET_NAME.")


class IoTHubSender:
    def __init__(self, dry_run, retries=5):
        self.dry_run = dry_run
        self.retries = retries
        self.client = None
        self.conn_str = None if dry_run else resolve_connection_string()

    def _connect(self):
        from azure.iot.device import IoTHubDeviceClient
        self.client = IoTHubDeviceClient.create_from_connection_string(self.conn_str)
        self.client.connect()

    def send(self, events, message_id):
        body = json.dumps(events)
        if self.dry_run:
            print("DRY RUN", message_id, body)
            return
        from azure.iot.device import Message
        msg = Message(body)
        msg.message_id = message_id
        msg.content_encoding = "utf-8"
        msg.content_type = "application/json"
        for attempt in range(1, self.retries + 1):
            try:
                if self.client is None:
                    self._connect()
                self.client.send_message(msg)
                return
            except Exception as e:
                print(f"send attempt {attempt}/{self.retries} failed: {e}")
                self.close()
                if attempt == self.retries:
                    raise
                time.sleep(min(30, 2 ** attempt))

    def close(self):
        if self.client is not None:
            try:
                self.client.shutdown()
            except Exception:
                pass
            self.client = None
''')

code('''
# ---- Simulation loop (resumable) ----

def run_simulation():
    cp = init_checkpoint()
    fast_forward(cp)
    start_time = datetime.fromisoformat(cp["start_time"])
    sender = IoTHubSender(DRY_RUN)

    deadline = time.monotonic() + MAX_RUNTIME_MINUTES * 60 if MAX_RUNTIME_MINUTES else None
    anchor = None            # (monotonic, event_time) used to pace events against the wall clock
    seq = cp["next_seq"]
    pending, first_seq, sent_this_run = [], None, 0

    def flush():
        nonlocal pending, first_seq, sent_this_run
        if not pending:
            return
        sender.send(pending, f"{RUN_ID}-{first_seq}")
        cp["next_seq"] = first_seq + len(pending)
        cp["total_sent"] += len(pending)
        cp["last_eventtime"] = pending[-1]["eventtime"]
        save_checkpoint(cp)
        sent_this_run += len(pending)
        pending, first_seq = [], None

    try:
        while True:
            if SINGLE_BATCH and seq >= TOTAL_EVENTS:
                print("Batch complete.")
                break
            if MAX_EVENTS is not None and sent_this_run + len(pending) >= MAX_EVENTS:
                break
            if deadline is not None and time.monotonic() >= deadline:
                break

            ev_time = start_time + timedelta(seconds=seq * INTERVAL_SECONDS)
            backlog = CATCH_UP and ev_time <= datetime.now(timezone.utc)
            if backlog:
                if CATCH_UP_PAUSE_SECONDS:
                    time.sleep(CATCH_UP_PAUSE_SECONDS)
            else:
                if anchor is None:
                    anchor = (time.monotonic(), ev_time)
                due = anchor[0] + (ev_time - anchor[1]).total_seconds() / SPEED_FACTOR
                if deadline is not None and due >= deadline:
                    break
                time.sleep(max(0.0, due - time.monotonic()))

            if first_seq is None:
                first_seq = seq
            pending.append(make_event(start_time, seq))
            seq += 1
            if len(pending) >= BATCH_SIZE:
                flush()
    finally:
        try:
            flush()
        finally:
            sender.close()
            cp["status"] = "completed" if SINGLE_BATCH and cp["next_seq"] >= TOTAL_EVENTS else "stopped"
            save_checkpoint(cp)
            print(f"Stopped. Sent {sent_this_run} events this run; next_seq={cp['next_seq']}, "
                  f"total_sent={cp['total_sent']}, last_eventtime={cp['last_eventtime']}")


run_simulation()
''')

LAKEHOUSE = {}  # publish_notebook.py attaches the default lakehouse
nb = {
    "nbformat": 4, "nbformat_minor": 5,
    "metadata": {
        "language_info": {"name": "python"},
        "kernel_info": {"name": "jupyter"},
        "kernelspec": {"name": "jupyter", "display_name": "Jupyter"},
        "microsoft": {"language": "python", "language_group": "jupyter_python"},
        "dependencies": {"lakehouse": LAKEHOUSE},
    },
    "cells": cells,
}
out = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).with_name("TiltEvent-Simulator.ipynb"))
json.dump(nb, open(out, "w", encoding="utf-8"), indent=1)
print("wrote", out)

# Optional: also write the code cells as a plain .py for local dry-run testing (DRY_RUN = True).
if len(sys.argv) > 2:
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        for c in cells:
            if c["cell_type"] == "code":
                src = "".join(c["source"])
                if src.startswith("%pip"):
                    continue
                f.write(src + "\n\n")
