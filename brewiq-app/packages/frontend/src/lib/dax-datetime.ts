import type { QueryTableLike } from '@/lib/to-data-table';

/** A DAX expression for a UTC instant, e.g. `(DATE(2026,10,24)+TIME(14,27,0))`. */
export function toDaxDateTime(d: Date): string {
  return (
    `(DATE(${d.getUTCFullYear()},${d.getUTCMonth() + 1},${d.getUTCDate()})` +
    `+TIME(${d.getUTCHours()},${d.getUTCMinutes()},${d.getUTCSeconds()}))`
  );
}

/**
 * The semantic model returns UTC datetimes with no zone. A string without a
 * zone is read as local time by the browser and Vega-Lite, which would shift
 * every point by the viewer's UTC offset, so mark the named columns as UTC.
 */
export function markUtc(
  table: QueryTableLike,
  ...columnNames: string[]
): QueryTableLike {
  const idx = columnNames
    .map((n) => table.columns.findIndex((c) => c.name === n))
    .filter((i) => i >= 0);
  if (idx.length === 0) return table;
  return {
    columns: table.columns,
    rows: table.rows.map((row) =>
      row.map((v, i) =>
        idx.includes(i) && typeof v === 'string' && !/(Z|[+-]\d\d:?\d\d)$/.test(v)
          ? `${v}Z`
          : v
      )
    ),
  };
}

/** Parses a UTC datetime string from the model; null when absent or invalid. */
export function parseUtc(v: unknown): Date | null {
  if (typeof v !== 'string' || v === '') return null;
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(v) ? v : `${v}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
