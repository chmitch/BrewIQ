# BrewIQ

Homebrew fermentation analytics on Azure and Microsoft Fabric. A Tilt hydrometer (or the included simulator) sends gravity and temperature to IoT Hub; an eventstream lands the events in an Eventhouse; a Power BI semantic model exposes them to a Rayfin (Fabric Apps) web app that manages batches, recipes and yeasts.

```
Tilt / simulator -> IoT Hub -> Eventstream -> Eventhouse (TiltEvents) -> Semantic model (BrewEvents) -> Rayfin app
```

See [architecture.md](architecture.md) for structure, key decisions, gotchas, pending ideas and known issues.

## Repository layout

| Folder | Contents |
|---|---|
| `brewiq-app/` | The Rayfin app (React frontend, data entities, `rayfin/rayfin.yml`) |
| `infra/` | Idempotent provisioning (`provision.py`), config, eventstream template, KQL |
| `models/BrewEvents/` | The semantic model `.pbix` (parameters `KustoQueryUri`, `KustoDatabase`) |
| `notebooks/` | Notebook builders (simulator, recipe import) and the publisher |
| `tools/` | Yeast scrapers/seed generator, history generator, import test runner |

## Initial deployment

### Prerequisites
- Azure subscription and a Fabric capacity you can assign to a workspace (or rights to create one; capacities bill while running).
- Python 3.10+, a current Node.js LTS, Azure CLI.
- Azure CLI extensions: `az extension add -n azure-iot` (and `-n microsoft-fabric` if creating a capacity).
- Rayfin CLI access (`npx rayfin`), and Fabric tenant settings that allow Fabric Apps.
- Sign in: `az login --tenant <tenant-id>` and `az account set -s <subscription-id>`.

### Steps
1. **Configure.** Edit `infra/config.json` (resource group, region, IoT Hub, capacity, workspace names). Set `prefix` to something unique to you; it is applied to the globally unique names (IoT Hub, capacity). Non-secret values only.
2. **Preview.** `python infra/provision.py all --dry-run`
3. **Provision.** `python infra/provision.py all` (add `--capacity` to create the Fabric capacity). This creates the IoT Hub, device and consumer group; the workspace, lakehouse, Eventhouse and `TiltEvents` table; the Fabric IoT Hub connection and eventstream; the two notebooks; and imports the semantic model, pointing it at the new Eventhouse and writing its ids into `brewiq-app/rayfin/rayfin.yml`. It is safe to re-run; existing items are skipped. The script prints the resulting ids at the end.
4. **Deploy the app.**
   ```
   cd brewiq-app
   npm install
   npx rayfin up --workspace BrewIQ     # ~5 minutes; prints the app URL
   ```
5. **Feed data (optional).** Run the `TiltEvent-Simulator` notebook in the workspace, or point a real Tilt at the `tiltsim` device. Messages must have a JSON content type or the eventstream drops them.

Details and options are in [infra/README.md](infra/README.md).

### Not scripted yet
- Creating the Rayfin app backend itself is done by `rayfin up`.
- The semantic model's refresh/credential uses your user token, so re-run `python infra/provision.py model` if it expires.
- Foundry/agent resources are out of scope.

## Day-to-day development
```
cd brewiq-app
npm run dev          # local services + frontend
npm run test         # unit tests
npx rayfin up --workspace BrewIQ    # redeploy
```
Never commit secrets: the device connection string and Kusto URI are injected at notebook publish time only.
