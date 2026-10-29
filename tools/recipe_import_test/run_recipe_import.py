import json, subprocess, sys, time, urllib.request, urllib.error

import os
WS = os.environ["BREWIQ_WORKSPACE_ID"]  # ids are printed by infra/provision.py
LH = os.environ["BREWIQ_LAKEHOUSE_ID"]
NID = sys.argv[1]

URLS = {
    "oatmeal": "https://cdn.shopify.com/s/files/1/2785/6868/files/B12490-Oatmeal-Stout_extract_1_-1769114863212.pdf",
    "imperial": "https://cdn.shopify.com/s/files/1/2785/6868/t/3/assets/ImperialStout-1532544620216.pdf?487624729713520424",
    "irish": "https://cdn.shopify.com/s/files/1/2785/6868/t/3/assets/IrishRedAle-1526946394701.pdf?13778807462096982400",
    "saison": "https://cdn.shopify.com/s/files/1/2785/6868/t/3/assets/PetiteSaisondEte-1526979610344.pdf?14874993540766045429",
    "ipa": "https://cdn.shopify.com/s/files/1/2785/6868/t/3/assets/MosaicIPA-1555507280964.pdf",
    "hefe": "https://cdn.shopify.com/s/files/1/2785/6868/files/1250-Northern-Brewer-Bavarian-Hefeweizen-Instructions_Extract_1_-1728910609440.pdf",
}
only = sys.argv[2:] or list(URLS)


def az(*a):
    return subprocess.run(["az", *a], capture_output=True, text=True, shell=True).stdout.strip()


def call(method, url, body=None, tok=None):
    h = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req)
        return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


ft = az("account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv")
B = f"https://api.fabric.microsoft.com/v1/workspaces/{WS}/items/{NID}/jobs/instances?jobType=RunNotebook"
jobs = {}
t0 = time.time()
for k in only:
    body = {"executionData": {"parameters": {"url": {"value": URLS[k], "type": "string"}, "job_id": {"value": k, "type": "string"}}}}
    s, h, b = call("POST", B, body, ft)
    print(k, "start", s, b[:200] if s != 202 else "")
    if s == 202:
        jobs[k] = h["Location"]

pending = dict(jobs)
while pending and time.time() - t0 < 900:
    time.sleep(10)
    for k, loc in list(pending.items()):
        j = json.loads(call("GET", loc, None, ft)[2])
        if j.get("status") in ("Completed", "Failed", "Cancelled"):
            print(k, j["status"], int(time.time() - t0), "s", json.dumps(j.get("failureReason"))[:300] if j.get("failureReason") else "")
            del pending[k]

st = az("account", "get-access-token", "--resource", "https://storage.azure.com", "--query", "accessToken", "-o", "tsv")
for k in jobs:
    u = f"https://centralus-onelake.dfs.fabric.microsoft.com/{WS}/{LH}/Files/import/{k}.json"
    req = urllib.request.Request(u, headers={"Authorization": "Bearer " + st})
    try:
        d = json.loads(urllib.request.urlopen(req).read())
        open(f"{k}.result.json", "w").write(json.dumps(d, indent=2))
        print(k, d["status"], d.get("error", ""), d.get("trace", "")[-300:] if d["status"] != "ok" else d["recipe"]["name"])
    except Exception as e:
        print(k, "no result", e)
