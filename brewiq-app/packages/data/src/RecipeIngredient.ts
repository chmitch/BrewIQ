import { entity, int, role, text, uuid } from '@microsoft/rayfin-core';

/**
 * One ingredient line of a recipe. Kept as a loose `recipeId` reference rather
 * than a navigation property: the library is small and is joined client side.
 */
@entity()
@role('authenticated', '*')
export class RecipeIngredient {
  @uuid() id!: string;
  @text({ min: 1, max: 64 }) recipeId!: string;
  @text({ min: 1, max: 20 }) kind!: string;
  @text({ min: 1, max: 120 }) name!: string;
  @text({ optional: true, max: 40 }) amount?: string;
  @text({ optional: true, max: 60 }) timing?: string;
  @int({ min: 0, max: 1000 }) sortOrder!: number;
}
