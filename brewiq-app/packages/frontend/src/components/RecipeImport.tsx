import { useRef, useState } from 'react';

import type { Library } from '@/hooks/use-library';
import { matchYeasts, type ImportedRecipe } from '@/lib/recipe-import';
import { resolveImageUrl } from '@/lib/recipe-image';
import { runImport } from '@/lib/recipe-import-run';
import { yeastLabel } from '@/lib/yeast-format';

const input =
  'w-full rounded-lg border border-input bg-background px-300 py-200 text-300 outline-none focus:ring-2 focus:ring-ring';

type Phase = 'idle' | 'reading' | 'review' | 'saving' | 'saved';

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="space-y-100 text-200 text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

/** Reads a recipe PDF by URL, lets the brewer check it, then saves it to the shared library. */
export function RecipeImport({ library }: { readonly library: Library }) {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<ImportedRecipe | null>(null);
  const [yeastId, setYeastId] = useState('');
  const [imageInput, setImageInput] = useState('');
  const [pageImage, setPageImage] = useState('');
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const cancelled = useRef(false);

  const reset = () => {
    cancelled.current = true;
    setPhase('idle');
    setDraft(null);
    setMessage(null);
    setUnmatched([]);
    setYeastId('');
  };

  const start = async () => {
    cancelled.current = false;
    setMessage(null);
    setPhase('reading');
    try {
      const out = await runImport(url, () => cancelled.current);
      if (!out) return;
      setPageImage(out.imageUrl ?? '');
      setImageInput(out.imageUrl ?? '');
      const { matched, unmatched: miss } = matchYeasts(out.recipe.suggestedYeasts, library.yeasts);
      setDraft(out.recipe);
      setYeastId(matched[0]?.id ?? '');
      setUnmatched(miss.map((m) => [m.brand, m.code, m.name].filter(Boolean).join(' ')));
      setPhase('review');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setPhase('idle');
    }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return setMessage('The recipe needs a name.');
    if (library.recipes.some((r) => r.name.toLowerCase() === draft.name.trim().toLowerCase()))
      return setMessage('A recipe with this name is already in the library.');
    setMessage(null);
    setPhase('saving');
    try {
      const imageUrl = !imageInput.trim()
        ? undefined
        : imageInput.trim() === pageImage
          ? pageImage
          : await resolveImageUrl(imageInput);
      await library.saveImported({ ...draft, name: draft.name.trim(), imageUrl }, yeastId || undefined);
      setPhase('saved');
      setDraft(null);
      setUrl('');
      setImageInput('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setPhase('review');
    }
  };

  const num = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const set = <K extends keyof ImportedRecipe>(k: K, v: ImportedRecipe[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <section className="space-y-300 rounded-2xl border border-border bg-card shadow-sm p-500">
      <h3 className="font-heading text-400 font-semibold">Import a recipe</h3>

      {phase === 'idle' || phase === 'reading' || phase === 'saved' ? (
        <>
          <p className="text-200 text-muted-foreground">
            Paste the Northern Brewer product page, or the link to a recipe instruction PDF. The recipe (and, from a product page, its image) is read for you to check before it is saved.
          </p>
          <input
            className={input}
            type="url"
            placeholder="https://www.northernbrewer.com/products/… or …/recipe.pdf"
            value={url}
            disabled={phase === 'reading'}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="button"
            disabled={phase === 'reading' || !url.trim()}
            onClick={() => void start()}
            className="rounded-lg bg-primary px-400 py-200 text-300 font-medium text-primary-foreground disabled:opacity-50"
          >
            {phase === 'reading' ? 'Reading recipe… (about a minute)' : 'Read recipe'}
          </button>
          {phase === 'saved' ? <p className="text-200 text-muted-foreground">Saved to the library.</p> : null}
        </>
      ) : null}

      {draft && (phase === 'review' || phase === 'saving') ? (
        <div className="space-y-300">
          <Field label="Name">
            <input className={input} value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-300">
            <Field label="Style">
              <input className={input} value={draft.style} onChange={(e) => set('style', e.target.value)} />
            </Field>
            <Field label="Kit code">
              <input
                className={input}
                value={draft.kitCode ?? ''}
                onChange={(e) => set('kitCode', e.target.value || null)}
              />
            </Field>
            <Field label="Batch (gal)">
              <input
                className={input}
                inputMode="decimal"
                value={draft.batchSizeGal}
                onChange={(e) => set('batchSizeGal', num(e.target.value) ?? 0)}
              />
            </Field>
            <Field label="OG (e.g. 1.050)">
              <input
                className={input}
                inputMode="decimal"
                value={(draft.ogPoints / 1000).toFixed(3)}
                onChange={(e) => set('ogPoints', Math.round((num(e.target.value) ?? 0) * 1000))}
              />
            </Field>
            <Field label="Total weeks">
              <input
                className={input}
                inputMode="numeric"
                value={draft.totalWeeks ?? ''}
                onChange={(e) => set('totalWeeks', num(e.target.value))}
              />
            </Field>
            <Field label="Pitch at or below (°F)">
              <input
                className={input}
                inputMode="decimal"
                value={draft.pitchTempMaxTenthsF != null ? draft.pitchTempMaxTenthsF / 10 : ''}
                onChange={(e) => {
                  const v = num(e.target.value);
                  set('pitchTempMaxTenthsF', v == null ? null : Math.round(v * 10));
                }}
              />
            </Field>
          </div>
          <Field label="Yeast (from the library; vendor specs are not changed)">
            <select className={input} value={yeastId} onChange={(e) => setYeastId(e.target.value)}>
              <option value="">None</option>
              {library.yeasts.map((y) => (
                <option key={y.id} value={y.id}>
                  {yeastLabel(y)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Image: Northern Brewer product page or direct image link (optional)">
            <input
              className={input}
              type="url"
              placeholder="https://www.northernbrewer.com/products/…"
              value={imageInput}
              onChange={(e) => setImageInput(e.target.value)}
            />
          </Field>
          {unmatched.length > 0 ? (
            <p className="text-200 text-muted-foreground">
              Not in the library: {unmatched.join(', ')}.
            </p>
          ) : null}
          <p className="text-200 text-muted-foreground">
            {draft.ingredients.length} ingredients read. OG {(draft.ogPoints / 1000).toFixed(3)}
            {draft.abvTenths != null ? `, ABV ${(draft.abvTenths / 10).toFixed(1)}%` : ''}
            {draft.ibuTenths != null ? `, IBU ${Math.round(draft.ibuTenths / 10)}` : ''}.
          </p>
          <div className="flex gap-300">
            <button
              type="button"
              disabled={phase === 'saving'}
              onClick={() => void save()}
              className="rounded-lg bg-primary px-400 py-200 text-300 font-medium text-primary-foreground disabled:opacity-50"
            >
              {phase === 'saving' ? 'Saving…' : 'Save to library'}
            </button>
            <button
              type="button"
              disabled={phase === 'saving'}
              onClick={reset}
              className="rounded-lg border border-border px-400 py-200 text-300"
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-200 text-destructive">{message}</p> : null}
    </section>
  );
}
