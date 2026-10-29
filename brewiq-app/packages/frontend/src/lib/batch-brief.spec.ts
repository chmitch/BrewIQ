import { buildBatchBrief, type BriefReading, type BriefYeast } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

const START = new Date('2026-07-01T12:00:00Z');
const HOUR = 3_600_000;

const ale: BriefYeast = {
  name: 'Ale yeast',
  tempMinF: 62,
  tempMaxF: 72,
  attenuationMinPct: 73,
  attenuationMaxPct: 77,
};

/** Hourly readings. `gravityAt` and `tempAt` take hours since the start. */
function series(hours: number, gravityAt: (h: number) => number, tempAt: (h: number) => number): BriefReading[] {
  return Array.from({ length: hours + 1 }, (_, h) => ({
    t: new Date(START.getTime() + h * HOUR),
    gravity: gravityAt(h),
    tempF: tempAt(h),
  }));
}

// OG 1.050 falling to 1.0125 over 10 days.
const healthy = (h: number) => 1.0125 + 0.0375 * (1 - Math.min(1, Math.max(0, (h - 12) / 228)));

const brief = (readings: BriefReading[], extra = {}) =>
  buildBatchBrief({ batch: { name: 'Test', startDate: START }, yeast: ale, readings, ...extra });

const codes = (b: ReturnType<typeof brief>) => b.findings.map((f) => f.code);

describe('buildBatchBrief', () => {
  it('calls a finished, in-range batch complete with no warnings', () => {
    const b = brief(series(300, healthy, () => 67));
    expect(b.gravity.phase).toBe('stable');
    expect(b.gravity.expectedFg?.mid).toBeCloseTo(1.0125, 3);
    expect(b.gravity.progressPct).toBeGreaterThan(95);
    expect(b.temperature.status).toBe('in-range');
    expect(codes(b)).toEqual(['FG_REACHED']);
  });

  it('flags a stall when gravity stops well above the expected FG', () => {
    const stalled = (h: number) => (h < 96 ? 1.05 - (0.02 * h) / 96 : 1.03);
    const b = brief(series(200, stalled, () => 67));
    expect(b.gravity.phase).toBe('stalled');
    expect(codes(b)).toContain('STALLED');
    expect(codes(b)).not.toContain('FG_REACHED');
  });

  it('flags a ferment that never started', () => {
    const b = brief(series(72, () => 1.05, () => 67));
    expect(b.gravity.phase).toBe('stalled');
    expect(codes(b)).toContain('STALLED');
  });

  it('is still in lag early on', () => {
    const b = brief(series(20, () => 1.05, () => 67));
    expect(b.gravity.phase).toBe('lag');
    expect(codes(b)).not.toContain('STALLED');
  });

  it('flags a temperature far above the ceiling as critical', () => {
    const b = brief(series(100, (h) => 1.05 - h * 0.0002, () => 78));
    expect(b.temperature.status).toBe('above');
    expect(b.findings.find((f) => f.code === 'TEMP_TOO_HIGH')?.severity).toBe('critical');
  });

  it('flags a cold ferment and time out of range', () => {
    const b = brief(series(100, (h) => 1.05 - h * 0.0002, () => 59));
    expect(b.temperature.status).toBe('below');
    expect(codes(b)).toContain('TEMP_LOW');
    expect(codes(b)).toContain('OFTEN_OUT_OF_RANGE');
    expect(b.temperature.hoursBelowRange).toBeGreaterThan(90);
  });

  it('flags large daily temperature swings', () => {
    const b = brief(series(100, (h) => 1.05 - h * 0.0002, (h) => 67 + 4.5 * Math.sin((h * Math.PI) / 12)));
    expect(codes(b)).toContain('TEMP_SWINGS');
  });

  it('omits expected FG and range checks without a yeast', () => {
    const b = buildBatchBrief({ batch: { name: 'Test', startDate: START }, readings: series(100, healthy, () => 80) });
    expect(b.gravity.expectedFg).toBeNull();
    expect(b.temperature.status).toBe('unknown');
    expect(codes(b)).not.toContain('TEMP_TOO_HIGH');
  });

  it('reports anomalies and thins the series', () => {
    const b = brief(series(300, healthy, () => 67), {
      anomalies: [{ t: new Date(START.getTime() + 50 * HOUR), metric: 'gravity', value: 1.06, deviation: 0.012 }],
    });
    expect(b.anomalies).toMatchObject({ total: 1, gravity: 1, temperature: 0 });
    expect(codes(b)).toContain('ANOMALIES');
    expect(b.series.length).toBeLessThanOrEqual(120);
    expect(b.series[0].t).toBe(START.toISOString());
  });

  it('handles a batch with no readings', () => {
    const b = brief([]);
    expect(b.gravity.phase).toBe('no-data');
    expect(codes(b)).toEqual(['NO_DATA']);
  });
});
