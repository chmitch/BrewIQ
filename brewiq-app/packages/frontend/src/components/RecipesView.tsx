import type { RecipeRecord } from '@rayfin-app/shared';
import { useRef, useState } from 'react';

import type { Library } from '@/hooks/use-library';
import { diffRecipe, ingredientsDiffer, type FieldChange } from '@/lib/recipe-diff';
import { resolveImageUrl } from '@/lib/recipe-image';
import type { ImportedRecipe } from '@/lib/recipe-import';
import { runImport } from '@/lib/recipe-import-run';

const input =
  'w-full rounded-lg border border-input bg-background px-300 py-200 text-300 outline-none focus:ring-2 focus:ring-ring';
const btn = 'rounded-lg border border-border px-300 py-100 text-200 disabled:opacity-50';
const primary = 'rounded-lg bg-primary px-300 py-100 text-200 font-medium text-primary-foreground disabled:opacity-50';

interface Pending {
  recipe: ImportedRecipe;
  imageUrl: string | null;
  productUrl: string | null;
  changes: FieldChange[];
  ingredientsChanged: boolean;
}

function RecipeRow({ recipe, library }: { readonly recipe: RecipeRecord; readonly library: Library }) {
  const [open, setOpen] = useState(false);
  const [productUrl, setProductUrl] = useState(recipe.productUrl ?? '');
  const [source, setSource] = useState(recipe.sourceUrl ?? '');
  const [image, setImage] = useState(recipe.imageUrl ?? '');
  const [busy, setBusy] = useState<'' | 'reading' | 'saving'>('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [useIngredients, setUseIngredients] = useState(true);
  const cancelled = useRef(false);

  const lines = library.ingredients.filter((i) => i.recipeId === recipe.id);

  const saveLinks = async () => {
    setBusy('saving');
    setMessage(null);
    try {
      const imageUrl = image.trim() && image.trim() !== recipe.imageUrl ? await resolveImageUrl(image) : image.trim();
      await library.updateRecipe(recipe.id, {
        productUrl: productUrl.trim() || undefined,
        sourceUrl: source.trim() || undefined,
        imageUrl: imageUrl || undefined,
      });
      setMessage('Links saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const reread = async () => {
    const target = productUrl.trim() || source.trim();
    if (!target) return setMessage('Add a product page or PDF link first.');
    cancelled.current = false;
    setBusy('reading');
    setMessage(null);
    setPending(null);
    try {
      const out = await runImport(target, () => cancelled.current);
      if (!out) return;
      const changes = diffRecipe(recipe, { ...out.recipe, name: recipe.name }, out.imageUrl);
      const withUrl = out.productUrl && out.productUrl !== recipe.productUrl;
      setPending({
        recipe: out.recipe,
        imageUrl: out.imageUrl,
        productUrl: out.productUrl,
        changes,
        ingredientsChanged: ingredientsDiffer(lines, out.recipe.ingredients),
      });
      setPicked(new Set(changes.map((c) => c.key)));
      setUseIngredients(true);
      if (!changes.length && !withUrl && !ingredientsDiffer(lines, out.recipe.ingredients))
        setMessage('Already up to date.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const apply = async () => {
    if (!pending) return;
    setBusy('saving');
    try {
      const patch: Record<string, unknown> = {};
      for (const c of pending.changes) {
        if (!picked.has(c.key)) continue;
        patch[c.key] = c.key === 'imageUrl' ? pending.imageUrl : (pending.recipe as unknown as Record<string, unknown>)[c.key];
      }
      if (pending.productUrl) patch.productUrl = pending.productUrl;
      await library.updateRecipe(
        recipe.id,
        patch as Partial<RecipeRecord>,
        useIngredients && pending.ingredientsChanged ? pending.recipe.ingredients : undefined
      );
      setPending(null);
      setMessage('Recipe updated.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${recipe.name}"? Batches linked to it keep their data but lose the link.`)) return;
    setBusy('saving');
    try {
      await library.deleteRecipe(recipe.id);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setBusy('');
    }
  };

  return (
    <li className="space-y-300 rounded-xl border border-border bg-card shadow-sm p-400">
      <div className="flex flex-wrap items-center justify-between gap-300">
        <div className="flex min-w-0 items-center gap-300">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-16 w-16 shrink-0 rounded-lg border border-border bg-white object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-heading text-400 font-semibold">{recipe.name}</p>
            <p className="text-200 text-muted-foreground">
              {recipe.style}
              {recipe.productUrl ? ' · product page linked' : ' · no product page'}
              {` · ${lines.length} ingredients`}
            </p>
          </div>
        </div>
        <button type="button" className={btn} onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Manage'}
        </button>
      </div>

      {open ? (
        <div className="space-y-300">
          <label className="block space-y-100 text-200 text-muted-foreground">
            Product page (Northern Brewer package URL)
            <input className={input} type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://www.northernbrewer.com/products/…" />
          </label>
          <label className="block space-y-100 text-200 text-muted-foreground">
            Recipe PDF
            <input className={input} type="url" value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label className="block space-y-100 text-200 text-muted-foreground">
            Image (product page or direct image link)
            <input className={input} type="url" value={image} onChange={(e) => setImage(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-300">
            <button type="button" className={btn} disabled={busy !== ''} onClick={() => void saveLinks()}>
              Save links
            </button>
            <button type="button" className={primary} disabled={busy !== ''} onClick={() => void reread()}>
              {busy === 'reading' ? 'Reading… (about a minute)' : 'Update from page'}
            </button>
            <button type="button" className={`${btn} text-destructive`} disabled={busy !== ''} onClick={() => void remove()}>
              Delete
            </button>
          </div>

          {pending ? (
            <div className="space-y-200 rounded-lg border border-border p-300 text-200">
              <p className="font-medium">Changes found. Untick any you don’t want.</p>
              {pending.changes.map((c) => (
                <label key={c.key} className="flex items-start gap-200">
                  <input
                    type="checkbox"
                    checked={picked.has(c.key)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(c.key);
                      else next.delete(c.key);
                      setPicked(next);
                    }}
                  />
                  <span>
                    {c.label}: <span className="text-muted-foreground">{c.before}</span> → {c.after}
                  </span>
                </label>
              ))}
              {pending.ingredientsChanged ? (
                <label className="flex items-start gap-200">
                  <input type="checkbox" checked={useIngredients} onChange={(e) => setUseIngredients(e.target.checked)} />
                  <span>Replace the ingredient list ({lines.length} → {pending.recipe.ingredients.length} lines)</span>
                </label>
              ) : null}
              {!pending.changes.length && !pending.ingredientsChanged ? (
                <p className="text-muted-foreground">Nothing differs; the product page link will be saved.</p>
              ) : null}
              <div className="flex gap-300">
                <button type="button" className={primary} disabled={busy !== ''} onClick={() => void apply()}>
                  {busy === 'saving' ? 'Saving…' : 'Apply'}
                </button>
                <button type="button" className={btn} onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {message ? <p className="text-200 text-muted-foreground">{message}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

/** Lists the shared recipes so their links can be fixed, re-read from the vendor page, or removed. */
export function RecipesView({ library }: { readonly library: Library }) {
  return (
    <ul className="space-y-300">
      {library.recipes.map((r) => (
        <RecipeRow key={r.id} recipe={r} library={library} />
      ))}
    </ul>
  );
}
