import { entity, int, role, text, uuid } from '@microsoft/rayfin-core';

/**
 * A brewer's yeast strain from a manufacturer (Wyeast, Fermentis, ...).
 *
 * Reference data shared by every signed-in brewer, so there is no ownership policy.
 * Attenuation is a percentage; temperatures are in tenths of °F (64.4 °F = 644).
 * Values come from the manufacturer's site; `source` and `sourceUrl` say where.
 */
@entity()
@role('authenticated', '*')
export class Yeast {
  @uuid() id!: string;
  @text({ min: 1, max: 40 }) brand!: string;
  @text({ min: 1, max: 30 }) code!: string;
  @text({ min: 1, max: 120 }) name!: string;
  @text({ max: 10 }) form!: string;
  @text({ optional: true, max: 80 }) species?: string;
  @text({ optional: true, max: 60 }) category?: string;
  @text({ optional: true, max: 30 }) flocculation?: string;
  @int({ optional: true, min: 0, max: 120 }) attenuationMinPct?: number;
  @int({ optional: true, min: 0, max: 120 }) attenuationMaxPct?: number;
  @text({ optional: true, max: 20 }) abvTolerance?: string;
  @int({ optional: true, min: 0, max: 2000 }) tempMinTenthsF?: number;
  @int({ optional: true, min: 0, max: 2000 }) tempMaxTenthsF?: number;
  @text({ optional: true, max: 1000 }) notes?: string;
  @text({ optional: true, max: 60 }) source?: string;
  @text({ optional: true, max: 300 }) sourceUrl?: string;
}
