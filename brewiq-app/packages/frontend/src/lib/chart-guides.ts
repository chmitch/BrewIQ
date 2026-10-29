import type { VisualizationSpec } from '@microsoft/fabric-visuals';

export interface GuideLine {
  value: number;
  label: string;
  color: string;
}

export interface ChartGuides {
  lines: readonly GuideLine[];
  /** Optional shaded band between two values. */
  band?: { from: number; to: number; color: string };
}

// Guide layers carry their own single-row data so they draw once, not once per reading.
const ONE_ROW = { values: [{}] };

/**
 * Adds constant horizontal guides (dashed lines with labels and an optional band) behind an
 * existing Vega-Lite spec. The Y scale is shared, so the guides stay in view.
 */
export function withGuides(spec: VisualizationSpec, guides: ChartGuides | undefined): VisualizationSpec {
  if (!guides || (guides.lines.length === 0 && !guides.band)) return spec;
  const { layer, encoding, mark, ...rest } = spec as Record<string, unknown>;
  const layers: Record<string, unknown>[] = [];
  if (guides.band) {
    layers.push({
      data: ONE_ROW,
      mark: { type: 'rect', color: guides.band.color, opacity: 0.1 },
      encoding: { y: { datum: guides.band.from }, y2: { datum: guides.band.to } },
    });
  }
  for (const l of guides.lines) {
    layers.push({
      data: ONE_ROW,
      mark: { type: 'rule', strokeDash: [6, 4], strokeWidth: 1.5, color: l.color },
      encoding: { y: { datum: l.value } },
    });
    layers.push({
      data: ONE_ROW,
      mark: { type: 'text', align: 'left', dx: 6, dy: -6, fontSize: 11, color: l.color },
      encoding: { x: { value: 0 }, y: { datum: l.value }, text: { value: l.label } },
    });
  }
  const inner = layer ? { layer, encoding } : { mark, encoding };
  return { ...rest, layer: [...layers, inner] } as VisualizationSpec;
}
