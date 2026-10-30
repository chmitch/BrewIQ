import { buildBatchBrief, type BatchRecord, type BriefReading } from '@rayfin-app/shared';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Library } from '@/hooks/use-library';
import { executeSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { parseUtc } from '@/lib/dax-datetime';
import { getRayfinClient } from '@/lib/rayfin-client';
import { batchSeries } from '@/queries';

type Analysis = Extract<
  Awaited<ReturnType<Awaited<ReturnType<typeof getRayfinClient>>['functions']['analyzeBatch']['invoke']>>,
  { ok: true }
>;

const HEALTH = {
  good: { label: 'Healthy', cls: 'bg-green-100 text-green-800' },
  watch: { label: 'Keep an eye on it', cls: 'bg-amber-100 text-amber-800' },
  problem: { label: 'Needs attention', cls: 'bg-red-100 text-red-800' },
} as const;

const SEVERITY = {
  info: 'border-border',
  warning: 'border-amber-400',
  critical: 'border-red-500',
} as const;

const TRANSIENT = /evicted|canceled|cancelled|throttl|capacity|timeout|temporar/i;

async function querySeries(batch: BatchRecord) {
  const end = batch.endDate ?? new Date();
  const { connection, query } = batchSeries({ from: batch.startDate, to: end });
  let message = '';
  // The capacity can evict the model under CPU load; a short wait usually clears it.
  for (const waitMs of [0, 4000, 10000]) {
    if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
    const result = await executeSemanticModelQuery(connection, query);
    if (result.status === 'success') return result.table;
    message = result.error.message;
    if (!TRANSIENT.test(message)) break;
  }
  throw new Error(message);
}

async function analyze(batch: BatchRecord, library: Library): Promise<Analysis> {
  const { columns, rows } = await querySeries(batch);
  const col = (n: string) => columns.findIndex((c) => c.name === n);
  const [hour, grav, temp] = [col('[Hour]'), col('[Gravity]'), col('[Temperature]')];
  const readings: BriefReading[] = [];
  for (const row of rows) {
    const t = parseUtc(row[hour]);
    if (t) readings.push({ t, gravity: Number(row[grav]), tempF: Number(row[temp]) });
  }

  const y = batch.yeastId ? library.yeastById.get(batch.yeastId) : undefined;
  const r = batch.recipeId ? library.recipeById.get(batch.recipeId) : undefined;
  const brief = buildBatchBrief({
    batch: {
      name: batch.name,
      startDate: batch.startDate,
      endDate: batch.endDate,
      targetOGPoints: batch.targetOGPoints,
    },
    recipe: r && {
      name: r.name,
      style: r.style,
      ogPoints: r.ogPoints,
      abvTenths: r.abvTenths,
      primaryDaysMin: r.primaryDaysMin,
      primaryDaysMax: r.primaryDaysMax,
      totalWeeks: r.totalWeeks,
      pitchTempMaxF: r.pitchTempMaxTenthsF != null ? r.pitchTempMaxTenthsF / 10 : null,
    },
    yeast: y && {
      name: y.name,
      tempMinF: y.tempMinTenthsF != null ? y.tempMinTenthsF / 10 : null,
      tempMaxF: y.tempMaxTenthsF != null ? y.tempMaxTenthsF / 10 : null,
      attenuationMinPct: y.attenuationMinPct,
      attenuationMaxPct: y.attenuationMaxPct,
      flocculation: y.flocculation,
      abvTolerance: y.abvTolerance,
    },
    readings,
    now: batch.endDate ? undefined : new Date(),
  });

  const res = await (await getRayfinClient()).functions.analyzeBatch.invoke({
    briefJson: JSON.stringify(brief),
  });
  if (!res.ok) throw new Error(res.message);
  return res;
}

export function BatchAnalysis({
  batch,
  library,
}: {
  readonly batch: BatchRecord;
  readonly library: Library;
}) {
  const [state, setState] = useState<
    | { status: 'running' }
    | { status: 'error'; message: string }
    | { status: 'done'; analysis: Analysis; at: Date }
  >({ status: 'running' });

  const fetchAnalysis = async () => {
    try {
      setState({ status: 'done', analysis: await analyze(batch, library), at: new Date() });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const run = () => {
    setState({ status: 'running' });
    void fetchAnalysis();
  };

  // Opening the panel is the request: the first analysis starts as soon as it mounts.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set only after the awaited fetch
    void fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-400">
      <div className="flex flex-wrap items-center gap-300">
        <button
          type="button"
          disabled={state.status === 'running'}
          onClick={run}
          className="inline-flex items-center gap-200 rounded-lg bg-primary px-400 py-200 text-300 font-medium text-primary-foreground disabled:opacity-50"
        >
          <Sparkles className={`icon-size-200 ${state.status === 'running' ? 'animate-pulse' : ''}`} />
          {state.status === 'running' ? 'Analyzing…' : 'Analyze again'}
        </button>
        <p className="text-200 text-muted-foreground">
          An AI brewing analyst reviews this batch&apos;s gravity and temperature history, recipe and yeast.
        </p>
      </div>

      {state.status === 'error' ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-400 text-300 text-red-800">
          {state.message}
        </div>
      ) : null}

      {state.status === 'done' ? (
        <div className="space-y-400">
          <section className="rounded-2xl border border-border bg-card p-400 shadow-sm">
            <span className={`rounded-full px-300 py-100 text-200 font-medium ${HEALTH[state.analysis.health].cls}`}>
              {HEALTH[state.analysis.health].label}
            </span>
            <p className="mt-300 text-400">{state.analysis.summary}</p>
          </section>
          {state.analysis.findings.map((f, i) => (
            <section
              key={`${i}-${f.title}`}
              className={`rounded-2xl border-l-4 border bg-card p-400 shadow-sm ${SEVERITY[f.severity]}`}
            >
              <h3 className="font-heading text-400 font-semibold">{f.title}</h3>
              <p className="mt-100 text-300 text-muted-foreground">{f.evidence}</p>
              <p className="mt-200 text-300">{f.recommendation}</p>
            </section>
          ))}
          {state.analysis.nextCheck ? (
            <p className="text-300">
              <span className="font-medium">Next check:</span> {state.analysis.nextCheck}
            </p>
          ) : null}
          <p className="text-200 text-muted-foreground">
            Generated {state.at.toLocaleTimeString()} by {state.analysis.model}. AI advice can be wrong; use your judgement.
          </p>
        </div>
      ) : null}
    </div>
  );
}
