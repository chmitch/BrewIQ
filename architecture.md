# BrewIQ architecture

Reference for humans and agents. Read this first; then `brewiq-app\AGENTS.md` (Rayfin scaffold rules) before changing app code.
Keep this file current: update the Decisions, Pending and Known issues sections when you change them.

## 1. What it is

Fermentation in small-batch brewing and winemaking is usually "cross your fingers and hope". Low-cost IoT devices (the Tilt hydrometer) now make detailed, continuous data available. BrewIQ gives the hobbyist:

1. A live view of the metrics (gravity, temperature) for each running batch.
2. Recommended corrective actions: an AI analyst reviews a batch's history, flagged stat cards show readings outside the yeast's range, and a recipe advisor helps choose what to brew. Rule-based warnings and anomaly detection are still planned (see Pending ideas).
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

AI paths (Foundry, called by Rayfin functions with the signed-in user's `AzureAI` token):

```
Batch page "Analyze"  -> function analyzeBatch -> Foundry agent brewiq-analyst-agent (file search over brewiq-knowledge)
                                                  falls back to the brewiq-analyst model deployment if the agent is unavailable
New batch "advisor"   -> function adviseBrew   -> Foundry agent brewiq-advisor-agent (file search over brewiq-advisor-knowledge)
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
| Foundry | `cgmbrewiq-foundry`, project `brewiq`, model deployment `brewiq-analyst` (gpt-6.1-terra, GlobalStandard, 150K TPM), agents `brewiq-analyst-agent` and `brewiq-advisor-agent`, vector stores `brewiq-knowledge` and `brewiq-advisor-knowledge`; also a pre-existing `gpt-4.1-mini` and a duplicate `bench-gpt-6.1-terra` benchmark deployment that can be deleted |

Tenant policies: Cognitive Services key auth is forced off; Key Vault public access is forced off.

## 4. Repository layout

Git root is `C:\projects\BrewIQ`; `brewiq-app\` and the rest of the repo are committed (`master`, origin `chmitch/BrewIQ`).

```
brewiq-app\
  rayfin\rayfin.yml          app config: id, workspace id, data, connectors, functions
  rayfin\connectors\brewevents\   generated semantic-model connector (schema.ts)
  packages\data\src\         Rayfin entities: Batch, Recipe, RecipeIngredient, Yeast
  packages\shared\src\       shared record types (index.ts), batch-brief.ts (buildBatchBrief), beer-styles.ts (BJCP numeric ranges)
  packages\functions\src\    function_app.ts (startImport, readProductPage, getImport, analyzeBatch, adviseBrew),
                             analyst-prompt.ts, brewing-playbook.ts; types.ts is GENERATED
  packages\frontend\src\
    App.tsx                  shell, header nav (Batches | Recipes), view state
    components\              BatchList, BatchDashboard (stat cards, charts, analysis drawer), BatchAnalysis,
                             NewBatchForm, RecipeAdvisor, RecipesView, RecipeImport,
                             LibraryPanels (recipe/yeast tabs), states
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
             history\history_batches.py (needs KUSTO_TOKEN, KUSTO_URI), recipe_import_test\run_recipe_import.py,
             analysis_eval\ (run_eval.py + briefs.json: benchmark/regression harness for the analyst),
             foundry_agent\ (agent.py analyst agent, advisor.py recipe advisor, build_knowledge.mjs, fetch_sources.py,
             sources.json, knowledge\ generated and committed for review; see its README)
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
13. **AI analyst ("Analyze my batch")**: the browser builds a deterministic brief (`buildBatchBrief` in `packages\shared`: phase, expected FG, temperature-range metrics, candidate findings, a thinned series) from the whole-batch hourly series plus the linked recipe and yeast, and sends it to the `analyzeBatch` function. The function calls the Foundry agent `brewiq-analyst-agent` (instructions plus file search over the `brewiq-knowledge` vector store) and falls back to the `brewiq-analyst` model deployment (gpt-6.1-terra, chosen from a 7-model benchmark in `tools\analysis_eval\`) if the agent is unavailable, using the signed-in user's `AzureAI` token. Users therefore need `Foundry User` (agents) and `Cognitive Services OpenAI User` on the Foundry resource; without Foundry User the function silently uses the direct model. No key is stored. The prompt (`functions\src\analyst-prompt.ts`) treats the Tilt as a sealed in-fermenter hydrometer (no manual-hydrometer advice), is grounded by `brewing-playbook.ts` and the BJCP numeric ranges (`shared\src\beer-styles.ts`, numbers only, with the BJCP attribution; no copyrighted text is ingested), and is lifecycle-aware: `batch.status` is `active`, `likely-complete` (gravity stable with no end date) or `completed`, and the advice changes accordingly (corrective, packaging and conditioning, or a retrospective). Temperature findings are only raised for active batches. The agent answer uses a strict `json_schema` output. Measured on six eval briefs the agent takes 11-14 s (direct call about 7 s) and is more library-aware but noisier and more prone to 429s; the function retries once on 429/5xx. The knowledge files are generated by `tools\foundry_agent\build_knowledge.mjs` and committed under `tools\foundry_agent\knowledge\` so they can be reviewed; rebuild them with `agent.py` after changing the playbook, style data, yeast seed or instructions.
14. **Recipe advisor** (New batch page): a chat panel beside the form calls the `adviseBrew` function, which calls `brewiq-advisor-agent` and chains turns with Foundry's `previous_response_id` (the client keeps only the response id). The agent's flavor knowledge is deliberately not hand-written rules: `tools\foundry_agent\fetch_sources.py` downloads open-access PubMed Central papers (kept only when the license is Creative Commons) and Wikipedia pages (CC BY-SA 4.0), each with source and license attribution, from `sources.json` into `knowledge\sources\`. They are uploaded with the recipe library, yeast library and BJCP ranges to the `brewiq-advisor-knowledge` vector store (`advisor.py`). The instructions require file search for recommendations, citations by file name, "general brewing knowledge" labels for unsupported claims, and no invented numbers. When a reply names a library recipe the UI shows a "Use <recipe>" button that fills the new-batch form. Known thin spot: hop-variety flavor comes mostly from Wikipedia's hop list.
15. **Batch page**: "Analyze" in the header opens a right-hand drawer (not a tab) and starts the analysis on first open; the result is kept while the batch stays open. The page content shrinks on wide screens so the charts and the analysis are visible together. The analysis reads the whole-batch series with up to two retries (4 s, 10 s) on transient capacity errors (the F4 can evict the semantic model under CPU load). Stat cards turn amber or red with a one-line reason when a reading leaves the range implied by the linked yeast and recipe: temperature outside the yeast range (red at 4 °F or more), attenuation above the yeast range (red more than 3 points), gravity below the expected FG range (red more than 0.003 below; completed batches finishing above the range flag a stall), and OG 5 or more points off target. Cards flag only when the batch is linked to a yeast with the needed ranges. The logic is inline in `BatchDashboard.tsx` and has no tests yet.
16. **Simulator determinism**: readings are a pure function of `(SEED, batch, seq)`, so a gap (for example after an eventstream pause) can be regenerated exactly. `BATCH_START_UTC` pins the batch start so a re-run covers the same window. Checkpoints go to `Files/checkpoints` in the default lakehouse.

## 7. Working on the project (gotchas)

- Validate: from `brewiq-app`: `npm run typecheck` (also validates functions), `npm run lint`, `npm test` (75 tests). If vitest says "Failed to start forks worker" right after lint, rerun.
- Deploy: `npx rayfin up --workspace BrewIQ` (about 5 min, schema changes included). Run it in a background job with a timeout. The capacity must be Active.
- Functions typegen: `rayfin dev functions apply` needs Azure Functions Core Tools and can hang. The workable path used so far: add the entry to `packages\functions\src\types.ts` by hand (same shape as the generated ones), then `npm run -w @rayfin-app/functions build` so the frontend sees `dist\types.d.ts`. Don't cast around the functions client. Body-only changes need no typegen. Don't run `rayfin functions init`.
- After a Fabric capacity pause/restart the eventstream's IoT Hub source and Eventhouse destination are **Paused**: resume them through the eventstream topology API (`/eventstreams/{id}/topology`, then `/sources/{id}/resume` and `/destinations/{id}/resume` with `{"startType":"Now"}`). "Now" skips events sent while paused, so backfill the gap by regenerating the simulator's rows and `.ingest inline` them.
- `publish_notebook.apply_overrides` fails with "Parameter not found" if an override equals the existing value; skip such keys.
- The Foundry Agents API (api-version `v1`, token resource `https://ai.azure.com`) needs the `Foundry User` role; propagation takes about 3 minutes. `json_object` output needs the word "json" in the input message, not the instructions.
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
- Analyst follow-ups: pass anomalies into the brief (needs a query that returns flagged readings with deviations), cache or save analyses per batch, stream the answer, handle over-attenuation (possible infection or wild yeast) explicitly in the prompt, evaluate the lifecycle prompt on completed and stable-but-not-ended scenarios, tighten the agent instructions (it is noisier than the direct call) or move the knowledge into the prompt to get back to about 7 s, an "End batch" prompt when status is `likely-complete`, and a live library lookup tool for the agent.
- Recipe advisor follow-ups: better hop-flavor sources than Wikipedia, use the user's past batches as context, extract the stat-card flag logic from `BatchDashboard.tsx` and add tests.
- **Batch ratings**: add a rating section to completed batches where the brewer records what they did and didn't like (overall score, flavor, aroma, clarity, notes). Store it on the batch, show it in the library, and feed it to the analyst (retrospective) and to the recipe advisor (the beer selection agent) as context, so recommendations favor styles, recipes and yeasts the brewer rated well and avoid ones they didn't.
- Provisioning gaps: `provision.py` does not build the shared and functions packages before the agent steps and has no wait loop for role propagation (403s); the foundry, agent and advisor create paths are untested on a clean subscription.
- Regenerate the simulated history batches from the real recipes.
- Capture vendor specs for kit-only yeasts (Imperial, Omega, Danstar) so they have authoritative temps/attenuation.
- Chart palette tuning beyond the two lines; more detail on the batch dashboard (e.g. hero image).
- Semantic-model measures for ABV/attenuation if a Power BI report needs them.
- **Anomaly detection on running batches**: update the KQL query behind the semantic model to flag anomalous gravity and temperature points (e.g. `series_decompose_anomalies()` or a rolling-median/MAD filter to catch sensor spikes), and surface them on the batch charts.
- **Warning conditions**: the batch page stat cards already flag temperature outside the yeast range, attenuation beyond range and gravity beyond the expected FG. Still to do: rapid temperature swings, no readings for N hours, and showing warnings on the batch list.
- **AI pattern detection and recommendations** (builds on the Foundry agent idea): detect a stalled fermentation (gravity flat well above the expected FG for the yeast's attenuation) and suggest fixes (raise temperature, rouse the yeast, repitch); detect fermentation that has gone far enough and recommend a cold crash. Likely approach: compute features in KQL (slope, time since last change, projected FG), pass them with the recipe and yeast specs to the agent, and show the findings as advice on the batch page. Needs thresholds validated against real batches before trusting recommendations.
- **Simulator fault injection**: add selectable fault scenarios to the `TiltEvent-Simulator` notebook (stalled fermentation, temperature excursion, sensor spikes and dropouts, runaway fermentation) so the detection and AI features can be tested without a real bad batch. Keep it seeded and reproducible (see decision 16).
- Pi forwarder: today the Pi side uses the external `DataSciNAll/pytiltiot` repo (linked from the README). Verify its message shape matches the eventstream (`eventtime`, `gravity`, `temp`, JSON content type) and consider documenting or vendoring a tested setup here.
- Move the simulator's device connection string to Key Vault (notebook already supports `KEY_VAULT_URL`/`KEY_VAULT_SECRET_NAME`); today `provision.py` injects it into the published notebook only, so it is visible to workspace editors and goes stale after key rotation.
- The semantic model is provisioned by `infra\provision.py model` from `models\BrewEvents\BrewEvents.pbix` (Power Query parameters `KustoQueryUri`/`KustoDatabase`).
- Cleanup candidates, only if the user agrees: the `chmitchaisvcs` account and the BrewIQ workspace identity.

## 9. Known issues

- **Device key leak**: the old `BrewIQ-Simulator` draft notebook (TiltAnalytics workspace) has a hard-coded device key. Rotate it and keep the connection string in a secure store.
- The F4 capacity bills while Active; after an overnight pause the app may need a hard refresh or a `rayfin up` to come back.
- Analysis can fail with "database was evicted to balance the CPU load" when the F4 capacity is busy (simulator, eventstream, chart refresh and Foundry share it). It retries automatically; scaling the capacity up temporarily helps.
- The BJCP style aliases used by the analyst (for example "neipa") are unverified, the playbook's [G]-tagged rules are general knowledge rather than sourced, and howtobrew.com is unreachable from the dev machine so Palmer's *How to Brew* is not used.
- Imperial Stout total weeks (model said 16, seed has 17), and the Saison name apostrophe and pitch temp, are unverified against the vendor.
- The import model can return the kit code as a file name (e.g. `PetiteSaisondEte`), so the review form must let the user correct it.
- The product-page reader depends on Northern Brewer's HTML; a bot challenge or layout change may return "No product image or recipe PDF found". The workaround is pasting the PDF link.
- The `tiltstream` capacity is paused and `TiltAnalytics`/`TiltEventhouse` are unreachable; they are not used by this project.
- Moving a workspace to a new capacity failed earlier (cause unconfirmed), so the `BrewIQ` workspace was recreated rather than moved.
