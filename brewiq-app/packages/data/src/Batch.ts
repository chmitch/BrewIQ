import { date, entity, int, role, text, uuid } from '@microsoft/rayfin-core';

/**
 * A brew batch. The Tilt telemetry has no batch id, so a batch is the window
 * `startDate` .. `endDate` (open-ended while the batch is active) applied to the
 * telemetry stream.
 *
 * `targetOGPoints` is the target original gravity in points (1.050 SG = 1050),
 * stored as an integer to avoid decimal round-tripping.
 *
 * The `@role` policy keeps each brewer's batches private, server side.
 */
@entity()
@role('authenticated', '*', {
  policy: (claims, batch) => claims.sub.eq(batch.owner_id),
})
export class Batch {
  @uuid() id!: string;
  @text({ min: 1, max: 120 }) name!: string;
  @date() startDate!: Date;
  @int({ min: 1000, max: 1200 }) targetOGPoints!: number;
  @text({ min: 1, max: 120 }) yeast!: string;
  @date({ optional: true }) endDate?: Date;
  @text({ max: 200 }) owner_id!: string;

  // Optional links into the shared recipe / yeast library.
  @text({ optional: true, max: 64 }) recipeId?: string;
  @text({ optional: true, max: 64 }) yeastId?: string;

  // Final metrics, computed from the telemetry when the batch is completed.
  // Gravity is in points, ABV and temperatures in tenths (4.5% = 45, 68.4 °F = 684).
  @int({ optional: true, min: 900, max: 1200 }) ogPoints?: number;
  @int({ optional: true, min: 900, max: 1200 }) fgPoints?: number;
  @int({ optional: true, min: 0, max: 300 }) abvTenths?: number;
  @int({ optional: true, min: 0, max: 100 }) attenuationPct?: number;
  @int({ optional: true, min: 0, max: 2000 }) minTempTenthsF?: number;
  @int({ optional: true, min: 0, max: 2000 }) maxTempTenthsF?: number;
  @int({ optional: true, min: 0, max: 2000 }) avgTempTenthsF?: number;
  @int({ optional: true, min: 0 }) readings?: number;
}
