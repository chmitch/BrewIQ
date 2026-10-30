//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { ArrowLeft, Beer, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import type { BatchRecord } from '@rayfin-app/shared';

import { BatchDashboard } from './components/BatchDashboard';
import { BatchList } from './components/BatchList';
import { yeastLabel } from './lib/yeast-format';
import { NewBatchForm } from './components/NewBatchForm';
import { RecipeAdvisor } from './components/RecipeAdvisor';
import { RecipeImport } from './components/RecipeImport';
import { RecipesView } from './components/RecipesView';
import { ErrorState, LoadingState } from './components/states';
import { useTheme } from './hooks/theme.context';
import { useBatches } from './hooks/use-batches';
import { useLibrary } from './hooks/use-library';
import { RECIPE_SEED } from './seed/recipes';
import { YEAST_SEED } from './seed/yeasts';

function App() {
  const { isDark, toggleTheme } = useTheme();
  const crud = useBatches();
  const library = useLibrary();
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<'batches' | 'recipes' | 'new'>('batches');
  const [recalcError, setRecalcError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; n: number } | undefined>();
  const [recalculating, setRecalculating] = useState(false);
  const open = crud.items.find((b) => b.id === openId) ?? null;

  const link = (b: BatchRecord, l: { recipeId?: string; yeastId?: string }) => {
    const y = l.yeastId ? library.yeastById.get(l.yeastId) : undefined;
    void crud.update(b.id, {
      ...(l.recipeId ? { recipeId: l.recipeId } : {}),
      ...(y ? { yeastId: y.id, yeast: yeastLabel(y).replace(' · ', ' ').slice(0, 120) } : {}),
    });
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl space-y-600 px-500 py-600">
        <header className="sticky top-0 z-10 -mx-500 flex items-center justify-between gap-400 border-b border-border bg-background/85 px-500 py-300 backdrop-blur">
          <div className="flex items-center gap-200">
            <span className="flex icon-size-600 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Beer className="icon-size-300" />
            </span>
            <p className="font-heading text-600 font-bold text-brand-foreground">BrewIQ</p>
          </div>
          <nav className="flex gap-100 rounded-full border border-border bg-muted p-100 text-300">
            {(['batches', 'recipes'] as const).map((v) => {
              const on = view === v || (v === 'batches' && view === 'new');
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setView(v);
                    setOpenId(null);
                  }}
                  className={`rounded-full px-400 py-100 font-medium capitalize transition-colors ${on ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {v}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg p-200 hover:bg-hover"
          >
            {isDark ? <Sun className="icon-size-300" /> : <Moon className="icon-size-300" />}
          </button>
        </header>

        {crud.error ? (
          <ErrorState
            message={crud.error}
            onRetry={crud.status === 'error' ? () => void crud.refresh() : crud.clearError}
          />
        ) : null}

        {recalcError ? (
          <ErrorState message={recalcError} onRetry={() => setRecalcError(null)} />
        ) : null}

        {library.error ? (
          <ErrorState message={library.error} onRetry={() => void library.refresh()} />
        ) : null}

        {open ? (
          <BatchDashboard
            batch={open}
            library={library}
            onLink={link}
            pending={crud.pending}
            onBack={() => setOpenId(null)}
            onComplete={(b) => void crud.completeBatch(b)}
            onRecalculate={(b) => {
              setRecalcError(null);
              setRecalculating(true);
              crud
                .recalculateBatch(b)
                .catch((e: unknown) =>
                  setRecalcError(e instanceof Error ? e.message : String(e))
                )
                .finally(() => setRecalculating(false));
            }}
            recalculating={recalculating}
          />
        ) : view === 'new' ? (
          <div className="mx-auto max-w-5xl space-y-300">
            <button
              type="button"
              onClick={() => setView('batches')}
              className="inline-flex items-center gap-100 rounded-lg px-200 py-100 text-300 text-muted-foreground hover:bg-hover"
            >
              <ArrowLeft className="icon-size-200" /> Batches
            </button>
            <div className="grid grid-cols-1 items-start gap-500 lg:grid-cols-2">
              <RecipeAdvisor
                library={library}
                onPickRecipe={(id) => setPicked((p) => ({ id, n: (p?.n ?? 0) + 1 }))}
              />
              <NewBatchForm
                onCreate={crud.createBatch}
                disabled={crud.pending}
                library={library}
                onCreated={() => setView('batches')}
                picked={picked}
              />
            </div>
          </div>
        ) : view === 'recipes' ? (
          <div className="grid grid-cols-1 gap-600 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecipesView library={library} />
            </div>
            <RecipeImport library={library} />
          </div>
        ) : crud.status === 'loading' ? (
          <LoadingState rows={4} />
        ) : (
          <div className="space-y-400">
              {!library.loading && (library.yeasts.length < YEAST_SEED.length || library.recipes.length < RECIPE_SEED.length || library.recipes.some((r) => RECIPE_SEED.some((s) => s.name === r.name && s.pitchTempMaxTenthsF !== r.pitchTempMaxTenthsF))) ? (
                <div className="flex flex-wrap items-center justify-between gap-300 rounded-2xl border border-dashed border-border p-400 text-300">
                  <span className="text-muted-foreground">
                    The recipe and yeast library is {library.yeasts.length + library.recipes.length === 0 ? 'empty' : 'missing some entries'}.
                  </span>
                  <button
                    type="button"
                    disabled={library.seeding}
                    onClick={() => {
                      setSeedMessage(null);
                      library.seed().then(setSeedMessage, () => undefined);
                    }}
                    className="rounded-lg bg-primary px-400 py-200 text-300 font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {library.seeding ? 'Loading…' : 'Load library'}
                  </button>
                </div>
              ) : null}
              {seedMessage ? <p role="status" className="rounded-lg border border-border bg-card p-300 text-300 font-medium">{seedMessage}</p> : null}
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-500 font-semibold">Batches</h2>
                <button
                  type="button"
                  onClick={() => setView('new')}
                  className="rounded-lg bg-primary px-400 py-200 text-300 font-medium text-primary-foreground"
                >
                  New batch
                </button>
              </div>
              <BatchList
                batches={crud.items}
                onOpen={(b) => setOpenId(b.id)}
                imageFor={(b) => (b.recipeId ? library.recipeById.get(b.recipeId)?.imageUrl ?? undefined : undefined)}
              />
            </div>
        )}
      </div>
    </div>
  );
}

export default App;
