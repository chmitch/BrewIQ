import type { BatchRecord, RecipeIngredientRecord, RecipeRecord, YeastRecord } from '@rayfin-app/shared';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';

import type { Library } from '@/hooks/use-library';
import { resolveImageUrl } from '@/lib/recipe-image';
import { attenuationRange, tempRange, wholeF as F, yeastLabel } from '@/lib/yeast-format';

function Row({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <div className="flex justify-between gap-400 border-b border-border py-200 text-300 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? '—'}</dd>
    </div>
  );
}

function Card({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm p-500">
      <h3 className="mb-200 font-heading text-400 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

const KIND_LABEL: Record<string, string> = {
  fermentable: 'Fermentables',
  hop: 'Hops',
  yeast: 'Yeast',
  other: 'Other',
};

function Ingredients({ lines }: { readonly lines: RecipeIngredientRecord[] }) {
  const kinds = ['fermentable', 'hop', 'yeast', 'other'].filter((k) => lines.some((l) => l.kind === k));
  return (
    <div className="space-y-400">
      {kinds.map((k) => (
        <div key={k}>
          <p className="text-200 font-medium text-muted-foreground">{KIND_LABEL[k]}</p>
          <ul className="divide-y divide-border">
            {lines
              .filter((l) => l.kind === k)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((l) => (
                <li key={l.id} className="flex justify-between gap-400 py-200 text-300">
                  <span>{l.name}</span>
                  <span className="text-right text-muted-foreground">
                    {[l.amount, l.timing].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Lets the brewer attach a library recipe and yeast to a batch. */
function LinkPicker({
  batch,
  library,
  onLink,
}: {
  readonly batch: BatchRecord;
  readonly library: Library;
  readonly onLink: (b: BatchRecord, link: { recipeId?: string; yeastId?: string }) => void;
}) {
  const [recipeId, setRecipeId] = useState(batch.recipeId ?? '');
  const [yeastId, setYeastId] = useState(batch.yeastId ?? '');
  const pick =
    'w-full rounded-lg border border-input bg-background px-300 py-200 text-300 outline-none focus:ring-2 focus:ring-ring';
  return (
    <Card title="Link to the library">
      <div className="grid grid-cols-1 gap-300 md:grid-cols-2">
        <label className="space-y-100 text-200 text-muted-foreground">
          Recipe
          <select
            className={pick}
            value={recipeId}
            onChange={(e) => {
              setRecipeId(e.target.value);
              const r = library.recipeById.get(e.target.value);
              if (r?.yeastId && !yeastId) setYeastId(r.yeastId);
            }}
          >
            <option value="">None</option>
            {library.recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-100 text-200 text-muted-foreground">
          Yeast
          <select className={pick} value={yeastId} onChange={(e) => setYeastId(e.target.value)}>
            <option value="">None</option>
            {library.yeasts.map((y) => (
              <option key={y.id} value={y.id}>
                {yeastLabel(y)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={() =>
          onLink(batch, {
            recipeId: recipeId || undefined,
            yeastId: yeastId || undefined,
          })
        }
        className="mt-300 rounded-lg bg-primary px-400 py-200 text-300 font-medium text-primary-foreground"
      >
        Save link
      </button>
    </Card>
  );
}

/** Lets the brewer link or change the recipe's vendor image. */
function RecipeImageEditor({ recipe, library }: { readonly recipe: RecipeRecord; readonly library: Library }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const apply = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await library.setRecipeImage(recipe.id, await resolveImageUrl(value));
      setValue('');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={recipe.imageUrl ? 'Change image' : 'Add an image'}>
      <p className="mb-200 text-200 text-muted-foreground">
        Paste a Northern Brewer product page or a direct image link. The image is linked, not copied.
      </p>
      <div className="flex gap-300">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-input bg-background px-300 py-200 text-300 outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={() => void apply()}
          className="rounded-lg bg-primary px-400 py-200 text-300 font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Set'}
        </button>
      </div>
      {problem ? <p className="mt-200 text-200 text-destructive">{problem}</p> : null}
    </Card>
  );
}

export function RecipePanel({
  batch,
  library,
  onLink,
}: {
  readonly batch: BatchRecord;
  readonly library: Library;
  readonly onLink: (b: BatchRecord, link: { recipeId?: string; yeastId?: string }) => void;
}) {
  const recipe: RecipeRecord | undefined = batch.recipeId ? library.recipeById.get(batch.recipeId) : undefined;
  const yeast = recipe?.yeastId ? library.yeastById.get(recipe.yeastId) : undefined;
  const lines = recipe ? library.ingredients.filter((i) => i.recipeId === recipe.id) : [];

  if (!recipe) {
    return (
      <div className="space-y-400">
        <div className="rounded-2xl border border-dashed border-border p-600 text-center text-300 text-muted-foreground">
          {library.recipes.length === 0
            ? 'The recipe library is empty. Load it from the Library button on the batch list.'
            : 'This batch is not linked to a recipe yet.'}
        </div>
        {library.recipes.length > 0 ? <LinkPicker batch={batch} library={library} onLink={onLink} /> : null}
      </div>
    );
  }

  const plan =
    recipe.primaryDaysMin != null
      ? recipe.primaryDaysMin === recipe.primaryDaysMax
        ? `${recipe.primaryDaysMin} days`
        : `${recipe.primaryDaysMin}–${recipe.primaryDaysMax} days`
      : null;
  const actualOg = batch.ogPoints != null ? (batch.ogPoints / 1000).toFixed(3) : null;

  return (
    <div className="space-y-400">
      <div className="grid grid-cols-1 gap-400 lg:grid-cols-3">
        <div className="space-y-400 lg:col-span-2">
          <Card title={recipe.name}>
            <p className="text-300 text-muted-foreground">
              {recipe.style} · {recipe.batchSizeGal} gal
              {recipe.source ? ` · ${recipe.source}` : ''}
              {recipe.kitCode ? ` kit ${recipe.kitCode}` : ''}
            </p>
            {recipe.timeline ? <p className="mt-200 text-300">{recipe.timeline}</p> : null}
            {recipe.instructions ? (
              <p className="mt-300 text-300 text-muted-foreground">{recipe.instructions}</p>
            ) : null}
            {recipe.sourceUrl ? (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-300 inline-flex items-center gap-100 text-300 text-primary hover:underline"
              >
                Original recipe PDF <ExternalLink className="icon-size-200" />
              </a>
            ) : null}
          </Card>
          <Card title="Ingredients">
            {lines.length ? <Ingredients lines={lines} /> : <p className="text-300 text-muted-foreground">No ingredients recorded.</p>}
          </Card>
        </div>
        <div className="space-y-400">
          {recipe.imageUrl ? (
            <div className="flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-300">
              <img
                src={recipe.imageUrl}
                alt={recipe.name}
                referrerPolicy="no-referrer"
                className="max-h-72 w-full object-contain"
                onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
              />
            </div>
          ) : null}
          <Card title="Recipe vs this batch">
            <dl>
              <Row label="Kit OG" value={(recipe.ogPoints / 1000).toFixed(3)} />
              <Row label="Batch target OG" value={(batch.targetOGPoints / 1000).toFixed(3)} />
              <Row label="Actual OG" value={actualOg} />
              <Row label="Kit ABV" value={recipe.abvTenths != null ? `${(recipe.abvTenths / 10).toFixed(1)}%` : null} />
              <Row label="Actual ABV" value={batch.abvTenths != null ? `${(batch.abvTenths / 10).toFixed(1)}%` : null} />
              <Row label="Kit IBU" value={recipe.ibuTenths != null ? (recipe.ibuTenths / 10).toFixed(1) : null} />
              <Row label="Planned primary" value={plan} />
              <Row label="Pitch at or below" value={recipe.pitchTempMaxTenthsF != null ? `${F(recipe.pitchTempMaxTenthsF)} °F` : null} />
            </dl>
          </Card>
          <Card title="Yeast">
            <p className="text-300">{yeast ? yeastLabel(yeast) : '—'}</p>
            {recipe.yeastNotes ? <p className="mt-200 text-200 text-muted-foreground">{recipe.yeastNotes}</p> : null}
          </Card>
          <details className="group">
            <summary className="cursor-pointer text-200 text-muted-foreground hover:text-foreground">
              {recipe.imageUrl ? 'Change image' : 'Add an image'}
            </summary>
            <div className="mt-200">
              <RecipeImageEditor recipe={recipe} library={library} />
            </div>
          </details>
        </div>
      </div>
      <LinkPicker batch={batch} library={library} onLink={onLink} />
    </div>
  );
}

function outsideRange(y: YeastRecord, batch: BatchRecord): string | null {
  if (batch.minTempTenthsF == null || batch.maxTempTenthsF == null) return null;
  if (y.tempMinTenthsF == null || y.tempMaxTenthsF == null) return null;
  const parts: string[] = [];
  if (batch.minTempTenthsF < y.tempMinTenthsF) parts.push('dipped below');
  if (batch.maxTempTenthsF > y.tempMaxTenthsF) parts.push('rose above');
  return parts.length ? `Fermentation ${parts.join(' and ')} the yeast's range` : 'Within the yeast range';
}

export function YeastPanel({
  batch,
  library,
  onLink,
}: {
  readonly batch: BatchRecord;
  readonly library: Library;
  readonly onLink: (b: BatchRecord, link: { recipeId?: string; yeastId?: string }) => void;
}) {
  const y = batch.yeastId ? library.yeastById.get(batch.yeastId) : undefined;
  if (!y) {
    return (
      <div className="space-y-400">
        <div className="rounded-2xl border border-dashed border-border p-600 text-center text-300 text-muted-foreground">
          {library.yeasts.length === 0
            ? 'The yeast library is empty. Load it from the Library button on the batch list.'
            : `This batch is not linked to a yeast in the library (recorded as “${batch.yeast}”).`}
        </div>
        {library.yeasts.length > 0 ? <LinkPicker batch={batch} library={library} onLink={onLink} /> : null}
      </div>
    );
  }
  const att = attenuationRange(y);
  return (
    <div className="space-y-400">
      <div className="grid grid-cols-1 gap-400 lg:grid-cols-2">
        <Card title={`${y.brand} ${y.code} · ${y.name}`}>
          <dl>
            <Row label="Form" value={y.form} />
            <Row label="Category" value={y.category} />
            <Row label="Species" value={y.species} />
            <Row label="Flocculation" value={y.flocculation} />
            <Row label="Apparent attenuation" value={att} />
            <Row label="Alcohol tolerance" value={y.abvTolerance} />
            <Row label="Fermentation temperature" value={tempRange(y)} />
          </dl>
          {y.notes ? <p className="mt-300 text-200 text-muted-foreground">{y.notes}</p> : null}
          {y.sourceUrl ? (
            <a
              href={y.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-300 inline-flex items-center gap-100 text-300 text-primary hover:underline"
            >
              {y.source ?? 'Source'} <ExternalLink className="icon-size-200" />
            </a>
          ) : null}
        </Card>
        <Card title="This batch vs the yeast">
          <dl>
            <Row label="Actual attenuation" value={batch.attenuationPct != null ? `${batch.attenuationPct}%` : null} />
            <Row label="Expected attenuation" value={att} />
            <Row
              label="Batch temperature range"
              value={
                batch.minTempTenthsF != null && batch.maxTempTenthsF != null
                  ? `${(batch.minTempTenthsF / 10).toFixed(1)}–${(batch.maxTempTenthsF / 10).toFixed(1)} °F`
                  : null
              }
            />
            <Row label="Yeast range" value={tempRange(y)} />
            <Row label="Check" value={outsideRange(y, batch)} />
          </dl>
        </Card>
      </div>
      <LinkPicker batch={batch} library={library} onLink={onLink} />
    </div>
  );
}
