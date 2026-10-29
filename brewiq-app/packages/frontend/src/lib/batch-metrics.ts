import type { BatchRecord } from '@rayfin-app/shared';

import { executeSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { abv, attenuation, toPoints } from '@/lib/brew-math';
import { batchSummary } from '@/queries';

export type BatchMetrics = Pick<
  BatchRecord,
  | 'ogPoints'
  | 'fgPoints'
  | 'abvTenths'
  | 'attenuationPct'
  | 'minTempTenthsF'
  | 'maxTempTenthsF'
  | 'avgTempTenthsF'
  | 'readings'
>;

const tenths = (n: number) => Math.round(n * 10);

/**
 * Final metrics for a batch window, from the telemetry. Returns null when the
 * window has no readings, so the caller can still complete the batch.
 */
export async function computeBatchMetrics(
  from: Date,
  to: Date
): Promise<BatchMetrics | null> {
  const { connection, query } = batchSummary({ from, to });
  const result = await executeSemanticModelQuery(connection, query);
  if (result.status !== 'success') {
    throw new Error(result.error.message);
  }
  const { columns, rows } = result.table;
  const row = rows[0];
  if (!row) return null;
  const at = (name: string) => Number(row[columns.findIndex((c) => c.name === name)]);

  const readings = at('[Readings]');
  if (!readings) return null;
  const og = at('[FirstGravity]');
  const fg = at('[LastGravity]');
  const att = attenuation(og, fg);

  return {
    ogPoints: toPoints(og),
    fgPoints: toPoints(fg),
    abvTenths: tenths(abv(og, fg)),
    attenuationPct: att == null ? null : Math.round(att),
    minTempTenthsF: tenths(at('[MinTemperature]')),
    maxTempTenthsF: tenths(at('[MaxTemperature]')),
    avgTempTenthsF: tenths(at('[AvgTemperature]')),
    readings,
  };
}
