import { VegaVisual, useCssTheme } from '@microsoft/fabric-visuals';
import type { BatchRecord } from '@rayfin-app/shared';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { BatchAnalysis } from '@/components/BatchAnalysis';
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

type Tone = 'warn' | 'bad';
type Flag = { readonly tone: Tone; readonly text: string } | undefined;

const TONE_CLASS: Record<Tone | 'none', string> = {
  none: 'border-border bg-card',
  warn: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
  bad: 'border-red-500 bg-red-50 dark:bg-red-950/30',
};

function Stat({
  label,
  value,
  unit,
  note,
  flag,
}: {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly note?: string;
  readonly flag?: Flag;
}) {
  return (
    <div className={`rounded-2xl border shadow-sm p-400 ${TONE_CLASS[flag?.tone ?? 'none']}`}>
      <p className="text-200 text-muted-foreground">{label}</p>
      <p className="mt-100 font-numeric text-hero-800 font-semibold leading-hero-800">
        {value}
        {unit ? (
          <span className="ml-100 text-400 text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      {note ? <p className="mt-100 text-200 text-muted-foreground">{note}</p> : null}
      {flag ? (
        <p
          role="status"
          className={`mt-200 flex items-start gap-100 text-200 font-medium ${flag.tone === 'bad' ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}
        >
          <AlertTriangle className="icon-size-200 shrink-0" aria-hidden />
          {flag.text}
        </p>
      ) : null}
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
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);

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

  // Cards turn amber or red when a reading leaves the range implied by the linked recipe and yeast.
  const flags = (() => {
    const out: { og?: Flag; gravity?: Flag; temp?: Flag; att?: Flag } = {};
    if (!realStats) return out;
    const f2 = (n: number) => n.toFixed(3);
    const ogDiff = realStats.og - batch.targetOGPoints / 1000;
    if (Math.abs(ogDiff) >= 0.005)
      out.og = { tone: 'warn', text: `${ogDiff > 0 ? 'Above' : 'Below'} target OG by ${Math.abs(ogDiff * 1000).toFixed(0)} points` };

    if (expectedFg) {
      const g = realStats.current;
      const verb = isActive ? 'is' : 'ended';
      if (g < expectedFg.low - 0.003)
        out.gravity = { tone: 'bad', text: `Gravity ${verb} below the lowest expected FG (${f2(expectedFg.low)}). Check for over-attenuation or infection.` };
      else if (g < expectedFg.low - 0.001)
        out.gravity = { tone: 'warn', text: `Gravity ${verb} just below the expected FG range (${f2(expectedFg.low)}–${f2(expectedFg.high)})` };
      else if (!isActive && g > expectedFg.high + 0.003)
        out.gravity = { tone: 'warn', text: `Finished above the expected FG range (${f2(expectedFg.low)}–${f2(expectedFg.high)}). Fermentation may have stalled.` };
    }

    if (attMin != null && attMax != null && realStats.attenuation != null) {
      const a = realStats.attenuation;
      if (a > attMax + 3)
        out.att = { tone: 'bad', text: `Well above this yeast's ${attMin}–${attMax}% range` };
      else if (a > attMax)
        out.att = { tone: 'warn', text: `Above this yeast's ${attMin}–${attMax}% range` };
      else if (!isActive && a < attMin - 3)
        out.att = { tone: 'warn', text: `Below this yeast's ${attMin}–${attMax}% range` };
    }

    if (tempMin != null && tempMax != null) {
      const lo = stored ? (realStats.minTemp ?? realStats.temp) : realStats.temp;
      const hi = stored ? (realStats.maxTemp ?? realStats.temp) : realStats.temp;
      const over = hi - tempMax;
      const under = tempMin - lo;
      const worst = Math.max(over, under);
      if (worst > 0) {
        const where = over >= under ? `above ${tempMax}°F` : `below ${tempMin}°F`;
        out.temp = {
          tone: worst >= 4 ? 'bad' : 'warn',
          text: `${isActive ? 'Now' : 'Reached'} ${worst.toFixed(1)}°F ${where} (yeast range ${tempMin.toFixed(0)}–${tempMax.toFixed(0)}°F)`,
        };
      }
    }
    return out;
  })();
  const batchImage = batch.recipeId ? library.recipeById.get(batch.recipeId)?.imageUrl : undefined;

  return (
    <div
      className="space-y-600 transition-[padding] lg:pr-[var(--drawer-pad)]"
      style={{ '--drawer-pad': analysisOpen ? 'max(0px, calc(30rem - (100vw - 72rem) / 2))' : '0px' } as React.CSSProperties}
    >
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
        <button
          type="button"
          aria-pressed={analysisOpen}
          onClick={() => {
            setAnalysisStarted(true);
            setAnalysisOpen((o) => !o);
          }}
          className={`inline-flex items-center gap-200 rounded-lg border px-400 py-200 text-300 font-medium ${
            analysisOpen ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-hover'
          }`}
        >
          <Sparkles className="icon-size-200" /> Analyze
        </button>
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
          flag={flags.og}
        />
        <Stat
          label={isActive ? 'Current gravity' : 'FG'}
          value={formatSg(realStats?.current)}
          note={
            realStats?.lastTime
              ? `as of ${realStats.lastTime.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
              : undefined
          }
          flag={flags.gravity}
        />
        <Stat
          label={stored ? 'Avg temperature' : 'Temperature'}
          flag={flags.temp}
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
          flag={flags.att}
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

      <aside
        aria-label="Batch analysis"
        aria-hidden={!analysisOpen}
        className={`fixed bottom-0 right-0 top-16 z-20 w-full max-w-[30rem] flex-col border-l border-border bg-background shadow-xl ${
          analysisOpen ? 'flex' : 'hidden'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-500 py-300">
          <h2 className="font-heading text-400 font-semibold">Batch analysis</h2>
          <button
            type="button"
            onClick={() => setAnalysisOpen(false)}
            aria-label="Close analysis"
            className="rounded-lg p-200 hover:bg-hover"
          >
            <X className="icon-size-200" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-500">
          {analysisStarted ? <BatchAnalysis key={batch.id} batch={batch} library={library} /> : null}
        </div>
      </aside>
    </div>
  );
}
