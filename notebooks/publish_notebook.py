"""Publishes an .ipynb to a Fabric workspace (create or update by display name).

Binds the default lakehouse, and can override top-level parameter assignments in the notebook,
e.g. --set KUSTO_QUERY_URI=https://... replaces the line `KUSTO_QUERY_URI = "..."`.
Secrets passed with --set exist only in the published item, never in the repo.

Usage:
  python publish_notebook.py --workspace-id <id> --lakehouse-id <id> --name TiltEvent-Simulator \
      --file tilt_simulator/TiltEvent-Simulator.ipynb --set KUSTO_QUERY_URI=https://...
"""
import argparse
import base64
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "infra"))
from fabric_api import FABRIC, call, list_all, wait_operation  # noqa: E402


def apply_overrides(nb, overrides):
    for key, value in overrides.items():
        pattern = re.compile(rf"^({re.escape(key)}\s*=\s*).*$", re.M)
        hit = False
        for cell in nb["cells"]:
            if cell["cell_type"] != "code":
                continue
            src = "".join(cell["source"])
            new = pattern.sub(lambda m: m.group(1) + json.dumps(value), src, count=1)
            if new != src:
                cell["source"] = new.splitlines(True)
                hit = True
                break
        if not hit:
            sys.exit(f"Parameter {key} not found in the notebook.")


def publish(workspace_id, lakehouse_id, lakehouse_name, name, file, overrides=None):
    nb = json.loads(Path(file).read_text(encoding="utf-8"))
    nb.setdefault("metadata", {})["dependencies"] = {
        "lakehouse": {
            "default_lakehouse": lakehouse_id,
            "default_lakehouse_name": lakehouse_name,
            "default_lakehouse_workspace_id": workspace_id,
            "known_lakehouses": [{"id": lakehouse_id}],
        }
    }
    apply_overrides(nb, overrides or {})
    parts = [{
        "path": "notebook-content.ipynb",
        "payload": base64.b64encode(json.dumps(nb).encode()).decode(),
        "payloadType": "InlineBase64",
    }]
    existing = [i for i in list_all(f"/workspaces/{workspace_id}/items?type=Notebook") if i["displayName"] == name]
    if existing:
        nid = existing[0]["id"]
        status, headers, body = call("POST", f"{FABRIC}/workspaces/{workspace_id}/notebooks/{nid}/updateDefinition",
                                     {"definition": {"format": "ipynb", "parts": parts}})
    else:
        status, headers, body = call("POST", f"{FABRIC}/workspaces/{workspace_id}/items",
                                     {"displayName": name, "type": "Notebook",
                                      "definition": {"format": "ipynb", "parts": parts}})
    if status not in (200, 201, 202):
        sys.exit(f"Publishing {name} failed ({status}): {body}")
    if status == 202:
        wait_operation(headers)
    nid = [i for i in list_all(f"/workspaces/{workspace_id}/items?type=Notebook") if i["displayName"] == name][0]["id"]
    print(f"{'updated' if existing else 'created'} notebook {name} ({nid})")
    return nid


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--workspace-id", required=True)
    p.add_argument("--lakehouse-id", required=True)
    p.add_argument("--lakehouse-name", default="BrewIQLakehouse")
    p.add_argument("--name", required=True)
    p.add_argument("--file", required=True)
    p.add_argument("--set", action="append", default=[], metavar="KEY=VALUE")
    a = p.parse_args()
    publish(a.workspace_id, a.lakehouse_id, a.lakehouse_name, a.name, a.file,
            dict(kv.split("=", 1) for kv in a.set))
