/*
 * Data from BJCP 2021 Beer Style Guidelines, Copyright BJCP, Inc.
 * Vital statistics only (numeric ranges). https://www.bjcp.org
 */

export interface BeerStyle {
  code: string;
  name: string;
  category: string;
  og: [number, number] | null;
  fg: [number, number] | null;
  abv: [number, number] | null;
  ibu: [number, number] | null;
  srm: [number, number] | null;
}

export const BEER_STYLES: readonly BeerStyle[] = [
  { code: "1A", name: "American Light Lager", category: "Standard American Beer", og: [1.028, 1.040], fg: [0.998, 1.008], abv: [2.8, 4.2], ibu: [8, 12], srm: [2, 3] },
  { code: "1B", name: "American Lager", category: "Standard American Beer", og: [1.040, 1.050], fg: [1.004, 1.010], abv: [4.2, 5.3], ibu: [8, 18], srm: [2, 3.5] },
  { code: "1C", name: "Cream Ale", category: "Standard American Beer", og: [1.042, 1.055], fg: [1.006, 1.012], abv: [4.2, 5.6], ibu: [8, 20], srm: [2, 5] },
  { code: "1D", name: "American Wheat Beer", category: "Standard American Beer", og: [1.040, 1.055], fg: [1.008, 1.013], abv: [4, 5.5], ibu: [15, 30], srm: [3, 6] },
  { code: "2A", name: "International Pale Lager", category: "International Lager", og: [1.042, 1.050], fg: [1.008, 1.012], abv: [4.5, 6], ibu: [18, 25], srm: [2, 6] },
  { code: "2B", name: "International Amber Lager", category: "International Lager", og: [1.042, 1.055], fg: [1.008, 1.014], abv: [4.5, 6], ibu: [8, 25], srm: [6, 14] },
  { code: "2C", name: "International Dark Lager", category: "International Lager", og: [1.044, 1.056], fg: [1.008, 1.012], abv: [4.2, 6], ibu: [8, 20], srm: [14, 30] },
  { code: "3A", name: "Czech Pale Lager", category: "Czech Lager", og: [1.028, 1.044], fg: [1.008, 1.014], abv: [3, 4.1], ibu: [20, 35], srm: [3, 6] },
  { code: "3B", name: "Czech Premium Pale Lager", category: "Czech Lager", og: [1.044, 1.060], fg: [1.013, 1.017], abv: [4.2, 5.8], ibu: [30, 45], srm: [3.5, 6] },
  { code: "3C", name: "Czech Amber Lager", category: "Czech Lager", og: [1.044, 1.060], fg: [1.013, 1.017], abv: [4.4, 5.8], ibu: [20, 35], srm: [10, 16] },
  { code: "3D", name: "Czech Dark Lager", category: "Czech Lager", og: [1.044, 1.060], fg: [1.013, 1.017], abv: [4.4, 5.8], ibu: [18, 34], srm: [17, 35] },
  { code: "4A", name: "Munich Helles", category: "Pale Malty European Lager", og: [1.044, 1.048], fg: [1.006, 1.012], abv: [4.7, 5.4], ibu: [16, 22], srm: [3, 5] },
  { code: "4B", name: "Festbier", category: "Pale Malty European Lager", og: [1.054, 1.057], fg: [1.010, 1.012], abv: [5.8, 6.3], ibu: [18, 25], srm: [4, 6] },
  { code: "4C", name: "Helles Bock", category: "Pale Malty European Lager", og: [1.064, 1.072], fg: [1.011, 1.018], abv: [6.3, 7.4], ibu: [23, 35], srm: [6, 9] },
  { code: "5A", name: "German Leichtbier", category: "Pale Bitter European Beer", og: [1.026, 1.034], fg: [1.006, 1.010], abv: [2.4, 3.6], ibu: [15, 28], srm: [1.5, 4] },
  { code: "5B", name: "K\u00f6lsch", category: "Pale Bitter European Beer", og: [1.044, 1.050], fg: [1.007, 1.011], abv: [4.4, 5.2], ibu: [18, 30], srm: [3.5, 5] },
  { code: "5C", name: "German Helles Exportbier", category: "Pale Bitter European Beer", og: [1.050, 1.058], fg: [1.008, 1.015], abv: [5, 6], ibu: [20, 30], srm: [4, 6] },
  { code: "5D", name: "German Pils", category: "Pale Bitter European Beer", og: [1.044, 1.050], fg: [1.008, 1.013], abv: [4.4, 5.2], ibu: [22, 40], srm: [2, 4] },
  { code: "6A", name: "M\u00e4rzen", category: "Amber Malty European Lager", og: [1.054, 1.060], fg: [1.010, 1.014], abv: [5.6, 6.3], ibu: [18, 24], srm: [8, 17] },
  { code: "6B", name: "Rauchbier", category: "Amber Malty European Lager", og: [1.050, 1.057], fg: [1.012, 1.016], abv: [4.8, 6], ibu: [20, 30], srm: [12, 22] },
  { code: "6C", name: "Dunkles Bock", category: "Amber Malty European Lager", og: [1.064, 1.072], fg: [1.013, 1.019], abv: [6.3, 7.2], ibu: [20, 27], srm: [14, 22] },
  { code: "7A", name: "Vienna Lager", category: "Amber Bitter European Beer", og: [1.048, 1.055], fg: [1.010, 1.014], abv: [4.7, 5.5], ibu: [18, 30], srm: [9, 15] },
  { code: "7B", name: "Altbier", category: "Amber Bitter European Beer", og: [1.044, 1.052], fg: [1.008, 1.014], abv: [4.3, 5.5], ibu: [25, 50], srm: [9, 17] },
  { code: "8A", name: "Munich Dunkel", category: "Dark European Lager", og: [1.048, 1.056], fg: [1.010, 1.016], abv: [4.5, 5.6], ibu: [18, 28], srm: [17, 28] },
  { code: "8B", name: "Schwarzbier", category: "Dark European Lager", og: [1.046, 1.052], fg: [1.010, 1.016], abv: [4.4, 5.4], ibu: [20, 35], srm: [19, 30] },
  { code: "9A", name: "Doppelbock", category: "Strong European Beer", og: [1.072, 1.112], fg: [1.016, 1.024], abv: [7, 10], ibu: [16, 26], srm: [6, 25] },
  { code: "9B", name: "Eisbock", category: "Strong European Beer", og: [1.078, 1.120], fg: [1.020, 1.035], abv: [9, 14], ibu: [25, 35], srm: [17, 30] },
  { code: "9C", name: "Baltic Porter", category: "Strong European Beer", og: [1.060, 1.090], fg: [1.016, 1.024], abv: [6.5, 9.5], ibu: [20, 40], srm: [17, 30] },
  { code: "10A", name: "Weissbier", category: "German Wheat Beer", og: [1.044, 1.053], fg: [1.008, 1.014], abv: [4.3, 5.6], ibu: [8, 15], srm: [2, 6] },
  { code: "10B", name: "Dunkles Weissbier", category: "German Wheat Beer", og: [1.044, 1.057], fg: [1.008, 1.014], abv: [4.3, 5.6], ibu: [10, 18], srm: [14, 23] },
  { code: "10C", name: "Weizenbock", category: "German Wheat Beer", og: [1.064, 1.090], fg: [1.015, 1.022], abv: [6.5, 9], ibu: [15, 30], srm: [6, 25] },
  { code: "11A", name: "Ordinary Bitter", category: "British Bitter", og: [1.030, 1.039], fg: [1.007, 1.011], abv: [3.2, 3.8], ibu: [25, 35], srm: [8, 14] },
  { code: "11B", name: "Best Bitter", category: "British Bitter", og: [1.040, 1.048], fg: [1.008, 1.012], abv: [3.8, 4.6], ibu: [25, 40], srm: [8, 16] },
  { code: "11C", name: "Strong Bitter", category: "British Bitter", og: [1.048, 1.060], fg: [1.010, 1.016], abv: [4.6, 6.2], ibu: [30, 50], srm: [8, 18] },
  { code: "12A", name: "British Golden Ale", category: "Pale Commonwealth Beer", og: [1.038, 1.053], fg: [1.006, 1.012], abv: [3.8, 5], ibu: [20, 45], srm: [2, 5] },
  { code: "12B", name: "Australian Sparkling Ale", category: "Pale Commonwealth Beer", og: [1.038, 1.050], fg: [1.004, 1.006], abv: [4.5, 6], ibu: [20, 35], srm: [4, 7] },
  { code: "12C", name: "English IPA", category: "Pale Commonwealth Beer", og: [1.050, 1.070], fg: [1.010, 1.015], abv: [5, 7.5], ibu: [40, 60], srm: [6, 14] },
  { code: "13A", name: "Dark Mild", category: "Brown British Beer", og: [1.030, 1.038], fg: [1.008, 1.013], abv: [3, 3.8], ibu: [10, 25], srm: [14, 25] },
  { code: "13B", name: "British Brown Ale", category: "Brown British Beer", og: [1.040, 1.052], fg: [1.008, 1.013], abv: [4.2, 5.9], ibu: [20, 30], srm: [12, 22] },
  { code: "13C", name: "English Porter", category: "Brown British Beer", og: [1.040, 1.052], fg: [1.008, 1.014], abv: [4, 5.4], ibu: [18, 35], srm: [20, 30] },
  { code: "14A", name: "Scottish Light", category: "Scottish Ale", og: [1.030, 1.035], fg: [1.010, 1.013], abv: [2.5, 3.3], ibu: [10, 20], srm: [17, 25] },
  { code: "14B", name: "Scottish Heavy", category: "Scottish Ale", og: [1.035, 1.040], fg: [1.010, 1.015], abv: [3.3, 3.9], ibu: [10, 20], srm: [12, 20] },
  { code: "14C", name: "Scottish Export", category: "Scottish Ale", og: [1.040, 1.060], fg: [1.010, 1.016], abv: [3.9, 6], ibu: [15, 30], srm: [12, 20] },
  { code: "15A", name: "Irish Red Ale", category: "Irish Beer", og: [1.036, 1.046], fg: [1.010, 1.014], abv: [3.8, 5], ibu: [18, 28], srm: [9, 14] },
  { code: "15B", name: "Irish Stout", category: "Irish Beer", og: [1.036, 1.044], fg: [1.007, 1.011], abv: [3.8, 5], ibu: [25, 45], srm: [25, 40] },
  { code: "15C", name: "Irish Extra Stout", category: "Irish Beer", og: [1.052, 1.062], fg: [1.010, 1.014], abv: [5, 6.5], ibu: [35, 50], srm: [30, 40] },
  { code: "16A", name: "Sweet Stout", category: "Dark British Beer", og: [1.044, 1.060], fg: [1.012, 1.024], abv: [4, 6], ibu: [20, 40], srm: [30, 40] },
  { code: "16B", name: "Oatmeal Stout", category: "Dark British Beer", og: [1.045, 1.065], fg: [1.010, 1.018], abv: [4.2, 5.9], ibu: [25, 40], srm: [22, 40] },
  { code: "16C", name: "Tropical Stout", category: "Dark British Beer", og: [1.056, 1.075], fg: [1.010, 1.018], abv: [5.5, 8], ibu: [30, 50], srm: [30, 40] },
  { code: "16D", name: "Foreign Extra Stout", category: "Dark British Beer", og: [1.056, 1.075], fg: [1.010, 1.018], abv: [6.3, 8], ibu: [50, 70], srm: [30, 40] },
  { code: "17A", name: "British Strong Ale", category: "Strong British Ale", og: [1.055, 1.080], fg: [1.015, 1.022], abv: [5.5, 8], ibu: [30, 60], srm: [8, 22] },
  { code: "17B", name: "Old Ale", category: "Strong British Ale", og: [1.055, 1.088], fg: [1.015, 1.022], abv: [5.5, 9], ibu: [30, 60], srm: [10, 22] },
  { code: "17C", name: "Wee Heavy", category: "Strong British Ale", og: [1.070, 1.130], fg: [1.018, 1.040], abv: [6.5, 10], ibu: [17, 35], srm: [14, 25] },
  { code: "17D", name: "English Barleywine", category: "Strong British Ale", og: [1.080, 1.120], fg: [1.018, 1.030], abv: [8, 12], ibu: [35, 70], srm: [8, 22] },
  { code: "18A", name: "Blonde Ale", category: "Pale American Ale", og: [1.038, 1.054], fg: [1.008, 1.013], abv: [3.8, 5.5], ibu: [15, 28], srm: [3, 6] },
  { code: "18B", name: "American Pale Ale", category: "Pale American Ale", og: [1.045, 1.060], fg: [1.010, 1.015], abv: [4.5, 6.2], ibu: [30, 50], srm: [5, 10] },
  { code: "19A", name: "American Amber Ale", category: "Amber and Brown American Beer", og: [1.045, 1.060], fg: [1.010, 1.015], abv: [4.5, 6.2], ibu: [25, 40], srm: [10, 17] },
  { code: "19B", name: "California Common", category: "Amber and Brown American Beer", og: [1.048, 1.054], fg: [1.011, 1.014], abv: [4.5, 5.5], ibu: [30, 45], srm: [9, 14] },
  { code: "19C", name: "American Brown Ale", category: "Amber and Brown American Beer", og: [1.045, 1.060], fg: [1.010, 1.016], abv: [4.3, 6.2], ibu: [20, 30], srm: [18, 35] },
  { code: "20A", name: "American Porter", category: "American Porter and Stout", og: [1.050, 1.070], fg: [1.012, 1.018], abv: [4.8, 6.5], ibu: [25, 50], srm: [22, 40] },
  { code: "20B", name: "American Stout", category: "American Porter and Stout", og: [1.050, 1.075], fg: [1.010, 1.022], abv: [5, 7], ibu: [35, 75], srm: [30, 40] },
  { code: "20C", name: "Imperial Stout", category: "American Porter and Stout", og: [1.075, 1.115], fg: [1.018, 1.030], abv: [8, 12], ibu: [50, 90], srm: [30, 40] },
  { code: "21A", name: "American IPA", category: "IPA", og: [1.056, 1.070], fg: [1.008, 1.014], abv: [5.5, 7.5], ibu: [40, 70], srm: [6, 14] },
  { code: "21B", name: "Specialty IPA", category: "IPA", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "21B", name: "Specialty IPA: Belgian IPA", category: "IPA", og: [1.058, 1.080], fg: [1.008, 1.016], abv: [6.2, 9.5], ibu: [50, 100], srm: [5, 8] },
  { code: "21B", name: "Specialty IPA: Black IPA", category: "IPA", og: [1.050, 1.085], fg: [1.010, 1.018], abv: [5.5, 9], ibu: [50, 90], srm: [25, 40] },
  { code: "21B", name: "Specialty IPA: Brown IPA", category: "IPA", og: [1.056, 1.070], fg: [1.008, 1.016], abv: [5.5, 7.5], ibu: [40, 70], srm: [18, 35] },
  { code: "21B", name: "Specialty IPA: Brut IPA", category: "IPA", og: [1.046, 1.057], fg: [0.990, 1.004], abv: [6, 7.5], ibu: [20, 30], srm: [2, 4] },
  { code: "21B", name: "Specialty IPA: Red IPA", category: "IPA", og: [1.056, 1.070], fg: [1.008, 1.016], abv: [5.5, 7.5], ibu: [40, 70], srm: [11, 17] },
  { code: "21B", name: "Specialty IPA: Rye IPA", category: "IPA", og: [1.056, 1.075], fg: [1.008, 1.014], abv: [5.5, 8], ibu: [50, 75], srm: [6, 14] },
  { code: "21B", name: "Specialty IPA: White IPA", category: "IPA", og: [1.056, 1.065], fg: [1.010, 1.016], abv: [5.5, 7], ibu: [40, 70], srm: [5, 6] },
  { code: "21C", name: "Hazy IPA", category: "IPA", og: [1.060, 1.085], fg: [1.010, 1.015], abv: [6, 9], ibu: [25, 60], srm: [3, 7] },
  { code: "22A", name: "Double IPA", category: "Strong American Ale", og: [1.065, 1.085], fg: [1.008, 1.018], abv: [7.5, 10], ibu: [60, 100], srm: [6, 14] },
  { code: "22B", name: "American Strong Ale", category: "Strong American Ale", og: [1.062, 1.090], fg: [1.014, 1.024], abv: [6.3, 10], ibu: [50, 100], srm: [7, 18] },
  { code: "22C", name: "American Barleywine", category: "Strong American Ale", og: [1.080, 1.120], fg: [1.016, 1.030], abv: [8, 12], ibu: [50, 100], srm: [9, 18] },
  { code: "22D", name: "Wheatwine", category: "Strong American Ale", og: [1.080, 1.120], fg: [1.016, 1.030], abv: [8, 12], ibu: [30, 60], srm: [6, 14] },
  { code: "23A", name: "Berliner Weisse", category: "European Sour Ale", og: [1.028, 1.032], fg: [1.003, 1.006], abv: [2.8, 3.8], ibu: [3, 8], srm: [2, 3] },
  { code: "23B", name: "Flanders Red Ale", category: "European Sour Ale", og: [1.048, 1.057], fg: [1.002, 1.012], abv: [4.6, 6.5], ibu: [10, 25], srm: [10, 17] },
  { code: "23C", name: "Oud Bruin", category: "European Sour Ale", og: [1.040, 1.074], fg: [1.008, 1.012], abv: [4, 8], ibu: [20, 25], srm: [17, 22] },
  { code: "23D", name: "Lambic", category: "European Sour Ale", og: [1.040, 1.054], fg: [1.001, 1.010], abv: [5, 6.5], ibu: [0, 10], srm: [3, 6] },
  { code: "23E", name: "Gueuze", category: "European Sour Ale", og: [1.040, 1.054], fg: [1.000, 1.006], abv: [5, 8], ibu: [0, 10], srm: [5, 6] },
  { code: "23F", name: "Fruit Lambic", category: "European Sour Ale", og: [1.040, 1.060], fg: [1.000, 1.010], abv: [5, 7], ibu: [0, 10], srm: [3, 7] },
  { code: "23G", name: "Gose", category: "European Sour Ale", og: [1.036, 1.056], fg: [1.006, 1.010], abv: [4.2, 4.8], ibu: [5, 12], srm: [3, 4] },
  { code: "24A", name: "Witbier", category: "Belgian Ale", og: [1.044, 1.052], fg: [1.008, 1.012], abv: [4.5, 5.5], ibu: [8, 20], srm: [2, 4] },
  { code: "24B", name: "Belgian Pale Ale", category: "Belgian Ale", og: [1.048, 1.054], fg: [1.010, 1.014], abv: [4.8, 5.5], ibu: [20, 30], srm: [8, 14] },
  { code: "24C", name: "Bi\u00e8re de Garde", category: "Belgian Ale", og: [1.060, 1.080], fg: [1.008, 1.016], abv: [6, 8.5], ibu: [18, 28], srm: [6, 19] },
  { code: "25A", name: "Belgian Blond Ale", category: "Strong Belgian Ale", og: [1.062, 1.075], fg: [1.008, 1.018], abv: [6, 7.5], ibu: [15, 30], srm: [4, 6] },
  { code: "25B", name: "Saison", category: "Strong Belgian Ale", og: [1.048, 1.065], fg: [1.002, 1.008], abv: [3.5, 5], ibu: [20, 35], srm: [5, 14] },
  { code: "25C", name: "Belgian Golden Strong Ale", category: "Strong Belgian Ale", og: [1.070, 1.095], fg: [1.005, 1.016], abv: [7.5, 10.5], ibu: [22, 35], srm: [3, 6] },
  { code: "26A", name: "Belgian Single", category: "Monastic Ale", og: [1.044, 1.054], fg: [1.004, 1.010], abv: [4.8, 6], ibu: [25, 45], srm: [3, 5] },
  { code: "26B", name: "Belgian Dubbel", category: "Monastic Ale", og: [1.062, 1.075], fg: [1.008, 1.018], abv: [6, 7.6], ibu: [15, 25], srm: [10, 17] },
  { code: "26C", name: "Belgian Tripel", category: "Monastic Ale", og: [1.075, 1.085], fg: [1.008, 1.014], abv: [7.5, 9.5], ibu: [20, 40], srm: [4.5, 7] },
  { code: "26D", name: "Belgian Dark Strong Ale", category: "Monastic Ale", og: [1.075, 1.110], fg: [1.010, 1.024], abv: [8, 12], ibu: [20, 35], srm: [12, 22] },
  { code: "27A", name: "Historical Beer: Kellerbier", category: "Historical Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "27A", name: "Historical Beer: Kentucky Common", category: "Historical Beer", og: [1.044, 1.055], fg: [1.010, 1.018], abv: [4, 5.5], ibu: [15, 30], srm: [11, 20] },
  { code: "27A", name: "Historical Beer: Lichtenhainer", category: "Historical Beer", og: [1.032, 1.040], fg: [1.004, 1.008], abv: [3.5, 4.7], ibu: [5, 12], srm: [3, 6] },
  { code: "27A", name: "Historical Beer: London Brown Ale", category: "Historical Beer", og: [1.033, 1.038], fg: [1.012, 1.015], abv: [2.8, 3.6], ibu: [15, 20], srm: [22, 35] },
  { code: "27A", name: "Historical Beer: Piwo Grodziskie", category: "Historical Beer", og: [1.028, 1.032], fg: [1.006, 1.012], abv: [2.5, 3.3], ibu: [20, 35], srm: [3, 6] },
  { code: "27A", name: "Historical Beer: Pre-Prohibition Lager", category: "Historical Beer", og: [1.044, 1.060], fg: [1.010, 1.015], abv: [4.5, 6], ibu: [25, 40], srm: [3, 6] },
  { code: "27A", name: "Historical Beer: Pre-Prohibition Porter", category: "Historical Beer", og: [1.046, 1.060], fg: [1.010, 1.016], abv: [4.5, 6], ibu: [20, 30], srm: [20, 30] },
  { code: "27A", name: "Historical Beer: Roggenbier", category: "Historical Beer", og: [1.046, 1.056], fg: [1.010, 1.014], abv: [4.5, 6], ibu: [10, 20], srm: [14, 19] },
  { code: "27A", name: "Historical Beer: Sahti", category: "Historical Beer", og: [1.076, 1.120], fg: [1.016, 1.038], abv: [7, 11], ibu: [0, 15], srm: [4, 22] },
  { code: "28A", name: "Brett Beer", category: "American Wild Ale", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "28B", name: "Mixed-Fermentation Sour Beer", category: "American Wild Ale", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "28C", name: "Wild Specialty Beer", category: "American Wild Ale", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "28D", name: "Straight Sour Beer", category: "American Wild Ale", og: [1.048, 1.065], fg: [1.006, 1.013], abv: [4.5, 7], ibu: [3, 8], srm: [2, 3] },
  { code: "29A", name: "Fruit Beer", category: "Fruit Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "29B", name: "Fruit and Spice Beer", category: "Fruit Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "29C", name: "Specialty Fruit Beer", category: "Fruit Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "29D", name: "Grape Ale", category: "Fruit Beer", og: [1.059, 1.075], fg: [1.004, 1.013], abv: [6, 8.5], ibu: [10, 30], srm: [4, 8] },
  { code: "30A", name: "Spice, Herb, or Vegetable Beer", category: "Spiced Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "30B", name: "Autumn Seasonal Beer", category: "Spiced Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "30C", name: "Winter Seasonal Beer", category: "Spiced Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "30D", name: "Specialty Spice Beer", category: "Spiced Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "31A", name: "Alternative Grain Beer", category: "Alternative Fermentables Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "31B", name: "Alternative Sugar Beer", category: "Alternative Fermentables Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "32A", name: "Classic Style Smoked Beer", category: "Smoked Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "32B", name: "Specialty Smoked Beer", category: "Smoked Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "33A", name: "Wood-Aged Beer", category: "Wood Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "33B", name: "Specialty Wood-Aged Beer", category: "Wood Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "34A", name: "Commercial Specialty Beer", category: "Specialty Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "34B", name: "Mixed-Style Beer", category: "Specialty Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
  { code: "34C", name: "Experimental Beer", category: "Specialty Beer", og: null, fg: null, abv: null, ibu: null, srm: null },
];

const ALIASES: Record<string, string> = {
  apa: '18B',
  ipa: '21A',
  americanipa: '21A',
  hefeweizen: '10A',
  hefeweissbier: '10A',
  weizen: '10A',
  dunkelweizen: '10B',
  weizenbock: '10C',
  pilsner: '5D',
  germanpilsner: '5D',
  pils: '5D',
  dryirishstout: '15B',
  irishstout: '15B',
  neipa: '21C',
  hazyipa: '21C',
  weeheavy: '17C',
  esb: '11B',
  imperialstout: '20C',
  russianimperialstout: '20C',
  americanstout: '20B',
  oatmealstout: '16B',
  milkstout: '16A',
  porter: '20A',
  brownporter: '13C',
  americanporter: '20A',
  amberale: '19A',
  americanamber: '19A',
  americanbrown: '19C',
  blondeale: '18A',
  saison: '25B',
  tripel: '26C',
  dubbel: '26B',
  witbier: '24A',
  belgianwit: '24A',
  kolsch: '5B',
  helles: '4A',
  marzen: '6A',
  oktoberfest: '6A',
  bock: '5A',
  maibock: '4C',
  doppelbock: '9A',
  dunkel: '8A',
  schwarzbier: '8B',
  altbier: '7B',
  creamale: '1C',
  scotchale: '14B',
  barleywine: '22C',
  americanbarleywine: '22C',
  doubleipa: '22A',
  dipa: '22A',
  imperialipa: '22A',
  eipa: '22A',
};

const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

const BY_CODE = new Map<string, BeerStyle>();
const BY_NAME = new Map<string, BeerStyle>();
for (const s of BEER_STYLES) {
  const ck = s.code.toLowerCase();
  if (!BY_CODE.has(ck)) BY_CODE.set(ck, s);
  const key = normalize(s.name);
  if (!BY_NAME.has(key)) BY_NAME.set(key, s);
}

/** Match a free-text style (code, name, or common alias); undefined when unsure. */
export function findBeerStyle(text: string): BeerStyle | undefined {
  const raw = (text ?? '').trim();
  if (!raw) return undefined;
  const byCode = BY_CODE.get(raw.toLowerCase());
  if (byCode) return byCode;
  const key = normalize(raw);
  if (!key) return undefined;
  const byName = BY_NAME.get(key);
  if (byName) return byName;
  const alias = ALIASES[key];
  return alias ? BY_CODE.get(alias.toLowerCase()) : undefined;
}
