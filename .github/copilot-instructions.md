# BrewIQ: instructions for Copilot sessions

Homebrew fermentation analytics on Azure and Microsoft Fabric. Read `architecture.md` first (structure, decisions, gotchas, pending ideas, known issues), then `README.md` and `infra/README.md`. `brewiq-app/AGENTS.md` covers the Rayfin app conventions.

## Working agreements
- Everything stays in the `cgmbrewiq` resource group.
- Never commit secrets or subscription/tenant ids. Device keys, tokens and connection strings are injected at publish time only.
- **Do not commit or push until the user asks.** Ask before consequential or costly actions (capacity changes, deleting resources, rotating keys).
- Commits: descriptive message, and trailers `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` and the session id trailer.
- The Tilt is a sealed in-fermenter hydrometer: never advise manual hydrometer or refractometer checks.
- Do not ingest copyrighted text (BJCP, Palmer, Fermentis, Lallemand). Use public, openly licensed sources (Creative Commons PMC papers, Wikipedia) rather than hand-written flavor rules.
- Update `architecture.md` and the READMEs when behavior changes; keep CRLF line endings.

## Where things are
- App: `brewiq-app/` (frontend, functions, data entities, `rayfin/rayfin.yml`). Functions: `analyzeBatch` (agent first, falls back to the model deployment) and `adviseBrew` (recipe advisor, chained with `previous_response_id`) in `packages/functions/src/function_app.ts`; analyst prompt in `analyst-prompt.ts`.
- Foundry agents and knowledge: `tools/foundry_agent/` (`agent.py`, `advisor.py`, `fetch_sources.py`, `build_knowledge.mjs`, committed `knowledge/`). Analyst benchmark: `tools/analysis_eval/`.
- Provisioning: `infra/provision.py` (idempotent steps: azure, foundry, agent, fabric, notebooks, model). Notebooks: `notebooks/`.

## Commands
- Frontend checks: `cd brewiq-app\packages\frontend; npx tsc --noEmit -p .` and `npx eslint <files>`. Build functions first: `npm run -w @rayfin-app/functions build`.
- Deploy app: `cd brewiq-app; npx rayfin up --workspace BrewIQ` (about 10 min). The live URL is in the Fabric portal or the `rayfin up` output.
- Republish the analyst agent after changing `analyst-prompt.ts`, the playbook or knowledge: rebuild functions, then `python tools\foundry_agent\agent.py` (new agent version). The agent carries its own copy of the instructions (`AGENT_INSTRUCTIONS` includes `ANALYST_INSTRUCTIONS`), so a prompt change needs both the agent republish and an app deploy.
- Test the agent: `python tools\foundry_agent\agent.py --ask all` (eval briefs; all are `active`, so edit `batch.status` to test finished batches). Recipe advisor: `python tools\foundry_agent\advisor.py --chat`.

## Gotchas
- `types.ts` for functions is hand-edited (typegen hangs); match the generated shape.
- Edit-tool hazard: multi-line replacements silently drop omitted lines; re-check JSX props after edits.
- The F4 Fabric capacity can evict the semantic model under load (the UI retries). After a capacity restart the eventstream source and destination are Paused: resume them, then backfill the gap (see `architecture.md`).
- The Foundry User role takes about 3 minutes to propagate; users need Foundry User plus Cognitive Services OpenAI User.
- GitHub pushes occasionally fail with a transient 500; retry.

## Open items worth knowing
See `architecture.md` section 8 (pending ideas, including batch ratings) and section 9 (known issues: Mosaic IPA seed OG/ABV looks odd, unverified BJCP aliases, leaked device key in the old `BrewIQ-Simulator` notebook should be rotated, duplicate `bench-gpt-6.1-terra` deployment can be deleted after asking).
