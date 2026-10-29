"""Idempotently provisions everything the BrewIQ Rayfin app depends on (except the app itself).

Usage: python provision.py [azure|foundry|fabric|notebooks|model|all] [--capacity] [--dry-run]

Every step checks for an existing resource first, so re-running is safe.
Secrets (IoT keys) are fetched at run time and never written to disk.
Manual steps (semantic model, rayfin.yml, rayfin up) are printed at the end.
"""
import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path

import re
import time

from fabric_api import FABRIC, az, call, kusto, list_all, token, wait_operation

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CFG = json.loads((HERE / "config.json").read_text())
DRY = False


def apply_prefix(prefix):
    """Prefixes the names that must be globally unique (IoT Hub, Fabric capacity, Foundry resource) plus the resource group; the Fabric connection reuses the hub name."""
    if prefix and not re.fullmatch(r"[a-z0-9]{1,12}", prefix):
        sys.exit("prefix must be 1-12 lowercase letters or digits")
    CFG["resourceGroup"] = prefix + CFG["resourceGroup"]
    CFG["iotHub"]["name"] = prefix + CFG["iotHub"]["name"]
    CFG["capacity"]["name"] = prefix + CFG["capacity"]["name"]
    CFG["foundry"]["name"] = prefix + CFG["foundry"]["name"]
    CFG["fabricConnection"] = CFG["iotHub"]["name"]


def say(msg):
    print(("[dry-run] " if DRY else "") + msg)


def azure():
    rg, loc, hub = CFG["resourceGroup"], CFG["location"], CFG["iotHub"]
    if az("group", "show", "-n", rg)[0] != 0:
        say(f"create resource group {rg}")
        if not DRY:
            az("group", "create", "-n", rg, "-l", loc, check=True)
    if az("iot", "hub", "show", "-n", hub["name"], "-g", rg)[0] != 0:
        say(f"create IoT Hub {hub['name']} ({hub['sku']})")
        if not DRY:
            az("iot", "hub", "create", "-n", hub["name"], "-g", rg, "-l", loc, "--sku", hub["sku"], check=True)
    if az("iot", "hub", "device-identity", "show", "-n", hub["name"], "-d", hub["device"])[0] != 0:
        say(f"create device {hub['device']}")
        if not DRY:
            az("iot", "hub", "device-identity", "create", "-n", hub["name"], "-d", hub["device"], check=True)
    rc, out = az("iot", "hub", "consumer-group", "list", "--hub-name", hub["name"], "--query", "[].name", "-o", "tsv")
    if hub["consumerGroup"] not in out.split():
        say(f"create consumer group {hub['consumerGroup']}")
        if not DRY:
            az("iot", "hub", "consumer-group", "create", "--hub-name", hub["name"], "--name", hub["consumerGroup"], check=True)


def capacity():
    c, rg = CFG["capacity"], CFG["resourceGroup"]
    if az("fabric", "capacity", "show", "-n", c["name"], "-g", rg)[0] == 0:
        return
    say(f"create Fabric capacity {c['name']} ({c['sku']}); requires `az extension add -n microsoft-fabric`")
    if not DRY:
        az("fabric", "capacity", "create", "-n", c["name"], "-g", rg, "-l", CFG["location"],
           "--sku", f'{{"name":"{c["sku"]}","tier":"Fabric"}}',
           "--administration", f'{{"members":["{c["admin"]}"]}}', check=True)


def find(items, name):
    return next((i for i in items if i["displayName"] == name), None)


def create_item(ws, kind, name, path, extra=None):
    """Find-or-create a Fabric item by display name via its typed endpoint."""
    items = list_all(f"/workspaces/{ws}/{path}")
    hit = find(items, name)
    if hit:
        return hit
    say(f"create {kind} {name}")
    if DRY:
        return {"id": "<dry-run>", "displayName": name}
    s, h, b = call("POST", f"{FABRIC}/workspaces/{ws}/{path}", {"displayName": name, **(extra or {})})
    if s == 202:
        wait_operation(h)
    elif s not in (200, 201):
        sys.exit(f"create {kind} failed ({s}): {b}")
    return find(list_all(f"/workspaces/{ws}/{path}"), name)


def fabric():
    """Returns a dict of ids for later steps."""
    wsname = CFG["workspace"]
    ws = find(list_all("/workspaces"), wsname)
    if not ws:
        cap = find(list_all("/capacities"), CFG["capacity"]["name"])
        if not cap:
            sys.exit(f"Fabric capacity {CFG['capacity']['name']} not found (use --capacity to create it).")
        say(f"create workspace {wsname} on capacity {cap['displayName']}")
        if DRY:
            return {}
        s, _, b = call("POST", f"{FABRIC}/workspaces", {"displayName": wsname, "capacityId": cap["id"]})
        if s not in (200, 201):
            sys.exit(f"create workspace failed ({s}): {b}")
        ws = b
    wid = ws["id"]
    lh = create_item(wid, "lakehouse", CFG["lakehouse"], "lakehouses")
    eh = create_item(wid, "eventhouse", CFG["eventhouse"], "eventhouses")
    # An Eventhouse comes with a KQL database of the same name.
    db = find(list_all(f"/workspaces/{wid}/kqlDatabases"), CFG["eventhouse"])
    if not db:
        sys.exit("KQL database not found; wait for the Eventhouse to finish provisioning and re-run.")
    _, _, dbd = call("GET", f"{FABRIC}/workspaces/{wid}/kqlDatabases/{db['id']}")
    quri = dbd["properties"]["queryServiceUri"]
    say(f"ensure table {CFG['kqlTable']}")
    if not DRY:
        kusto(quri, db["displayName"], (HERE / "tilt-events.kql").read_text().strip(), management=True)

    ids = {"workspace": wid, "lakehouse": lh["id"], "eventhouse": eh["id"], "kqlDatabase": db["id"], "queryUri": quri}
    conn = ensure_connection()
    ensure_eventstream(ids, conn)
    return ids


def ensure_connection():
    name, hub = CFG["fabricConnection"], CFG["iotHub"]
    hit = find(list_all("/connections"), name)
    if hit:
        return hit["id"]
    say(f"create Fabric connection {name}")
    if DRY:
        return "<dry-run>"
    rc, key = az("iot", "hub", "policy", "show", "-n", hub["servicePolicy"], "--hub-name", hub["name"],
                 "--query", "primaryKey", "-o", "tsv")
    if rc != 0:
        sys.exit("Could not read the IoT Hub service policy key.")
    body = {
        "connectivityType": "ShareableCloud",
        "displayName": name,
        "privacyLevel": "Organizational",
        "connectionDetails": {
            "type": "IoTHub",
            "creationMethod": "IoTHub.Contents",
            "parameters": [{"dataType": "Text", "name": "entityPath", "value": hub["name"]}],
        },
        "credentialDetails": {
            "singleSignOnType": "None",
            "connectionEncryption": "NotEncrypted",
            "skipTestConnection": False,
            "credentials": {"credentialType": "Basic", "username": hub["servicePolicy"], "password": key},
        },
    }
    s, _, b = call("POST", f"{FABRIC}/connections", body)
    if s not in (200, 201):
        sys.exit(f"create connection failed ({s}): {str(b)[:400]}")
    return b["id"]


def ensure_eventstream(ids, conn_id):
    wid, name = ids["workspace"], CFG["eventstream"]
    if find(list_all(f"/workspaces/{wid}/eventstreams"), name):
        return
    say(f"create eventstream {name}")
    if DRY:
        return
    text = (HERE / "eventstream.template.json").read_text()
    for k, v in {"CONNECTION_ID": conn_id, "CONSUMER_GROUP": CFG["iotHub"]["consumerGroup"],
                 "EVENTHOUSE": CFG["eventhouse"], "WORKSPACE_ID": wid, "KQL_DATABASE_ID": ids["kqlDatabase"],
                 "KQL_TABLE": CFG["kqlTable"], "EVENTSTREAM": name}.items():
        text = text.replace("{{" + k + "}}", v)
    b64 = lambda s: base64.b64encode(s.encode()).decode()  # noqa: E731
    platform = {"$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
                "metadata": {"type": "Eventstream", "displayName": name},
                "config": {"version": "2.0", "logicalId": "00000000-0000-0000-0000-000000000000"}}
    parts = [
        {"path": "eventstream.json", "payload": b64(text), "payloadType": "InlineBase64"},
        {"path": "eventstreamProperties.json",
         "payload": b64(json.dumps({"retentionTimeInDays": 1, "eventThroughputLevel": "Low"})), "payloadType": "InlineBase64"},
        {"path": ".platform", "payload": b64(json.dumps(platform)), "payloadType": "InlineBase64"},
    ]
    s, h, b = call("POST", f"{FABRIC}/workspaces/{wid}/eventstreams",
                   {"displayName": name, "definition": {"parts": parts}})
    if s == 202:
        wait_operation(h)
    elif s not in (200, 201):
        sys.exit(f"create eventstream failed ({s}): {str(b)[:400]}")


def notebooks(ids):
    sys.path.insert(0, str(ROOT / "notebooks"))
    from publish_notebook import publish
    nbs = CFG["notebooks"]
    build = ROOT / "notebooks"
    outdir = HERE / ".build"
    outdir.mkdir(exist_ok=True)
    sim, imp = outdir / "sim.ipynb", outdir / "import.ipynb"
    subprocess.run([sys.executable, str(build / "tilt_simulator" / "build_notebook.py"), str(sim)], check=True)
    subprocess.run([sys.executable, str(build / "recipe_import" / "build_notebook.py"), "python", str(imp)], check=True)
    hub = CFG["iotHub"]
    rc, cs = az("iot", "hub", "device-identity", "connection-string", "show", "-n", hub["name"],
                "-d", hub["device"], "--query", "connectionString", "-o", "tsv")
    if rc != 0:
        sys.exit("Could not fetch the device connection string.")
    say("publish notebooks")
    if DRY:
        return
    publish(ids["workspace"], ids["lakehouse"], CFG["lakehouse"], nbs["simulator"], sim, {
        "KUSTO_QUERY_URI": ids["queryUri"], "KUSTO_DATABASE": CFG["eventhouse"],
        "KUSTO_TABLE": CFG["kqlTable"], "IOTHUB_CONNECTION_STRING": cs})
    publish(ids["workspace"], ids["lakehouse"], CFG["lakehouse"], nbs["recipeImport"], imp)


PBI = "https://api.powerbi.com/v1.0/myorg"
PBI_RES = "https://analysis.windows.net/powerbi/api"


def model(ids):
    """Imports the pbix (if missing), points its parameters at the Eventhouse, sets the OAuth2 credential, updates rayfin.yml."""
    import re
    import subprocess
    name, ws = CFG["semanticModel"], ids["workspace"]
    pbix = ROOT / "models" / "BrewEvents" / "BrewEvents.pbix"
    tok = token(PBI_RES)
    hdr = {"Authorization": "Bearer " + tok}
    _, _, j = call("GET", f"{PBI}/groups/{ws}/datasets", tok=tok)
    ds = next((d for d in j["value"] if d["name"] == name), None)
    if not ds:
        say(f"import {pbix.name} as {name}")
        if DRY:
            return
        out = subprocess.run(["curl.exe", "-s", "-X", "POST", "-H", f"Authorization: Bearer {tok}", "-F", f"file=@{pbix}",
                              f"{PBI}/groups/{ws}/imports?datasetDisplayName={name}&nameConflict=Abort"],
                             capture_output=True, text=True).stdout
        imp = json.loads(out)["id"]
        for _ in range(40):
            time.sleep(3)
            _, _, i = call("GET", f"{PBI}/groups/{ws}/imports/{imp}", tok=tok)
            if i["importState"] != "Publishing":
                break
        if i["importState"] != "Succeeded":
            sys.exit(f"pbix import failed: {i}")
        ds = i["datasets"][0]
    say("set model parameters and credential")
    if DRY:
        return
    did = ds["id"]
    s, _, b = call("POST", f"{PBI}/groups/{ws}/datasets/{did}/Default.UpdateParameters", tok=tok, body={
        "updateDetails": [{"name": "KustoQueryUri", "newValue": ids["queryUri"]},
                          {"name": "KustoDatabase", "newValue": CFG["eventhouse"]}]})
    if s != 200:
        sys.exit(f"UpdateParameters failed ({s}): {b}")
    _, _, srcs = call("GET", f"{PBI}/groups/{ws}/datasets/{did}/datasources", tok=tok)
    for src in srcs["value"]:
        cred = {"credentialType": "OAuth2",
                "credentials": json.dumps({"credentialData": [{"name": "accessToken", "value": token(ids["queryUri"])}]}),
                "encryptedConnection": "Encrypted", "encryptionAlgorithm": "None",
                "privacyLevel": "Organizational", "useEndUserOAuth2Credentials": "True"}
        s, _, b = call("PATCH", f"{PBI}/gateways/{src['gatewayId']}/datasources/{src['datasourceId']}",
                       tok=tok, body={"credentialDetails": cred})
        if s != 200:
            sys.exit(f"credential update failed ({s}): {b}")
    yml = ROOT / "brewiq-app" / "rayfin" / "rayfin.yml"
    text = yml.read_text()
    text = re.sub(r"(workspaceId:\s*)[0-9a-f-]{36}", rf"\g<1>{ws}", text)
    text = re.sub(r"(itemId:\s*)[0-9a-f-]{36}", rf"\g<1>{did}", text)
    yml.write_text(text)
    ids["semanticModel"] = did
    print(f"semantic model {name} ready ({did}); rayfin.yml updated")


ARM = "https://management.azure.com"
FOUNDRY_API = "2025-06-01"
FOUNDRY_ROLE = "Cognitive Services OpenAI User"


def arm(method, url, body=None):
    s, _, b = call(method, f"{ARM}{url}", body, resource=ARM)
    return s, b


def foundry():
    """Foundry resource, project and the analyst model deployment, plus the app function's endpoint and the signed-in user's access."""
    f, rg = CFG["foundry"], CFG["resourceGroup"]
    rc, sub = az("account", "show", "--query", "id", "-o", "tsv")
    if rc != 0 or not sub:
        sys.exit("Not signed in to the Azure CLI. Run `az login` and try again.")
    acct = f"/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{f['name']}"

    s, _ = arm("GET", f"{acct}?api-version={FOUNDRY_API}")
    if s == 404:
        say(f"create Foundry resource {f['name']}")
        if not DRY:
            s, b = arm("PUT", f"{acct}?api-version={FOUNDRY_API}", {
                "location": CFG["location"], "kind": "AIServices", "sku": {"name": "S0"},
                "identity": {"type": "SystemAssigned"},
                "properties": {"customSubDomainName": f["name"], "allowProjectManagement": True,
                               "publicNetworkAccess": "Enabled"}})
            if s not in (200, 201):
                sys.exit(f"create Foundry resource failed ({s}): {b}")
            for _ in range(60):
                s, b = arm("GET", f"{acct}?api-version={FOUNDRY_API}")
                state = (b or {}).get("properties", {}).get("provisioningState")
                if state == "Succeeded":
                    break
                if state == "Failed":
                    sys.exit(f"Foundry resource provisioning failed: {b}")
                time.sleep(10)
    elif s != 200:
        sys.exit(f"read Foundry resource failed ({s})")

    s, _ = arm("GET", f"{acct}/projects/{f['project']}?api-version={FOUNDRY_API}")
    if s == 404:
        say(f"create Foundry project {f['project']}")
        if not DRY:
            s, b = arm("PUT", f"{acct}/projects/{f['project']}?api-version={FOUNDRY_API}", {
                "location": CFG["location"], "identity": {"type": "SystemAssigned"}, "properties": {}})
            if s not in (200, 201):
                sys.exit(f"create Foundry project failed ({s}): {b}")

    dep = f"{acct}/deployments/{f['deployment']}?api-version={FOUNDRY_API}"
    s, _ = arm("GET", dep)
    if s == 404:
        say(f"deploy model {f['model']} as {f['deployment']}")
        if not DRY:
            s, b = arm("PUT", dep, {
                "sku": {"name": f["sku"], "capacity": f["capacity"]},
                "properties": {"model": {"format": "OpenAI", "name": f["model"], "version": f["version"]}}})
            if s not in (200, 201, 202):
                sys.exit(f"model deployment failed ({s}): {b}")
            for _ in range(60):
                s, b = arm("GET", dep)
                state = (b or {}).get("properties", {}).get("provisioningState")
                if state == "Succeeded":
                    break
                if state == "Failed":
                    sys.exit(f"model deployment failed: {b}")
                time.sleep(10)

    # The analyzeBatch function calls Foundry as the signed-in user, so each user needs this role.
    rc, me = az("ad", "signed-in-user", "show", "--query", "id", "-o", "tsv")
    if rc == 0 and me:
        rc, have = az("role", "assignment", "list", "--assignee", me, "--scope", acct, "--role", FOUNDRY_ROLE,
                      "--query", "[].id", "-o", "tsv")
        if not have:
            say(f"grant '{FOUNDRY_ROLE}' on {f['name']} to the signed-in user")
            if not DRY:
                az("role", "assignment", "create", "--assignee-object-id", me, "--assignee-principal-type", "User",
                   "--role", FOUNDRY_ROLE, "--scope", acct, check=True)

    path = ROOT / "brewiq-app" / "packages" / "functions" / "src" / "function_app.ts"
    endpoint = f"https://{f['name']}.cognitiveservices.azure.com"
    src = path.read_bytes().decode("utf-8")
    out = re.sub(r"(const FOUNDRY_ENDPOINT = ')[^']*(';)", lambda m: m.group(1) + endpoint + m.group(2), src)
    out = re.sub(r"(const FOUNDRY_DEPLOYMENT = ')[^']*(';)", lambda m: m.group(1) + f["deployment"] + m.group(2), out)
    if out != src:
        say(f"point analyzeBatch at {endpoint} ({f['deployment']})")
        if not DRY:
            path.write_bytes(out.encode("utf-8"))
    print(f"Foundry ready: {endpoint} deployment {f['deployment']}")
    return {"foundryEndpoint": endpoint}


def main():
    global DRY
    p = argparse.ArgumentParser()
    p.add_argument("step", nargs="?", default="all", choices=["azure", "foundry", "fabric", "notebooks", "model", "all"])
    p.add_argument("--capacity", action="store_true", help="also create the Fabric capacity")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--prefix", help="override config.json prefix (lowercase letters/digits)")
    a = p.parse_args()
    DRY = a.dry_run
    apply_prefix(a.prefix if a.prefix is not None else CFG.get("prefix", ""))
    if a.step in ("azure", "all"):
        azure()
    if a.step in ("foundry", "all"):
        foundry()
    if a.capacity:
        capacity()
    ids = {}
    if a.step in ("fabric", "notebooks", "model", "all"):
        ids = fabric()
    if a.step in ("notebooks", "all") and ids:
        notebooks(ids)
    if a.step in ("model", "all") and ids:
        model(ids)
    print("\nIds:", json.dumps(ids, indent=2))
    print("""
Manual steps remaining:
 1. Upload the BrewEvents .pbix to the workspace; point its Eventhouse source at queryUri above and set an OAuth2 SSO credential.
 2. Put the workspace id and semantic-model id in brewiq-app/rayfin/rayfin.yml.
 3. Deploy: cd brewiq-app && npx rayfin up --workspace %s""" % CFG["workspace"])


if __name__ == "__main__":
    main()
