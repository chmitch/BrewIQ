"""Small helpers over the Azure CLI and the Fabric / Kusto REST APIs (stdlib only).

Authentication is always the signed-in `az` user: run `az login` first.
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

FABRIC = "https://api.fabric.microsoft.com/v1"


def az(*args, check=False):
    """Runs the Azure CLI. Returns (returncode, stdout). shell=True so az.cmd resolves on Windows."""
    cmd = " ".join(f'"{a}"' if (" " in a or any(c in a for c in "{}[]|&")) else a for a in args)
    r = subprocess.run(f"az {cmd}", capture_output=True, text=True, shell=True)
    if check and r.returncode != 0:
        sys.exit(f"az {cmd}\n{r.stderr.strip()}")
    return r.returncode, r.stdout.strip()


def token(resource):
    rc, out = az("account", "get-access-token", "--resource", resource, "--query", "accessToken", "-o", "tsv")
    if rc != 0 or not out:
        sys.exit("Not signed in to the Azure CLI. Run `az login` and try again.")
    return out


def call(method, url, body=None, tok=None, resource="https://api.fabric.microsoft.com"):
    """Returns (status, headers, parsed_json_or_text)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": "Bearer " + (tok or token(resource)), "Content-Type": "application/json"},
    )
    try:
        r = urllib.request.urlopen(req, timeout=120)
        status, headers, raw = r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        status, headers, raw = e.code, dict(e.headers), e.read().decode()
    try:
        return status, headers, json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return status, headers, raw


def wait_operation(headers, timeout=300):
    """Waits for a Fabric long-running operation (HTTP 202 + Location header)."""
    loc = headers.get("Location")
    if not loc:
        return {"status": "Succeeded"}
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(int(headers.get("Retry-After", 3)))
        _, h, j = call("GET", loc)
        if isinstance(j, dict) and j.get("status") in ("Succeeded", "Failed"):
            if j["status"] == "Failed":
                sys.exit(f"Fabric operation failed: {json.dumps(j.get('error') or j)[:500]}")
            return j
    sys.exit("Timed out waiting for a Fabric operation.")


def list_all(path):
    """Follows continuation tokens for a Fabric list endpoint."""
    out, url = [], f"{FABRIC}{path}"
    while url:
        s, _, j = call("GET", url)
        if s != 200:
            sys.exit(f"GET {path} failed ({s}): {j}")
        out += j.get("value", [])
        url = j.get("continuationUri")
    return out


def kusto(query_uri, database, csl, management=False):
    """Runs a Kusto query (or management command when management=True) against an Eventhouse database."""
    path = "/v1/rest/mgmt" if management else "/v2/rest/query"
    s, _, j = call("POST", query_uri + path, {"db": database, "csl": csl}, tok=token(query_uri))
    if s != 200:
        sys.exit(f"Kusto request failed ({s}): {str(j)[:500]}")
    return j
