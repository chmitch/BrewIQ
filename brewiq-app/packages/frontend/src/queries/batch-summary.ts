import baseQuery from './batch-summary.dax?raw';

import { toDaxDateTime } from '@/lib/dax-datetime';

const connection = 'brewevents';

interface BatchSummaryParams {
  from: Date;
  to: Date;
}

/**
 * One row for a window: first reading (the measured OG), latest reading and
 * the reading count. Output columns: FirstTime, FirstGravity, LastTime,
 * LastGravity, LastTemperature, MinTemperature, MaxTemperature,
 * AvgTemperature, Readings.
 */
export function batchSummary({ from, to }: BatchSummaryParams) {
  const query = baseQuery
    .replace('__FROM__', toDaxDateTime(from))
    .replace('__TO__', toDaxDateTime(to));
  return { connection, query };
}
