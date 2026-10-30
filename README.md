# BrewIQ

**Take the guesswork out of small-batch fermentation.**

For most hobbyist beer, wine and cider makers, fermentation is a "cross your fingers and hope for the best" step. You pitch the yeast, put the lid on, and find out weeks later whether it worked. Low-cost IoT devices such as the Tilt hydrometer change that: they report gravity and temperature continuously, which shows what the batch is doing.

BrewIQ turns that data into something a brewer can act on:

- **Live view of every batch.** Gravity and temperature charts, status and progress for each running fermentation.
- **AI batch analysis.** An **Analyze** button on the batch page opens a side drawer next to the charts. A Foundry agent grounded in a brewing playbook, BJCP style ranges and your yeast library reviews the batch history and recommends what to do next.
- **Warning highlights.** Stat cards turn amber or red when temperature, gravity or attenuation leave the range expected for the batch's yeast and recipe.
- **Recipe advisor.** On the New Batch screen, chat to get help choosing what to brew, grounded in your recipe and yeast libraries plus openly licensed public sources (PubMed Central, Wikipedia).
- **Corrective recommendations** *(partly done)*. The analyst and highlights cover this today; rule-based anomaly detection and alerts are still planned.
- **A library of batches and recipes.** Every batch is kept with its recipe, yeast and readings, so you can compare past brews and repeat the good ones. Recipes can be imported from a product page or PDF, and the yeast library carries vendor temperature and attenuation specs.

## What you need

**Required**
1. **A Tilt hydrometer** ([tilthydrometer.com](https://tilthydrometer.com/)): a floating Bluetooth sensor that reports specific gravity and temperature from inside the fermenter.
2. **A Raspberry Pi with Bluetooth**: sits within range of the vessel, reads the Tilt's Bluetooth broadcasts and forwards them to Azure IoT Hub as JSON messages (`eventtime`, `gravity`, `temp`). [DataSciNAll/pytiltiot](https://github.com/DataSciNAll/pytiltiot/) covers the Pi setup: it scans for the Tilt and sends the readings to IoT Hub, and includes a systemd service to run it at boot (based on atlefren/pytilt).
3. **A fermentation vessel**: a fermenter large enough for your batch that the Tilt can float in.

**Optional**
- **A way to control fermentation temperature.** The author uses a small refrigerator with an [Inkbird temperature controller](https://www.inkbird.com/collections/temperature-controllers).

No hardware yet? The `TiltEvent-Simulator` notebook generates realistic Tilt events, so you can run and try the whole solution without a Tilt or a Pi.

> The Pi-side forwarder is not part of this repo; use [pytiltiot](https://github.com/DataSciNAll/pytiltiot/) and point it at your IoT Hub device (the simulator uses `tiltsim`). Make sure the messages are JSON with a JSON content type and the fields `eventtime`, `gravity` and `temp`, or the eventstream will drop them. The simulator sends the same message shape.

## How it's built

Built on Azure and Microsoft Fabric. A Tilt hydrometer (or the included simulator) sends gravity and temperature to IoT Hub; an eventstream lands the events in an Eventhouse; a Power BI semantic model exposes them to a Rayfin (Fabric Apps) web app that manages batches, recipes and yeasts.

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
| `tools/` | Yeast scrapers/seed generator, history generator, import test runner, `foundry_agent/` (analyst and advisor agents, knowledge files), `analysis_eval/` (analyst benchmark) |

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
3. **Provision.** `python infra/provision.py all` (add `--capacity` to create the Fabric capacity). This creates the IoT Hub, device and consumer group; the Foundry resource, `brewiq` project and `brewiq-analyst` model deployment (and grants you the `Foundry User` and `Cognitive Services OpenAI User` roles, then points the `analyzeBatch` function at it); the analyst and recipe-advisor agents with their knowledge vector stores; the workspace, lakehouse, Eventhouse and `TiltEvents` table; the Fabric IoT Hub connection and eventstream; the two notebooks; and imports the semantic model, pointing it at the new Eventhouse and writing its ids into `brewiq-app/rayfin/rayfin.yml`. It is safe to re-run; existing items are skipped. The script prints the resulting ids at the end.
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
- The Foundry agents (`brewiq-analyst-agent`, `brewiq-advisor-agent`) are created by `python infra/provision.py agent` (part of `all`); if the agent is unavailable the analyst falls back to the plain model deployment. Model quota (GlobalStandard `gpt-6.1-terra`) must be available in the region.

## Day-to-day development
```
cd brewiq-app
npm run dev          # local services + frontend
npm run test         # unit tests
npx rayfin up --workspace BrewIQ    # redeploy
```
Never commit secrets: the device connection string and Kusto URI are injected at notebook publish time only.
