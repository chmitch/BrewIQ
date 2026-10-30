# Foundry analyst agent

Creates the `brewiq-analyst-agent` in Foundry: the analyst instructions, a file-search knowledge base and a strict JSON output schema. The `analyzeBatch` function calls the agent first and falls back to the plain model deployment if the agent is unavailable.

## Knowledge (generated, committed for review)

`build_knowledge.mjs` writes three markdown files to `knowledge/` from sources in the repo. They are committed so you can read exactly what the agent searches, and so `git diff` shows knowledge changes. Never edit them by hand: `agent.py` regenerates and overwrites them on every run.

| File | Source of truth |
|---|---|
| `brewing-playbook.md` | `brewiq-app/packages/functions/src/brewing-playbook.ts` (cited, paraphrased) |
| `bjcp-styles.md` | `brewiq-app/packages/shared/src/beer-styles.ts` (BJCP 2021 numeric ranges only) |
| `yeast-library.md` | `brewiq-app/packages/frontend/src/seed/yeasts.ts` (manufacturer specs) |

To change the knowledge, edit the source file, not the markdown. Only paraphrased text and numeric facts belong here; do not add raw BJCP, Palmer, Fermentis or Lallemand documents (copyrighted).

## Create or refresh

```powershell
cd brewiq-app
npm run -w @rayfin-app/shared build
npm run -w @rayfin-app/functions build     # the agent instructions come from functions/dist/analyst-prompt.js
cd ..
python tools\foundry_agent\agent.py        # regenerate knowledge, replace the vector store, publish a new agent version
python tools\foundry_agent\agent.py --skip-build   # new agent version only (instructions or schema changed)
python tools\foundry_agent\agent.py --ask all      # run the eval briefs through the agent and time them
```

`python infra\provision.py agent` runs the same script, and `provision.py all` includes it.

## Recipe advisor (prototype)

A second, conversational agent (`brewiq-advisor-agent`) helps pick what to brew. Its flavor knowledge comes from public sources instead of hand-written rules:

- `sources.json` lists open-access PubMed Central papers and Wikipedia pages.
- `python fetch_sources.py` downloads them into `knowledge\sources\`. A paper is kept only if its license is Creative Commons; each file carries its source, license and attribution (Wikipedia is CC BY-SA 4.0). Reference lists are dropped.
- `python advisor.py` uploads the recipe library, yeast library, BJCP ranges and `knowledge\sources\` to a separate vector store (`brewiq-advisor-knowledge`) and publishes the agent. Use `--chat` to talk to it, `--ask "..."` for one question, `--skip-build` to republish instructions only.
- To add a source, add a PMC id or Wikipedia title to `sources.json` and re-run both scripts.

## Requirements

- `az login` and the **Foundry User** role on the Foundry account (`provision.py foundry` grants it to the signed-in user).
- Each app user also needs **Foundry User** and **Cognitive Services OpenAI User**; without Foundry User the function silently uses the direct model.
- Re-run after changing the playbook, style data, yeast seed, analyst instructions or the output schema. Redeploy the app only when `function_app.ts` changes.
