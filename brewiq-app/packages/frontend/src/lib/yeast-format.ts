import type { YeastRecord } from '@rayfin-app/shared';

export const wholeF = (tenths?: number | null) =>
  tenths == null ? null : (tenths / 10).toFixed(0);

export function tempRange(y: Pick<YeastRecord, 'tempMinTenthsF' | 'tempMaxTenthsF'>): string | null {
  const lo = wholeF(y.tempMinTenthsF);
  const hi = wholeF(y.tempMaxTenthsF);
  return lo && hi ? `${lo}–${hi} °F` : null;
}

export function attenuationRange(
  y: Pick<YeastRecord, 'attenuationMinPct' | 'attenuationMaxPct'>
): string | null {
  const { attenuationMinPct: lo, attenuationMaxPct: hi } = y;
  if (lo == null || hi == null) return null;
  return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
}

export function yeastLabel(y: YeastRecord): string {
  return `${y.brand} ${y.code} · ${y.name}`;
}
