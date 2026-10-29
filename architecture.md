# BrewIQ architecture

Reference for humans and agents. Read this first; then `brewiq-app\AGENTS.md` (Rayfin scaffold rules) before changing app code.
Keep this file current: update the Decisions, Pending and Known issues sections when you change them.

## 1. What it is

Fermentation in small-batch brewing and winemaking is usually "cross your fingers and hope". Low-cost IoT devices (the Tilt hydrometer) now make detailed, continuous data available. BrewIQ gives the hobbyist:

1. A live view of the metrics (gravity, temperature) for each running batch.
2. Recommended corrective actions for common problems (planned: anomaly and warning detection, stalled or over-run fermentation; see Pending ideas).
3. A library of historical batches and the recipes and yeasts used.

Technically: a Tilt hydrometer (simulated) streams gravity and temperature. A web app tracks brew batches, a shared recipe and yeast library, and per-batch fermentation dashboards.

Owner/user: chmitch. Everything lives in the user's own resources (resource group `cgmbrewiq`, Fabric workspace `BrewIQ`), not in the shared `TiltAnalytics` workspace.

## 2. System overview

```
Tilt device (simulated by Fabric notebook TiltEvent-Simulator)
  -> Azure IoT Hub (cgmbrewiq-iothub, device tiltsim, consumer group tiltstreaming)
  -> Fabric Eventstream BrewIQEventStream (casts types)
  -> Eventhouse BrewIQEventhouse, table TiltEvents (eventtime:datetime, gravity:real, temp:real)
  -> Power BI semantic model BrewEvents (single table; converts temp C -> F, gravity -> SG)
  -> Rayfin app "brewiq" (React/Vite, static hosting + data + functions)
```

Recipe import side path:

```
Rayfin function startImport -> Fabric notebook RecipeImport (fetch PDF, call built-in gpt-5.1)
  -> writes Files/import/<jobId>.json in BrewIQLakehouse
Rayfin function getImport  -> reads that file (404 = still running)
Frontend polls getImport every 5 s, shows a review form, user saves.
```

## 3. Resources

| Thing | Name / id |
|---|---|
| Azure subscription / RG | `<subscription-id>` / `cgmbrewiq` (Central US) |
| Tenant | `<tenant-id>` |
| Fabric capacity | `cgmbrewiq` (F4, Central US). **Billing while active; the user pauses it overnight** |
| Fabric workspace `BrewIQ` | `5b675dd3-ccff-4509-af88-6fb38c1cfad1` |
| Rayfin app item `brewiq` | `3d1ac15d-6dc6-445e-b591-f27dd981623d` |
| Lakehouse `BrewIQLakehouse` | `ab204818-5cf9-45ce-a649-ee68e2e56f45` |
| Notebook `RecipeImport` | `48b4636a-12ba-4eeb-95a4-5b527435aa97` |
| Semantic model `BrewEvents` | `082ed118-ece2-4b7a-9703-0c1a23b210d2` (uploaded as a .pbix) |
| Live app | https://crisp-pond-c9e27b9e4c-centralus.webapp.fabricapps.net |
| Foundry | `cgmbrewiq-foundry` (has a `gpt-4.1-mini` deployment; reserved for a future brew-analysis agent) |

Tenant policies: Cognitive Services key auth is forced off; Key Vault public access is forced off.

## 4. Repository layout

Git root is `C:\projects\BrewIQ`; only `brewiq-app\` is in it, and it is **not yet committed** (untracked).

```
brewiq-app\
  rayfin\rayfin.yml          app config: id, workspace id, data, connectors, functions
  rayfin\connectors\brewevents\   generated semantic-model connector (schema.ts)
  packages\data\src\         Rayfin entities: Batch, Recipe, RecipeIngredient, Yeast
  packages\shared\src\index.ts    shared record types (BatchRecord, RecipeRecord, ...) + schema
  packages\functions\src\function_app.ts   server functions; types.ts is GENERATED
  packages\frontend\src\
    App.tsx                  shell, header nav (Batches | Recipes), view state
    components\              BatchList, BatchDashboard, NewBatchForm, RecipesView,
                             RecipeImport, LibraryPanels (recipe/yeast tabs), states
    hooks\use-batches.ts     batch CRUD + metrics completion
    hooks\use-library.ts     yeasts/recipes/ingredients load, seed, save/update/delete
    lib\                     brew-math, recipe-import(-run), recipe-diff, recipe-image,
                             batch-metrics, yeast-format, rayfin-client
    queries\                 DAX (series, summary) + Vega-Lite specs for the charts
    seed\recipes.ts, yeasts.ts   library seed data (yeasts.ts is generated, do not hand-edit)
    global.css               theme tokens, background pattern
```

Outside `brewiq-app\` (repo root):

```
infra\       provision.py (idempotent: azure|fabric|notebooks|all, --dry-run), config.json, eventstream.template.json,
             tilt-events.kql, fabric_api.py, README.md (manual steps: pbix upload, rayfin.yml ids, rayfin up)
notebooks\   publish_notebook.py (ipynb -> Fabric, binds lakehouse, --set KEY=VALUE injection),
             tilt_simulator\build_notebook.py, recipe_import\build_notebook.py
tools\       recipe_library\ (scrape_*.py, gen_yeasts.py -> seed\yeasts.ts, vendor json),
             history\history_batches.py (needs KUSTO_TOKEN, KUSTO_URI), recipe_import_test\run_recipe_import.py
```

Republish RecipeImport: `python notebooks\recipe_import\build_notebook.py python out.ipynb`, then `publish_notebook.py`
(or `python infra\provision.py notebooks`). Never commit the device connection string or Kusto URI into notebooks; they are injected at publish time.

## 5. Data model (Rayfin, app-owned)

- **Batch**: name, startDate, endDate?, targetOGPoints, yeast (text), `recipeId?`, `yeastId?`, plus final metrics written at completion (og/fg points, abvTenths, attenuationPct, min/max/avg temp tenths °F, readings). `@role` policy: owner-only (`owner_id`).
- **Recipe**: name, style, kit info, ogPoints, abv/ibu tenths, primary days, totalWeeks, `pitchTempMaxTenthsF`, `yeastId?`, timeline, instructions, `sourceUrl` (PDF), `imageUrl`, `productUrl` (vendor page).
- **RecipeIngredient**: `recipeId`, kind (fermentable/hop/yeast/other), name, amount, timing, sortOrder.
- **Yeast**: brand, code, name, form, species, category, flocculation, attenuation min/max %, abvTolerance, temp min/max tenths °F, notes, source, sourceUrl.
- Recipe, RecipeIngredient and Yeast have **no ownership policy**: shared, readable and writable by every signed-in user.
- Units: gravity in points (1.050 = 1050); ABV, IBU, and temperatures in **tenths** (68.4 °F = 684).
- Relationships are loose text ids, not enforced foreign keys.
- Telemetry is not in Rayfin. A batch is only a time window (`startDate`..`endDate`) applied to the telemetry stream.

## 6. Key decisions

1. **Rayfin built-in data layer** for batches and the library; telemetry stays in Eventhouse and is read through the semantic model connector.
2. **ABV and attenuation are computed in the app** (`lib\brew-math.ts`), not in the semantic model. OG is batch-specific and the model has no batch concept; changing the model needs a .pbix re-upload and re-auth. If Power BI later needs them, add model measures and have the app read those instead of keeping two copies.
3. **Temperature**: the device sends °C, the semantic model converts to °F; the app uses °F and does no conversion.
4. **Yeast vendor sites (Fermentis, Wyeast) are authoritative** for yeast target temperatures and attenuation. Recipe imports and updates never create or overwrite yeast data; they only suggest a match from the library (`matchYeasts`, by normalised brand and code).
5. **Images are linked, not copied** (`imageUrl`, https only, max 600 chars, `referrerPolicy="no-referrer"`, hidden on load error). Only `northernbrewer.com` is allowlisted for the product-page reader.
6. **Recipe import**: user pastes a Northern Brewer product page or a PDF link. `readProductPage` (function) finds the PDF and image; the `RecipeImport` notebook extracts the recipe with Fabric's built-in `gpt-5.1`. Notebook + lakehouse file was chosen over a UDF or Key Vault/service-principal route, which were removed (no secrets to manage).
7. **Update from page** (Recipes view) shows a field-by-field diff with checkboxes; nothing is written until Apply. Name and yeast link are never changed by an update. New ingredient lines are created before the old ones are deleted.
8. **Functions** run as the app identity and use `ctx.Tokens.<Audience>` (Fabric, Storage, ...). Function timeout ceiling is 250 s, so long work is polled from the browser.
9. **Simulator** (`TiltEvent-Simulator` v2): deterministic, one batch (`SINGLE_BATCH`), 7-30 day ferments, checkpoints `next_seq` to the lakehouse. After downtime it `fast_forward`s: elapsed events are ingested straight into the Eventhouse (`.ingest inline`) rather than through IoT Hub.
10. **Pipeline constraint**: IoT Hub messages must carry a JSON content type or the eventstream drops them. Ingestion latency is about 5 minutes.
11. **UI**: warm amber "brewery" theme (Fraunces/Inter, light+dark), tiled hop/bubble SVG background, header with segmented Batches/Recipes nav, New batch on its own page. Charts: gravity amber with area fill (y-axis floored at 1.000), temperature copper. Root div must stay transparent or it hides the background.
12. No Key Vault, no extra service principals, everything in `cgmbrewiq`.

## 7. Working on the project (gotchas)

- Validate: from `brewiq-app`: `npm run typecheck` (also validates functions), `npm run lint`, `npm test` (75 tests). If vitest says "Failed to start forks worker" right after lint, rerun.
- Deploy: `npx rayfin up --workspace BrewIQ` (about 5 min, schema changes included). Run it in a background job with a timeout. The capacity must be Active.
- Functions typegen: only via `npx rayfin dev functions apply --no-debug` (needs Azure Functions Core Tools on PATH; takes 60-120 s; kill leftover `func` processes by id). Never hand-edit `types.ts` or cast around the functions client. Body-only changes need no typegen. Don't run `rayfin functions init`.
- Rayfin data client: `data.X.update({id}, patch)` and `data.X.delete({id})`. Omit unset optional fields on create (drop nulls); don't send nulls on update. Use `.first(1000)` when listing.
- Edit tool vs CRLF: entity and shared files use CRLF; use the edit tool for multi-line edits and match whole lines.
- Northern Brewer pages (Shopify, about 1.15 MB) rate-limit this machine (HTTP 429); don't hammer them. `/products/<handle>.js` returns clean JSON including `featured_image` but no PDF link.
- Lint rule `react-hooks/set-state-in-effect` needs a targeted `eslint-disable-next-line`.
- Node 26 gives EBADENGINE warnings but works.
- `rayfin login` needs the keytar keychain module (already approved/rebuilt).
- Connector tests run as the CLI user and don't prove the deployed app can query the model.

## 8. Pending ideas and features (not implemented)

- Manual edit form for recipe fields (OG, pitch temp, etc.) on the Recipes page.
- Group the yeast picker by category.
- Photos of the user's own brews (store in lakehouse `Files` via a function); the kit image would be the fallback.
- Foundry brew-analysis agent using `cgmbrewiq-foundry`.
- Regenerate the simulated history batches from the real recipes.
- Capture vendor specs for kit-only yeasts (Imperial, Omega, Danstar) so they have authoritative temps/attenuation.
- Chart palette tuning beyond the two lines; more detail on the batch dashboard (e.g. hero image).
- Semantic-model measures for ABV/attenuation if a Power BI report needs them.
- **Anomaly detection on running batches**: update the KQL query behind the semantic model to flag anomalous gravity and temperature points (e.g. `series_decompose_anomalies()` or a rolling-median/MAD filter to catch sensor spikes), and surface them on the batch charts.
- **Warning conditions**: rule-based alerts, such as temperature outside the yeast's vendor range for the batch (data already in `yeasts.ts`), rapid temperature swings, or no readings for N hours. Show them on the batch list and dashboard.
- **AI pattern detection and recommendations** (builds on the Foundry agent idea): detect a stalled fermentation (gravity flat well above the expected FG for the yeast's attenuation) and suggest fixes (raise temperature, rouse the yeast, repitch); detect fermentation that has gone far enough and recommend a cold crash. Likely approach: compute features in KQL (slope, time since last change, projected FG), pass them with the recipe and yeast specs to the agent, and show the findings as advice on the batch page. Needs thresholds validated against real batches before trusting recommendations.
- **Simulator fault injection**: add selectable fault scenarios to the `TiltEvent-Simulator` notebook (stalled fermentation, temperature excursion above/below the yeast range, sensor spikes and dropouts, runaway or over-attenuated fermentation) so the anomaly, warning and AI detection features above can be tested without a real bad batch. Keep it seeded and reproducible.
- Move the simulator's device connection string to Key Vault (notebook already supports `KEY_VAULT_URL`/`KEY_VAULT_SECRET_NAME`); today `provision.py` injects it into the published notebook only, so it is visible to workspace editors and goes stale after key rotation.
- Commit `brewiq-app` (currently untracked). The semantic model is now provisioned by `infra\provision.py model` from `models\BrewEvents\BrewEvents.pbix` (Power Query parameters `KustoQueryUri`/`KustoDatabase`).
- Cleanup candidates, only if the user agrees: the `chmitchaisvcs` account and the BrewIQ workspace identity.

## 9. Known issues

- **Device key leak**: the old `BrewIQ-Simulator` draft notebook (TiltAnalytics workspace) has a hard-coded device key. Rotate it and keep the connection string in a secure store.
- The F4 capacity bills while Active; after an overnight pause the app may need a hard refresh or a `rayfin up` to come back.
- `brewiq-app` is untracked in git, so there is no history or backup of the code.
- Imperial Stout total weeks (model said 16, seed has 17), and the Saison name apostrophe and pitch temp, are unverified against the vendor.
- The import model can return the kit code as a file name (e.g. `PetiteSaisondEte`), so the review form must let the user correct it.
- The product-page reader depends on Northern Brewer's HTML; a bot challenge or layout change may return "No product image or recipe PDF found". The workaround is pasting the PDF link.
- The `tiltstream` capacity is paused and `TiltAnalytics`/`TiltEventhouse` are unreachable; they are not used by this project.
- Moving a workspace to a new capacity failed earlier (cause unconfirmed), so the `BrewIQ` workspace was recreated rather than moved.
