import { entity, int, role, text, uuid } from '@microsoft/rayfin-core';

/**
 * A commercial beer kit recipe, stored as structured data (the vendor PDF is only linked).
 *
 * Shared reference data, so no ownership policy. Gravity is in points
 * (1.050 SG = 1050); ABV and IBU are in tenths; temperatures in tenths of °F.
 * `yeastId` points at the yeast the brewer normally uses; `yeastNotes` keeps the
 * kit's own suggestions.
 */
@entity()
@role('authenticated', '*')
export class Recipe {
  @uuid() id!: string;
  @text({ min: 1, max: 120 }) name!: string;
  @text({ max: 80 }) style!: string;
  @text({ optional: true, max: 60 }) source?: string;
  @text({ optional: true, max: 40 }) kitCode?: string;
  @int({ min: 1, max: 100 }) batchSizeGal!: number;
  @int({ min: 1000, max: 1200 }) ogPoints!: number;
  @int({ optional: true, min: 0, max: 300 }) abvTenths?: number;
  @int({ optional: true, min: 0, max: 2000 }) ibuTenths?: number;
  @int({ optional: true, min: 0, max: 365 }) primaryDaysMin?: number;
  @int({ optional: true, min: 0, max: 365 }) primaryDaysMax?: number;
  @int({ optional: true, min: 0, max: 60 }) totalWeeks?: number;
  @int({ optional: true, min: 0, max: 2000 }) pitchTempMaxTenthsF?: number;
  @text({ optional: true, max: 64 }) yeastId?: string;
  @text({ optional: true, max: 600 }) yeastNotes?: string;
  @text({ optional: true, max: 400 }) timeline?: string;
  @text({ optional: true, max: 2000 }) instructions?: string;
  @text({ optional: true, max: 400 }) sourceUrl?: string;
  /** Linked (not copied) product image; the vendor owns it. */
  @text({ optional: true, max: 600 }) imageUrl?: string;
  /** The vendor's product page, used to re-read the recipe and its image. */
  @text({ optional: true, max: 400 }) productUrl?: string;
}
