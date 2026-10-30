import { useState, type FormEvent } from 'react';

import { yeastLabel } from '@/lib/yeast-format';
import type { Library } from '@/hooks/use-library';
import type { NewBatch } from '@/hooks/use-batches';

/** `datetime-local` value for a Date, in the viewer's local zone. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const inputClass =
  'w-full rounded-lg border border-input bg-background px-300 py-200 text-300 outline-none focus:ring-2 focus:ring-ring';

export function NewBatchForm({
  onCreate,
  disabled,
  library,
  onCreated,
  picked,
}: {
  readonly onCreate: (b: NewBatch) => Promise<void>;
  readonly disabled?: boolean;
  readonly library: Library;
  readonly onCreated?: () => void;
  /** Recipe chosen elsewhere (the advisor); `n` changes on every pick so the same recipe can be re-applied. */
  readonly picked?: { readonly id: string; readonly n: number };
}) {
  const [name, setName] = useState('');
  const [yeast, setYeast] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [yeastId, setYeastId] = useState('');
  const [og, setOg] = useState('1.050');
  const [start, setStart] = useState(() => toLocalInput(new Date()));
  const [end, setEnd] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const chooseRecipe = (id: string, replaceName = false) => {
    setRecipeId(id);
    const r = library.recipeById.get(id);
    if (!r) return;
    setOg((r.ogPoints / 1000).toFixed(3));
    if (r.yeastId) setYeastId(r.yeastId);
    if (replaceName || !name.trim()) setName(r.name);
  };

  const [appliedPick, setAppliedPick] = useState(0);
  if (picked && picked.n !== appliedPick) {
    setAppliedPick(picked.n);
    chooseRecipe(picked.id, true);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const sg = Number(og);
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : undefined;
    const chosen = yeastId ? library.yeastById.get(yeastId) : undefined;
    const yeastName = chosen ? yeastLabel(chosen).replace(' · ', ' ').slice(0, 120) : yeast.trim();
    if (!name.trim()) return setProblem('Give the batch a name.');
    if (!yeastName) return setProblem('Choose or enter the yeast.');
    if (!Number.isFinite(sg) || sg < 1.0 || sg > 1.2)
      return setProblem('Target OG should be between 1.000 and 1.200.');
    if (Number.isNaN(startDate.getTime()))
      return setProblem('Pick a start date and time.');
    if (endDate && (Number.isNaN(endDate.getTime()) || endDate <= startDate))
      return setProblem('The end must be after the start.');
    setProblem(null);
    void onCreate({
      name: name.trim(),
      yeast: yeastName,
      recipeId: recipeId || undefined,
      yeastId: chosen?.id,
      targetOGPoints: Math.round(sg * 1000),
      startDate,
      endDate,
    }).then(() => {
      setName('');
      setYeast('');
      setRecipeId('');
      setYeastId('');
      setEnd('');
      onCreated?.();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-300 rounded-2xl border border-border bg-card shadow-sm p-500"
    >
      <h2 className="font-heading text-500 font-semibold">New batch</h2>
      <label className="block space-y-100 text-200 text-muted-foreground">
        Recipe
        <select className={inputClass} value={recipeId} onChange={(e) => chooseRecipe(e.target.value)}>
          <option value="">None / custom</option>
          {library.recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-100 text-200 text-muted-foreground">
        Name
        <input
          className={inputClass}
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder="Autumn Saison"
        />
      </label>
      <label className="block space-y-100 text-200 text-muted-foreground">
        Yeast
        <select className={inputClass} value={yeastId} onChange={(e) => setYeastId(e.target.value)}>
          <option value="">Other (type below)</option>
          {library.yeasts.map((y) => (
            <option key={y.id} value={y.id}>
              {yeastLabel(y)}
            </option>
          ))}
        </select>
      </label>
      {yeastId ? null : (
        <input
          className={inputClass}
          value={yeast}
          maxLength={120}
          onChange={(e) => setYeast(e.target.value)}
          placeholder="Belle Saison"
          aria-label="Yeast name"
        />
      )}
      <div className="grid grid-cols-2 gap-300">
        <label className="block space-y-100 text-200 text-muted-foreground">
          Target OG
          <input
            className={inputClass}
            inputMode="decimal"
            value={og}
            onChange={(e) => setOg(e.target.value)}
          />
        </label>
        <label className="block space-y-100 text-200 text-muted-foreground">
          Started
          <input
            type="datetime-local"
            className={inputClass}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
      </div>
      <label className="block space-y-100 text-200 text-muted-foreground">
        Ended (optional, for finished batches)
        <input
          type="datetime-local"
          className={inputClass}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      {problem ? (
        <p role="alert" className="text-200 text-destructive">
          {problem}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-lg bg-primary px-400 py-200 text-300 font-medium text-primary-foreground disabled:opacity-50"
      >
        Create batch
      </button>
    </form>
  );
}
