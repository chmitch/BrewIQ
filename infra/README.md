# BrewIQ infrastructure

Idempotent provisioning for everything the Rayfin app depends on (not the app itself).

Prerequisites: Python 3.10+, Azure CLI signed in (`az login`) with the `azure-iot` extension; for `--capacity`, the `microsoft-fabric` extension.

```
python provision.py all --dry-run     # show what would be created
python provision.py all               # azure + fabric + notebooks
python provision.py azure|fabric|notebooks
python provision.py all --capacity    # also create the Fabric capacity (billing!)
```

Edit `config.json` to change names (non-secret only). **Set `prefix` (or pass `--prefix <x>`) to something unique to you before running in a new subscription**: it is prepended to the globally unique names (IoT Hub, Fabric capacity; the Fabric connection reuses the hub name). Other names (resource group, workspace, items) only need to be unique within your own scope. IoT Hub F1 is limited to one per subscription; change `iotHub.sku` if one exists. Steps: resource group, IoT Hub, device, consumer group → workspace, lakehouse, Eventhouse/KQL DB, `TiltEvents` table (`tilt-events.kql`), Fabric IoT Hub connection, eventstream (`eventstream.template.json`) → notebooks (simulator gets the Kusto URI and device connection string injected at publish time; they are never stored in the repo).

Each step checks for existing resources first. The script prints the resulting ids; export `BREWIQ_WORKSPACE_ID`, `BREWIQ_LAKEHOUSE_ID`, `KUSTO_URI` for the helpers in `tools/`.

## Manual steps
1. `python provision.py model` imports `models/BrewEvents/BrewEvents.pbix` (parameters `KustoQueryUri`, `KustoDatabase`), sets them to the new Eventhouse, sets the OAuth2 credential and updates the ids in `brewiq-app/rayfin/rayfin.yml`. It is part of `all`. If you change the model, re-save the pbix with those parameters intact.
2. Deploy the app: `cd brewiq-app && npx rayfin up --workspace BrewIQ`
3. Start the simulator notebook in Fabric to feed live data (optional).
