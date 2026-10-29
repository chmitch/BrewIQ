import type { VisualizationSpec } from '@microsoft/fabric-visuals';

import baseQuery from './batch-series.dax?raw';
import gravitySpec from './batch-series-gravity.json';
import temperatureSpec from './batch-series-temperature.json';

import { toDaxDateTime } from '@/lib/dax-datetime';
import { withGuides, type ChartGuides } from '@/lib/chart-guides';
import type { ColumnMetadataMap } from '@/lib/to-data-table';

const connection = 'brewevents';

/** Keyed by the exact column names the query returns. */
export const columnMetadata: ColumnMetadataMap = {
  '[Hour]': { name: 'Hour', displayName: 'Time' },
  '[Gravity]': { name: 'Gravity', displayName: 'Gravity', format: '0.000' },
  '[Temperature]': {
    name: 'Temperature',
    displayName: 'Temperature (°F)',
    format: '0.0',
  },
  '[GravityAnomaly]': {
    name: 'GravityAnomaly',
    displayName: 'Anomalous gravity',
    format: '0.000',
  },
  '[TemperatureAnomaly]': {
    name: 'TemperatureAnomaly',
    displayName: 'Anomalous temperature (°F)',
    format: '0.0',
  },
};

interface BatchSeriesParams {
  /** Inclusive start of the window, as a UTC instant. */
  from: Date;
  /** Inclusive end of the window, as a UTC instant. */
  to: Date;
  /** Optional constant guide lines drawn on the charts. */
  temperatureGuides?: ChartGuides;
  gravityGuides?: ChartGuides;
}

/** Hourly gravity and temperature averages across a window. */
export function batchSeries({ from, to, temperatureGuides, gravityGuides }: BatchSeriesParams) {
  const query = baseQuery
    .replace('__FROM__', toDaxDateTime(from))
    .replace('__TO__', toDaxDateTime(to));
  return {
    connection,
    query,
    columnMetadata,
    gravitySpec: withGuides(gravitySpec as VisualizationSpec, gravityGuides),
    temperatureSpec: withGuides(temperatureSpec as VisualizationSpec, temperatureGuides),
  };
}
