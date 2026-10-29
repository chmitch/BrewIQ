import type { RecipeIngredientRecord, RecipeRecord } from '@rayfin-app/shared';

export type RecipeSeed = Omit<RecipeRecord, 'id' | 'yeastId'> & {
  /** Yeast `code` in the library; resolved to an id at seed time. */
  yeastCode: string;
  ingredients: Pick<RecipeIngredientRecord, 'kind' | 'name' | 'amount' | 'timing'>[];
};

const NB = 'Northern Brewer';

/** Structured data from the Northern Brewer extract kit instructions (vendor PDFs are linked, not copied). */
export const RECIPE_SEED: RecipeSeed[] = [
  {
    name: 'Oatmeal Stout',
    style: 'Oatmeal Stout',
    source: NB,
    kitCode: 'B12490',
    batchSizeGal: 5,
    ogPoints: 1050,
    abvTenths: 48,
    ibuTenths: 250,
    primaryDaysMin: 14,
    primaryDaysMax: 14,
    totalWeeks: 6,
    pitchTempMaxTenthsF: 700,
    yeastCode: 'S-04',
    yeastNotes:
      'Kit suggests Safale S-04 (64-75 F), Imperial A01 House (62-70 F), Omega OYL-006 British Ale I (64-72 F) or Wyeast 1098 (64-75 F).',
    timeline: '2 weeks primary, 2 weeks secondary, 2 weeks in the bottle (about 6 weeks).',
    instructions:
      'Steep the specialty grains, add the extracts and boil with the Glacier hops for 60 minutes. Cool, top up to 5 gallons, pitch yeast and ferment. Active fermentation starts within about 48 hours and finishes in 1-2 weeks. Bottle with priming sugar.',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/2785/6868/files/B12490-Oatmeal-Stout_extract_1_-1769114863212.pdf',
    ingredients: [
      { kind: 'fermentable', name: 'Flaked oats', amount: '1 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'English dark crystal malt', amount: '0.5 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Chocolate malt', amount: '0.5 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Roasted barley', amount: '0.5 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Gold liquid malt extract', amount: '6 lb', timing: '60 min' },
      { kind: 'fermentable', name: 'Dark dry malt extract', amount: '1 lb', timing: '60 min' },
      { kind: 'hop', name: 'Glacier', amount: '1 oz', timing: '60 min' },
    ],
  },
  {
    name: 'Imperial Stout',
    style: 'Imperial Stout',
    source: NB,
    batchSizeGal: 5,
    ogPoints: 1086,
    primaryDaysMin: 14,
    primaryDaysMax: 28,
    totalWeeks: 17,
    pitchTempMaxTenthsF: 780,
    yeastCode: '1728',
    yeastNotes:
      'Kit suggests Wyeast 1728 (55-70 F; the manufacturer lists 55-75 F) or Safale S-04 (64-75 F). Use 2 packs or a starter for this gravity.',
    timeline: '2-4 weeks primary, 2-3 months secondary, 2-4 weeks in the bottle (about 4 months).',
    instructions:
      'Steep the roasted grains, boil with dark extract in two additions (60 and 15 minutes) and hops at 60 and 0 minutes. Cool, pitch a large yeast population and ferment cool. Long conditioning before bottling.',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/2785/6868/t/3/assets/ImperialStout-1532544620216.pdf?487624729713520424',
    ingredients: [
      { kind: 'fermentable', name: 'Roasted barley', amount: '0.5 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Black malt', amount: '0.5 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Chocolate malt', amount: '0.5 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Dark liquid malt extract', amount: '6 lb', timing: '60 min' },
      { kind: 'fermentable', name: 'Dark liquid malt extract', amount: '6 lb', timing: '15 min' },
      { kind: 'hop', name: 'Summit', amount: '1.75 oz', timing: '60 min' },
      { kind: 'hop', name: 'Cascade', amount: '2 oz', timing: '0 min' },
    ],
  },
  {
    name: 'Irish Red Ale',
    style: 'Irish Red Ale',
    source: NB,
    batchSizeGal: 5,
    ogPoints: 1044,
    primaryDaysMin: 7,
    primaryDaysMax: 14,
    totalWeeks: 6,
    pitchTempMaxTenthsF: 780,
    yeastCode: '1272',
    yeastNotes: 'Kit suggests Wyeast 1272 American Ale II (60-72 F) or Danstar Nottingham (57-70 F).',
    timeline: '1-2 weeks primary, 2-4 weeks secondary, 1-2 weeks in the bottle (about 6 weeks).',
    instructions:
      'Steep the specialty grains, add the extract and boil with Willamette at 60 minutes and US Goldings at 30. Cool, top up to 5 gallons, pitch yeast and ferment. Bottle with priming sugar.',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/2785/6868/t/3/assets/IrishRedAle-1526946394701.pdf?13778807462096982400',
    ingredients: [
      { kind: 'fermentable', name: 'Belgian Cara 8', amount: '0.5 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Briess Special Roast', amount: '0.25 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Belgian Biscuit malt', amount: '0.125 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'English chocolate malt', amount: '0.125 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Gold liquid malt extract', amount: '6 lb', timing: '60 min' },
      { kind: 'hop', name: 'Willamette', amount: '1 oz', timing: '60 min' },
      { kind: 'hop', name: 'US Goldings', amount: '1 oz', timing: '30 min' },
    ],
  },
  {
    name: "Belgian Petite Saison d'Ete",
    style: 'Belgian Saison',
    source: NB,
    batchSizeGal: 5,
    ogPoints: 1041,
    primaryDaysMin: 14,
    primaryDaysMax: 14,
    totalWeeks: 4,
    pitchTempMaxTenthsF: 700,
    yeastCode: '3711',
    yeastNotes: 'Kit suggests Wyeast 3711 French Saison (65-77 F).',
    timeline: '2 weeks primary, 2 weeks in the bottle (about 4 weeks).',
    instructions:
      'Steep the Cara 20, add Pilsen and wheat extracts and boil with Kent Goldings at 60 minutes, then Styrian Goldings and Saaz at 10 and 2 minutes. Cool, pitch and ferment warm. Bottle with 5 oz priming sugar.',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/2785/6868/t/3/assets/PetiteSaisondEte-1526979610344.pdf?14874993540766045429',
    ingredients: [
      { kind: 'fermentable', name: 'Cara 20 malt', amount: '0.5 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Pilsen liquid malt extract', amount: '3.15 lb', timing: '60 min' },
      { kind: 'fermentable', name: 'Pilsen dry malt extract', amount: '1 lb', timing: '60 min' },
      { kind: 'fermentable', name: 'Wheat dry malt extract', amount: '1 lb', timing: '60 min' },
      { kind: 'hop', name: 'UK Kent Goldings', amount: '1 oz', timing: '60 min' },
      { kind: 'hop', name: 'Styrian Goldings (Celeia)', amount: '0.25 oz', timing: '10 min' },
      { kind: 'hop', name: 'Saaz', amount: '0.25 oz', timing: '10 min' },
      { kind: 'hop', name: 'Styrian Goldings (Celeia)', amount: '0.75 oz', timing: '2 min' },
      { kind: 'hop', name: 'Saaz', amount: '0.75 oz', timing: '2 min' },
      { kind: 'other', name: 'Priming sugar', amount: '5 oz', timing: 'bottling' },
    ],
  },
  {
    name: 'Mosaic IPA',
    style: 'American IPA',
    source: NB,
    batchSizeGal: 5,
    ogPoints: 1070,
    primaryDaysMin: 7,
    primaryDaysMax: 14,
    totalWeeks: 6,
    pitchTempMaxTenthsF: 780,
    yeastCode: 'S-04',
    yeastNotes:
      'Kit suggests Safale S-04 (64-75 F), Wyeast 1335 British Ale II (63-75 F) or Imperial A01 House (62-70 F).',
    timeline: '1-2 weeks primary, 2-4 weeks secondary, 1-2 weeks in the bottle (about 6 weeks).',
    instructions:
      'Steep the caramel malts, add extract and boil with Mosaic at 60 and 30 minutes, then a second extract and corn sugar addition with 10 minutes left, and Mosaic at flameout. Dry hop in secondary. Bottle with 5 oz priming sugar.',
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2785/6868/t/3/assets/MosaicIPA-1555507280964.pdf',
    ingredients: [
      { kind: 'fermentable', name: 'Briess Caramel 40L', amount: '0.25 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Briess Caramel 80L', amount: '0.25 lb', timing: 'steep' },
      { kind: 'fermentable', name: 'Gold liquid malt extract', amount: '6 lb', timing: '60 min' },
      { kind: 'fermentable', name: 'Gold liquid malt extract', amount: '3.15 lb', timing: '10 min' },
      { kind: 'fermentable', name: 'Corn sugar', amount: '1 lb', timing: '10 min' },
      { kind: 'hop', name: 'Mosaic', amount: '1 oz', timing: '60 min' },
      { kind: 'hop', name: 'Mosaic', amount: '1 oz', timing: '30 min' },
      { kind: 'hop', name: 'Mosaic', amount: '2 oz', timing: '0 min' },
      { kind: 'hop', name: 'Mosaic', amount: '2 oz', timing: 'dry hop' },
      { kind: 'other', name: 'Priming sugar', amount: '5 oz', timing: 'bottling' },
    ],
  },
  {
    name: 'Bavarian Hefeweizen',
    style: 'Hefeweizen',
    source: NB,
    kitCode: '1250',
    batchSizeGal: 5,
    ogPoints: 1049,
    abvTenths: 51,
    ibuTenths: 158,
    primaryDaysMin: 14,
    primaryDaysMax: 14,
    totalWeeks: 4,
    pitchTempMaxTenthsF: 700,
    yeastCode: 'W-68',
    yeastNotes:
      'Kit suggests Safale W-68 (64-79 F), Imperial G01 Stefon (63-73 F), Omega OYL-021 (64-75 F) or Wyeast 3068 (64-75 F).',
    timeline: '2 weeks primary, 2 weeks secondary, 2 weeks in the bottle (about 4 weeks).',
    instructions:
      'Boil the wheat extract with Tettnang hops for 60 minutes and add the dry extract for the last 15. Cool, top up to 5 gallons, pitch a wheat yeast and ferment. Bottle with priming sugar.',
    sourceUrl:
      'https://cdn.shopify.com/s/files/1/2785/6868/files/1250-Northern-Brewer-Bavarian-Hefeweizen-Instructions_Extract_1_-1728910609440.pdf',
    ingredients: [
      { kind: 'fermentable', name: 'Wheat liquid malt extract', amount: '6 lb', timing: '60 min' },
      { kind: 'fermentable', name: 'Wheat dry malt extract', amount: '1 lb', timing: '15 min' },
      { kind: 'hop', name: 'German Tettnang', amount: '1 oz', timing: '60 min' },
    ],
  },
];
