import type { BatchRecord } from '@rayfin-app/shared';
import { useMemo } from 'react';

import { useAuth } from '@/hooks/auth.context';
import { useCrud, type CrudApi, type UseCrudResult } from '@/components/useCrud';
import { getRayfinClient } from '@/lib/rayfin-client';
import { computeBatchMetrics, type BatchMetrics } from '@/lib/batch-metrics';

const FIELDS = [
  'id',
  'name',
  'startDate',
  'targetOGPoints',
  'yeast',
  'endDate',
  'owner_id',
  'ogPoints',
  'fgPoints',
  'abvTenths',
  'attenuationPct',
  'minTempTenthsF',
  'maxTempTenthsF',
  'avgTempTenthsF',
  'readings',
  'recipeId',
  'yeastId',
] as const;

/** The server may hand dates back as ISO strings; the rest of the app wants Dates. */
function normalize(b: BatchRecord): BatchRecord {
  return {
    ...b,
    startDate: new Date(b.startDate),
    endDate: b.endDate ? new Date(b.endDate) : null,
  };
}

/** Only the metrics that are set; the server rejects explicit nulls on some paths. */
function metricFields(b: Partial<BatchMetrics>): Partial<BatchMetrics> {
  return Object.fromEntries(
    Object.entries(b).filter(
      ([k, v]) => v != null && METRIC_KEYS.includes(k as keyof BatchMetrics)
    )
  );
}

const METRIC_KEYS: (keyof BatchMetrics)[] = [
  'ogPoints',
  'fgPoints',
  'abvTenths',
  'attenuationPct',
  'minTempTenthsF',
  'maxTempTenthsF',
  'avgTempTenthsF',
  'readings',
];

export type NewBatch = Omit<BatchRecord, 'id' | 'owner_id' | 'endDate'> & {
  /** Set when entering a batch that has already finished. */
  endDate?: Date;
};

export interface UseBatchesResult extends Omit<UseCrudResult<BatchRecord>, 'create'> {
  createBatch(input: NewBatch): Promise<void>;
  /** Ends the batch now and stores its final metrics. */
  completeBatch(batch: BatchRecord): Promise<void>;
  /** Recomputes and stores the metrics of an already completed batch. */
  recalculateBatch(batch: BatchRecord): Promise<void>;
}

export function useBatches(): UseBatchesResult {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const api = useMemo<CrudApi<BatchRecord>>(
    () => ({
      list: async () => {
        const rows = await (await getRayfinClient()).data.Batch
          .select([...FIELDS])
          .orderBy({ startDate: 'desc' })
          .execute();
        return (rows as BatchRecord[]).map(normalize);
      },
      create: async (input) =>
        normalize(
          (await (await getRayfinClient()).data.Batch.create({
            name: input.name,
            startDate: input.startDate,
            ...(input.endDate ? { endDate: input.endDate } : {}),
            targetOGPoints: input.targetOGPoints,
            yeast: input.yeast,
            ...(input.recipeId ? { recipeId: input.recipeId } : {}),
            ...(input.yeastId ? { yeastId: input.yeastId } : {}),
            owner_id: input.owner_id,
            ...metricFields(input),
          })) as BatchRecord
        ),
      update: async (id, patch) => {
        const client = await getRayfinClient();
        await client.data.Batch.update({ id }, patch);
        // The update response can be partial, so re-read the full row.
        const rows = (await client.data.Batch.select([...FIELDS]).execute()) as BatchRecord[];
        const row = rows.find((r) => r.id === id);
        if (!row) throw new Error('Batch not found after update.');
        return normalize(row);
      },
      remove: async (id) => {
        await (await getRayfinClient()).data.Batch.delete({ id });
      },
    }),
    []
  );

  const { create, update, ...crud } = useCrud<BatchRecord>(api);

  // A failed or empty metrics query must not block completing the batch; the
  // dashboard falls back to querying the telemetry when no metrics are stored.
  const metricsFor = async (from: Date, to: Date) => {
    try {
      return (await computeBatchMetrics(from, to)) ?? {};
    } catch {
      return {};
    }
  };

  const createBatch = async (input: NewBatch) => {
    if (!userId) throw new Error('Not signed in.');
    const metrics = input.endDate
      ? await metricsFor(input.startDate, input.endDate)
      : {};
    await create({ ...input, ...metrics, owner_id: userId });
  };

  const completeBatch = async (batch: BatchRecord) => {
    const endDate = new Date();
    const metrics = await metricsFor(batch.startDate, endDate);
    await update(batch.id, { endDate, ...metricFields(metrics) });
  };

  const recalculateBatch = async (batch: BatchRecord) => {
    if (!batch.endDate) return;
    const metrics = await computeBatchMetrics(batch.startDate, batch.endDate);
    if (!metrics) throw new Error('No telemetry found between the batch start and end.');
    await update(batch.id, metricFields(metrics));
  };

  return { ...crud, update, createBatch, completeBatch, recalculateBatch };
}
