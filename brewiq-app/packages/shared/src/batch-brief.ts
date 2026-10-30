/**
 * Builds a compact, deterministic "brief" for one batch: the numbers and candidate
 * findings an analysis agent reasons over, so it never has to read raw time series.
 *
 * Isomorphic and dependency-free: it runs in the browser, in a function, or in a test.
 * Gravity is in specific gravity (1.050), temperature in degrees F.
 */

import { findBeerStyle } from './beer-styles.js';

const HOUR = 3_600_000;
const SERIES_POINTS = 120;

export interface BriefReading {
  t: Date;
  gravity: number;
  tempF: number;
}

export interface BriefAnomaly {
  t: Date;
  metric: 'gravity' | 'temperature';
  value: number;
  /** Distance from the expected value, in SG or degrees F. */
  deviation: number;
}

export interface BriefYeast {
  name: string;
  tempMinF?: number | null;
  tempMaxF?: number | null;
  attenuationMinPct?: number | null;
  attenuationMaxPct?: number | null;
  flocculation?: string | null;
  abvTolerance?: string | null;
}

export interface BriefRecipe {
  name: string;
  style?: string | null;
  ogPoints?: number | null;
  abvTenths?: number | null;
  primaryDaysMin?: number | null;
  primaryDaysMax?: number | null;
  totalWeeks?: number | null;
  pitchTempMaxF?: number | null;
}

export interface BriefInput {
  batch: { name: string; startDate: Date; endDate?: Date | null; targetOGPoints?: number | null };
  recipe?: BriefRecipe | null;
  yeast?: BriefYeast | null;
  /** Ascending by time. */
  readings: readonly BriefReading[];
  anomalies?: readonly BriefAnomaly[];
  /** Defaults to the last reading, so a stored batch analyses the same way every time. */
  now?: Date;
}

export type GravityPhase = 'no-data' | 'lag' | 'active' | 'slowing' | 'stable' | 'stalled';
export type FindingSeverity = 'info' | 'warning' | 'critical';

export interface BriefFinding {
  code: string;
  severity: FindingSeverity;
  evidence: string;
}

export interface BatchBrief {
  batch: {
    name: string;
    style: string | null;
    status: 'active' | 'likely-complete' | 'completed';
    startedAt: string;
    elapsedDays: number;
    readings: number;
    lastReadingAt: string | null;
    minutesSinceLastReading: number | null;
  };
  yeast: {
    name: string;
    tempRangeF: [number, number] | null;
    attenuationRangePct: [number, number] | null;
    flocculation: string | null;
    abvTolerance: string | null;
  } | null;
  recipe: {
    name: string;
    ogTarget: number | null;
    abvPct: number | null;
    primaryDays: [number, number] | null;
  } | null;
  /** BJCP 2021 vital statistics for the recipe's style, and where this batch sits against them. */
  styleGuide: {
    code: string;
    name: string;
    og: [number, number] | null;
    fg: [number, number] | null;
    abv: [number, number] | null;
    ibu: [number, number] | null;
    ogVsStyle: 'below' | 'within' | 'above' | null;
    fgVsStyle: 'below' | 'within' | 'above' | null;
  } | null;
  gravity: {
    og: number | null;
    current: number | null;
    expectedFg: { low: number; mid: number; high: number } | null;
    attenuationPct: number | null;
    /** Share of the expected drop already achieved, 0-100+. */
    progressPct: number | null;
    changeLast24hPoints: number | null;
    changeLast72hPoints: number | null;
    phase: GravityPhase;
  };
  temperature: {
    current: number | null;
    min: number | null;
    max: number | null;
    avg: number | null;
    last24h: { min: number; max: number; avg: number } | null;
    trend: 'rising' | 'falling' | 'steady' | null;
    hoursBelowRange: number;
    hoursAboveRange: number;
    pctHoursInRange: number | null;
    status: 'in-range' | 'below' | 'above' | 'unknown';
  };
  anomalies: {
    total: number;
    gravity: number;
    temperature: number;
    recent: { at: string; metric: string; value: number; deviation: number }[];
  };
  findings: BriefFinding[];
  /** Evenly thinned series for context or charts. */
  series: { t: string; g: number; f: number }[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (n: number | null, d: number) => (n == null ? null : Number(n.toFixed(d)));

function windowMean(rs: readonly BriefReading[], pick: (r: BriefReading) => number, center: number, half: number) {
  return mean(rs.filter((r) => Math.abs(r.t.getTime() - center) <= half).map(pick));
}

function thin<T>(xs: readonly T[], max: number): T[] {
  if (xs.length <= max) return [...xs];
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(xs[Math.round((i * (xs.length - 1)) / (max - 1))]);
  return out;
}

export function buildBatchBrief(input: BriefInput): BatchBrief {
  const { batch, recipe, yeast } = input;
  const rs = input.readings;
  const last = rs.at(-1) ?? null;
  const end = batch.endDate ?? input.now ?? last?.t ?? batch.startDate;
  const elapsedH = Math.max(0, (end.getTime() - batch.startDate.getTime()) / HOUR);
  const findings: BriefFinding[] = [];
  const add = (code: string, severity: FindingSeverity, evidence: string) =>
    findings.push({ code, severity, evidence });

  const tempRange: [number, number] | null =
    yeast?.tempMinF != null && yeast?.tempMaxF != null ? [yeast.tempMinF, yeast.tempMaxF] : null;
  const attRange: [number, number] | null =
    yeast?.attenuationMinPct != null && yeast?.attenuationMaxPct != null
      ? [yeast.attenuationMinPct, yeast.attenuationMaxPct]
      : null;

  // Gravity
  const ogTarget = recipe?.ogPoints ? recipe.ogPoints / 1000 : batch.targetOGPoints ? batch.targetOGPoints / 1000 : null;
  const early = rs.slice(0, 6).map((r) => r.gravity).sort((a, b) => a - b);
  const og = early.length ? early[Math.floor(early.length / 2)] : null;
  const current = last ? windowMean(rs, (r) => r.gravity, last.t.getTime(), 2 * HOUR) : null;
  const baseOg = og ?? ogTarget;
  const fgAt = (att: number) => (baseOg ? 1 + (baseOg - 1) * (1 - att / 100) : null);
  const expectedFg =
    attRange && baseOg
      ? { low: fgAt(attRange[1])!, mid: fgAt((attRange[0] + attRange[1]) / 2)!, high: fgAt(attRange[0])! }
      : null;
  const changeOver = (hours: number) => {
    if (!last || current == null || elapsedH < hours) return null;
    const before = windowMean(rs, (r) => r.gravity, last.t.getTime() - hours * HOUR, HOUR);
    return before == null ? null : (current - before) * 1000;
  };
  const d24 = changeOver(24);
  const d48 = changeOver(48);
  const d72 = changeOver(72);
  const dropPts = baseOg != null && current != null ? (baseOg - current) * 1000 : null;
  const attenuationPct = baseOg != null && current != null && baseOg > 1 ? ((baseOg - current) / (baseOg - 1)) * 100 : null;
  const progressPct =
    expectedFg && dropPts != null && baseOg! - expectedFg.mid > 0 ? (dropPts / ((baseOg! - expectedFg.mid) * 1000)) * 100 : null;

  let phase: GravityPhase = 'no-data';
  if (current != null && dropPts != null) {
    const settled = d48 != null ? Math.abs(d48) <= 2 : d24 != null && Math.abs(d24) <= 1;
    if (dropPts < 3) phase = elapsedH < 48 ? 'lag' : 'stalled';
    else if (d24 != null && Math.abs(d24) >= 4) phase = 'active';
    else if (settled) phase = progressPct != null && progressPct < 80 ? 'stalled' : 'stable';
    else phase = 'slowing';
  }

  // Temperature
  const temps = rs.map((r) => r.tempF);
  const recent = last ? rs.filter((r) => r.t.getTime() >= last.t.getTime() - 24 * HOUR) : [];
  const recentTemps = recent.map((r) => r.tempF);
  const now6 = last ? windowMean(rs, (r) => r.tempF, last.t.getTime(), 3 * HOUR) : null;
  const prev6 = last ? windowMean(rs, (r) => r.tempF, last.t.getTime() - 6 * HOUR, 3 * HOUR) : null;
  const trend = now6 != null && prev6 != null && elapsedH >= 12 ? (now6 - prev6 > 1 ? 'rising' : now6 - prev6 < -1 ? 'falling' : 'steady') : null;

  let below = 0;
  let above = 0;
  let inRange = 0;
  let total = 0;
  if (tempRange) {
    for (let i = 1; i < rs.length; i++) {
      const dt = Math.min(3, (rs[i].t.getTime() - rs[i - 1].t.getTime()) / HOUR);
      const f = rs[i].tempF;
      total += dt;
      if (f < tempRange[0]) below += dt;
      else if (f > tempRange[1]) above += dt;
      else inRange += dt;
    }
  }
  const status: BatchBrief['temperature']['status'] =
    !tempRange || now6 == null ? 'unknown' : now6 < tempRange[0] ? 'below' : now6 > tempRange[1] ? 'above' : 'in-range';

  // Style guide
  const style = recipe?.style ? findBeerStyle(recipe.style) : undefined;
  const vs = (v: number | null, r: [number, number] | null | undefined): 'below' | 'within' | 'above' | null =>
    v == null || !r ? null : v < r[0] - 0.0005 ? 'below' : v > r[1] + 0.0005 ? 'above' : 'within';
  const settled = phase === 'stable' || (!!batch.endDate && current != null);
  const ogVsStyle = vs(baseOg, style?.og);
  const fgVsStyle = settled ? vs(current, style?.fg) : null;

  // Anomalies
  const anomalies = input.anomalies ?? [];
  const gAn = anomalies.filter((a) => a.metric === 'gravity').length;
  const tAn = anomalies.length - gAn;

  // Candidate findings (deterministic; the agent explains and prioritises them)
  const f1 = (n: number) => n.toFixed(1);
  const sg = (n: number) => n.toFixed(3);
  if (current == null) add('NO_DATA', 'warning', 'No readings recorded for this batch yet.');
  if (phase === 'stalled' && current != null) {
    add(
      'STALLED',
      'warning',
      `Gravity is ${sg(current)} and has moved ${f1(d48 ?? d24 ?? 0)} points in the last ${d48 != null ? 48 : 24} h` +
        (expectedFg ? `; expected FG is about ${sg(expectedFg.mid)} (${f1(progressPct ?? 0)}% of the expected drop done).` : '.'),
    );
  }
  if (phase === 'stable' && current != null) {
    add(
      'FG_REACHED',
      'info',
      `Gravity has been stable at ${sg(current)}` + (expectedFg ? `; the expected FG is about ${sg(expectedFg.mid)}.` : '.') +
        ' Fermentation looks complete.',
    );
  }
  if (attenuationPct != null && attRange && attenuationPct > attRange[1] + 3) {
    add('OVER_ATTENUATED', 'info', `Attenuation is ${f1(attenuationPct)}%, above the yeast's ${attRange[0]}-${attRange[1]}% range.`);
  }
  if (!batch.endDate && status === 'above' && tempRange && now6 != null) {
    add(now6 - tempRange[1] > 4 ? 'TEMP_TOO_HIGH' : 'TEMP_HIGH', now6 - tempRange[1] > 4 ? 'critical' : 'warning',
      `Temperature is about ${f1(now6)} F, ${f1(now6 - tempRange[1])} F above the yeast ceiling of ${tempRange[1]} F.`);
  }
  if (!batch.endDate && status === 'below' && tempRange && now6 != null) {
    add(tempRange[0] - now6 > 4 ? 'TEMP_TOO_LOW' : 'TEMP_LOW', tempRange[0] - now6 > 4 ? 'critical' : 'warning',
      `Temperature is about ${f1(now6)} F, ${f1(tempRange[0] - now6)} F below the yeast floor of ${tempRange[0]} F.`);
  }
  if (recentTemps.length && Math.max(...recentTemps) - Math.min(...recentTemps) > 6) {
    add('TEMP_SWINGS', 'warning', `Temperature moved ${f1(Math.max(...recentTemps) - Math.min(...recentTemps))} F in the last 24 h.`);
  }
  if (total > 0 && (below + above) / total > 0.25) {
    add('OFTEN_OUT_OF_RANGE', 'warning', `${f1(((below + above) / total) * 100)}% of the batch was outside the yeast range (${f1(below)} h cold, ${f1(above)} h hot).`);
  }
  if (recipe?.primaryDaysMax && elapsedH / 24 > recipe.primaryDaysMax && phase !== 'stable' && !batch.endDate) {
    add('LONGER_THAN_EXPECTED', 'info', `Day ${f1(elapsedH / 24)}; the recipe expects primary fermentation to take up to ${recipe.primaryDaysMax} days.`);
  }
  if (style && current != null && fgVsStyle && fgVsStyle !== 'within' && style.fg) {
    add('FG_OUTSIDE_STYLE', 'info', `Final gravity ${sg(current)} is ${fgVsStyle} the ${style.code} ${style.name} range of ${sg(style.fg[0])}-${sg(style.fg[1])}.`);
  }
  if (anomalies.length) {
    add('ANOMALIES', 'info', `${anomalies.length} anomalous reading(s): ${gAn} gravity, ${tAn} temperature. Likely sensor noise unless they repeat.`);
  }
  const minutesSince = last ? (end.getTime() - last.t.getTime()) / 60_000 : null;
  if (!batch.endDate && minutesSince != null && input.now && minutesSince > 30) {
    add('DATA_STALE', 'warning', `The last reading was ${Math.round(minutesSince)} minutes ago; check the device and connection.`);
  }

  return {
    batch: {
      name: batch.name,
      style: recipe?.style ?? null,
      status: batch.endDate ? 'completed' : phase === 'stable' ? 'likely-complete' : 'active',
      startedAt: batch.startDate.toISOString(),
      elapsedDays: round(elapsedH / 24, 1)!,
      readings: rs.length,
      lastReadingAt: last?.t.toISOString() ?? null,
      minutesSinceLastReading: round(minutesSince, 0),
    },
    yeast: yeast
      ? {
          name: yeast.name,
          tempRangeF: tempRange,
          attenuationRangePct: attRange,
          flocculation: yeast.flocculation ?? null,
          abvTolerance: yeast.abvTolerance ?? null,
        }
      : null,
    recipe: recipe
      ? {
          name: recipe.name,
          ogTarget,
          abvPct: recipe.abvTenths != null ? recipe.abvTenths / 10 : null,
          primaryDays:
            recipe.primaryDaysMin != null && recipe.primaryDaysMax != null ? [recipe.primaryDaysMin, recipe.primaryDaysMax] : null,
        }
      : null,
    styleGuide: style
      ? { code: style.code, name: style.name, og: style.og, fg: style.fg, abv: style.abv, ibu: style.ibu, ogVsStyle, fgVsStyle }
      : null,
    gravity: {
      og: round(og, 3),
      current: round(current, 3),
      expectedFg: expectedFg ? { low: round(expectedFg.low, 3)!, mid: round(expectedFg.mid, 3)!, high: round(expectedFg.high, 3)! } : null,
      attenuationPct: round(attenuationPct, 1),
      progressPct: round(progressPct, 0),
      changeLast24hPoints: round(d24, 1),
      changeLast72hPoints: round(d72, 1),
      phase,
    },
    temperature: {
      current: round(now6, 1),
      min: round(temps.length ? Math.min(...temps) : null, 1),
      max: round(temps.length ? Math.max(...temps) : null, 1),
      avg: round(mean(temps), 1),
      last24h: recentTemps.length
        ? { min: round(Math.min(...recentTemps), 1)!, max: round(Math.max(...recentTemps), 1)!, avg: round(mean(recentTemps), 1)! }
        : null,
      trend,
      hoursBelowRange: round(below, 1)!,
      hoursAboveRange: round(above, 1)!,
      pctHoursInRange: total > 0 ? round((inRange / total) * 100, 0) : null,
      status,
    },
    anomalies: {
      total: anomalies.length,
      gravity: gAn,
      temperature: tAn,
      recent: anomalies.slice(-10).map((a) => ({
        at: a.t.toISOString(),
        metric: a.metric,
        value: a.metric === 'gravity' ? round(a.value, 3)! : round(a.value, 1)!,
        deviation: a.metric === 'gravity' ? round(a.deviation, 3)! : round(a.deviation, 1)!,
      })),
    },
    findings,
    series: thin(rs, SERIES_POINTS).map((r) => ({ t: r.t.toISOString(), g: round(r.gravity, 3)!, f: round(r.tempF, 1)! })),
  };
}
