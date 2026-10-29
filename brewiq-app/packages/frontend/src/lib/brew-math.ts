/** Original gravity in points (1.050 SG = 1050) from an SG reading. */
export function toPoints(sg: number): number {
  return Math.round(sg * 1000);
}

export function formatSg(sg: number | null | undefined): string {
  return sg == null ? '—' : sg.toFixed(3);
}

/** Standard homebrew estimate: ABV = (OG − FG) × 131.25. */
export function abv(og: number, current: number): number {
  return Math.max(0, (og - current) * 131.25);
}

/** Apparent attenuation as a percentage of the fermentable gravity. */
export function attenuation(og: number, current: number): number | null {
  const available = og - 1;
  if (available <= 0) return null;
  return Math.min(100, Math.max(0, ((og - current) / available) * 100));
}
