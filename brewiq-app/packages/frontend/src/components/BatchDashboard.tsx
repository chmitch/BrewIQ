import { VegaVisual, useCssTheme } from '@microsoft/fabric-visuals';
import type { BatchRecord } from '@rayfin-app/shared';
import { ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { RecipePanel, YeastPanel } from '@/components/LibraryPanels';
import { ErrorState, LoadingState } from '@/components/states';
import type { Library } from '@/hooks/use-library';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { abv, attenuation, formatSg } from '@/lib/brew-math';
import { markUtc, parseUtc } from '@/lib/dax-datetime';
import { toDataTable } from '@/lib/to-data-table';
import { batchSeries, batchSummary } from '@/queries';

const REFRESH_MS = 60_000;

const PRESETS = [
  { id: 'all', label: 'Whole batch', hours: null },
  { id: '24h', label: 'Last 24 h', hours: 24 },
  { id: '3d', label: 'Last 3 days', hours: 72 },
  { id: '7d', label: 'Last 7 days', hours: 168 },
] as const;

type PresetId = (typeof PRESETS)[number]['id'] | 'custom';

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Stat({
  label,
  value,
  unit,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly note?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-400">
      <p className="text-200 text-muted-foreground">{label}</p>
      <p className="mt-100 font-numeric text-hero-800 font-semibold leading-hero-800">
        {value}
        {unit ? (
          <span className="ml-100 text-400 text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      {note ? <p className="mt-100 text-200 text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function ChartCard({
  title,
  children,
  className = '',
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      className={`flex h-[340px] flex-col rounded-2xl border border-border bg-card shadow-sm p-400 ${className}`}
    >
      <h3 className="mb-300 font-heading text-400 font-semibold">{title}</h3>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function BatchDashboard({
  batch,
  onBack,
  onComplete,
  onRecalculate,
  recalculating,
  pending,
  library,
  onLink,
}: {
  readonly library: Library;
  readonly onLink: (b: BatchRecord, link: { recipeId?: string; yeastId?: string }) => void;
  readonly batch: BatchRecord;
  readonly onBack: () => void;
  readonly onComplete: (b: BatchRecord) => void;
  readonly onRecalculate: (b: BatchRecord) => void;
  readonly recalculating: boolean;
  readonly pending: boolean;
}) {
  const theme = useCssTheme();
  const isActive = !batch.endDate;
  const [tab, setTab] = useState<'telemetry' | 'recipe' | 'yeast'>('telemetry');

  // Advancing `tick` moves the window's end, which changes the query text and
  // re-runs it: that is the once-a-minute refresh. A finished batch never ticks.
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTick(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, [isActive]);

  const batchEnd = useMemo(
    () => batch.endDate ?? new Date(Math.floor(tick / 60_000) * 60_000),
    [batch.endDate, tick]
  );

  const [preset, setPreset] = useState<PresetId>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from, to } = useMemo(() => {
    const start = batch.startDate.getTime();
    const end = batchEnd.getTime();
    let f = start;
    let t = end;
    if (preset === 'custom') {
      const cf = customFrom ? new Date(customFrom).getTime() : NaN;
      const ct = customTo ? new Date(customTo).getTime() : NaN;
      if (!Number.isNaN(cf)) f = Math.max(start, cf);
      if (!Number.isNaN(ct)) t = Math.min(end, ct);
    } else {
      const hours = PRESETS.find((p) => p.id === preset)?.hours;
      if (hours) f = Math.max(start, end - hours * 3_600_000);
    }
    return { from: new Date(f), to: new Date(Math.max(f, t)) };
  }, [batch.startDate, batchEnd, preset, customFrom, customTo]);

  // Guides come from the linked yeast's range and the recipe OG with the yeast's attenuation; none if unlinked.
  const yeast = batch.yeastId ? library.yeastById.get(batch.yeastId) : undefined;
  const recipe = batch.recipeId ? library.recipeById.get(batch.recipeId) : undefined;
  const hasYeastRange = yeast?.tempMinTenthsF != null && yeast?.tempMaxTenthsF != null;
  const tempMin = hasYeastRange ? yeast.tempMinTenthsF! / 10 : null;
  const tempMax = hasYeastRange ? yeast.tempMaxTenthsF! / 10 : null;
  // Expected FG = 1 + (OG - 1) * (1 - attenuation), using the yeast's attenuation range; none without both.
  const og = (recipe?.ogPoints ?? batch.targetOGPoints) / 1000;
  const attMin = yeast?.attenuationMinPct;
  const attMax = yeast?.attenuationMaxPct;
  const expectedFg =
    og > 1 && attMin != null && attMax != null
      ? (() => {
          const fgAt = (att: number) => 1 + (og - 1) * (1 - att / 100);
          return { low: fgAt(attMax), high: fgAt(attMin), mid: fgAt((attMin + attMax) / 2) };
        })()
      : null;
  const series = batchSeries({
    from,
    to,
    temperatureGuides:
      tempMin != null && tempMax != null
        ? {
            band: { from: tempMin, to: tempMax, color: '#16a34a' },
            lines: [
              { value: tempMin, label: `Floor ${tempMin.toFixed(0)}°F`, color: '#16a34a' },
              { value: tempMax, label: `Ceiling ${tempMax.toFixed(0)}°F`, color: '#16a34a' },
            ],
          }
        : undefined,
    gravityGuides: expectedFg
      ? {
          band: { from: expectedFg.low, to: expectedFg.high, color: '#2563eb' },
          lines: [{ value: expectedFg.mid, label: `Expected FG ${expectedFg.mid.toFixed(3)}`, color: '#2563eb' }],
        }
      : undefined,
  });
  const summary = batchSummary({ from: batch.startDate, to: batchEnd });
  // A completed batch carries its final metrics, so skip the summary query.
  const stored = !isActive && batch.ogPoints != null && batch.fgPoints != null;

  const seriesQ = useSemanticModelQuery({
    connection: series.connection,
    query: series.query,
  });
  const summaryQ = useSemanticModelQuery({
    connection: summary.connection,
    query: stored ? '' : summary.query,
  });

  const stats = useMemo(() => {
    if (summaryQ.data?.status !== 'success') return null;
    const { columns, rows } = summaryQ.data.table;
    const row = rows[0];
    if (!row) return null;
    const at = (name: string) => row[columns.findIndex((c) => c.name === name)];
    const readings = Number(at('[Readings]') ?? 0);
    if (!readings) return null;
    return {
      readings,
      og: Number(at('[FirstGravity]')),
      current: Number(at('[LastGravity]')),
      temp: Number(at('[LastTemperature]')),
      lastTime: parseUtc(at('[LastTime]')),
    };
  }, [summaryQ.data]);

  const seriesError =
    seriesQ.error?.message ??
    (seriesQ.data?.status === 'error' ? seriesQ.data.error.message : null);
  const summaryError =
    summaryQ.error?.message ??
    (summaryQ.data?.status === 'error' ? summaryQ.data.error.message : null);

  const seriesTable =
    seriesQ.data?.status === 'success'
      ? toDataTable(markUtc(seriesQ.data.table, '[Hour]'), series.columnMetadata)
      : null;

  const realStats = stored
    ? {
        og: (batch.ogPoints ?? 0) / 1000,
        current: (batch.fgPoints ?? 0) / 1000,
        temp: (batch.avgTempTenthsF ?? 0) / 10,
        lastTime: batchEnd as Date | null,
        abv: batch.abvTenths != null ? batch.abvTenths / 10 : null,
        attenuation: batch.attenuationPct ?? null,
        minTemp: batch.minTempTenthsF != null ? batch.minTempTenthsF / 10 : null,
        maxTemp: batch.maxTempTenthsF != null ? batch.maxTempTenthsF / 10 : null,
      }
    : stats
      ? {
          ...stats,
          abv: abv(stats.og, stats.current),
          attenuation: attenuation(stats.og, stats.current),
          minTemp: null,
          maxTemp: null,
        }
      : null;
  const fermentDays = Math.max(
    1,
    Math.round((batchEnd.getTime() - batch.startDate.getTime()) / 86_400_000)
  );
  const batchImage = batch.recipeId ? library.recipeById.get(batch.recipeId)?.imageUrl : undefined;

  return (
    <div className="space-y-600">
      <div className="flex flex-wrap items-center gap-300">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-100 rounded-lg px-200 py-100 text-300 text-muted-foreground hover:bg-hover"
        >
          <ArrowLeft className="icon-size-200" /> Batches
        </button>
        {batchImage ? (
          <img
            src={batchImage}
            alt=""
            referrerPolicy="no-referrer"
            className="h-20 w-20 shrink-0 rounded-xl border border-border bg-card object-contain"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-hero-700 font-bold leading-hero-700">
            {batch.name}
          </h1>
          <p className="text-300 text-muted-foreground">
            {batch.yeast} · target OG {(batch.targetOGPoints / 1000).toFixed(3)}{' '}
            · {isActive ? 'fermenting' : `completed · ${fermentDays} ${fermentDays === 1 ? 'day' : 'days'}`}
          </p>
        </div>
        {isActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onComplete(batch)}
            className="inline-flex items-center gap-200 rounded-lg border border-border bg-card px-400 py-200 text-300 font-medium hover:bg-hover disabled:opacity-50"
          >
            <CheckCircle2 className="icon-size-200" /> Complete batch
          </button>
        ) : (
          <button
            type="button"
            disabled={recalculating}
            onClick={() => onRecalculate(batch)}
            className="inline-flex items-center gap-200 rounded-lg border border-border bg-card px-400 py-200 text-300 font-medium hover:bg-hover disabled:opacity-50"
          >
            <RefreshCw className={`icon-size-200 ${recalculating ? 'animate-spin' : ''}`} />{' '}
            {recalculating ? 'Calculating…' : stored ? 'Recalculate metrics' : 'Calculate metrics'}
          </button>
        )}
      </div>

      <div role="tablist" className="flex gap-200 border-b border-border">
        {(
          [
            ['telemetry', 'Telemetry'],
            ['recipe', 'Recipe'],
            ['yeast', 'Yeast'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-400 py-200 text-300 font-medium ${
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'recipe' ? (
        <RecipePanel key={`${batch.recipeId}-${batch.yeastId}`} batch={batch} library={library} onLink={onLink} />
      ) : tab === 'yeast' ? (
        <YeastPanel key={`${batch.recipeId}-${batch.yeastId}`} batch={batch} library={library} onLink={onLink} />
      ) : (
        <>
      {summaryError ? <ErrorState message={summaryError} onRetry={() => void summaryQ.refetch()} /> : null}

      <div className="grid grid-cols-2 gap-400 lg:grid-cols-5">
        <Stat
          label="Actual OG"
          value={formatSg(realStats?.og)}
          note={`target ${(batch.targetOGPoints / 1000).toFixed(3)}`}
        />
        <Stat
          label={isActive ? 'Current gravity' : 'FG'}
          value={formatSg(realStats?.current)}
          note={
            realStats?.lastTime
              ? `as of ${realStats.lastTime.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
              : undefined
          }
        />
        <Stat
          label={stored ? 'Avg temperature' : 'Temperature'}
          value={realStats ? realStats.temp.toFixed(1) : '—'}
          unit="°F"
          note={
            realStats?.minTemp != null && realStats.maxTemp != null
              ? `range ${realStats.minTemp.toFixed(1)}–${realStats.maxTemp.toFixed(1)}`
              : undefined
          }
        />
        <Stat
          label={isActive ? 'ABV so far' : 'ABV'}
          value={realStats?.abv != null ? realStats.abv.toFixed(1) : '—'}
          unit="%"
        />
        <Stat
          label="Attenuation"
          value={realStats?.attenuation != null ? realStats.attenuation.toFixed(0) : '—'}
          unit="%"
        />
      </div>

      <div className="flex flex-wrap items-end gap-200">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`rounded-full border px-400 py-100 text-300 ${
              preset === p.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-hover'
            }`}
          >
            {p.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-200 text-200 text-muted-foreground">
          From
          <input
            type="datetime-local"
            value={customFrom || toLocalInput(from)}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setPreset('custom');
            }}
            className="rounded-lg border border-input bg-background px-200 py-100 text-300 text-foreground"
          />
        </label>
        <label className="flex items-center gap-200 text-200 text-muted-foreground">
          To
          <input
            type="datetime-local"
            value={customTo || toLocalInput(to)}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setPreset('custom');
            }}
            className="rounded-lg border border-input bg-background px-200 py-100 text-300 text-foreground"
          />
        </label>
      </div>

      {seriesError ? (
        <ErrorState message={seriesError} onRetry={() => void seriesQ.refetch()} />
      ) : !seriesTable ? (
        <LoadingState rows={2} />
      ) : seriesTable.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-800 text-center text-300 text-muted-foreground">
          No readings in this window yet. Telemetry can lag by a few minutes.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-400 lg:grid-cols-5">
          <ChartCard title="Gravity over time" className="lg:col-span-3">
            <VegaVisual spec={series.gravitySpec} data={seriesTable} theme={theme} />
          </ChartCard>
          <ChartCard title="Fermentation temperature" className="lg:col-span-2">
            <VegaVisual spec={series.temperatureSpec} data={seriesTable} theme={theme} />
          </ChartCard>
        </div>
      )}

      {isActive ? (
        <p className="text-200 text-muted-foreground">
          Refreshes every minute.
        </p>
      ) : null}
        </>
      )}
    </div>
  );
}
