import { getRayfinClient } from '@/lib/rayfin-client';
import { readProductPage } from '@/lib/recipe-image';
import { parseImportedRecipe, type ImportedRecipe } from '@/lib/recipe-import';

const POLL_MS = 5000;
const GIVE_UP_MS = 6 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ImportOutcome {
  recipe: ImportedRecipe;
  pdfUrl: string;
  /** Set when the brewer gave a product page rather than the PDF. */
  productUrl: string | null;
  imageUrl: string | null;
}

/**
 * Reads a recipe from a product page or a PDF link. Takes about a minute.
 * Returns null if `isCancelled` becomes true while waiting.
 */
export async function runImport(input: string, isCancelled: () => boolean): Promise<ImportOutcome | null> {
  const value = input.trim();
  let pdfUrl = value;
  let productUrl: string | null = null;
  let imageUrl: string | null = null;
  if (!/\.pdf(\?.*)?$/i.test(value)) {
    const page = await readProductPage(value);
    if (!page.pdfUrl) throw new Error('No recipe PDF found on that page. Paste the PDF link instead.');
    pdfUrl = page.pdfUrl;
    productUrl = value;
    imageUrl = page.imageUrl;
  }

  const fn = (await getRayfinClient()).functions;
  const started = await fn.startImport.invoke({ url: pdfUrl });
  if (!started.ok) throw new Error(started.message);

  const deadline = Date.now() + GIVE_UP_MS;
  while (!isCancelled() && Date.now() < deadline) {
    await sleep(POLL_MS);
    const res = await fn.getImport.invoke({ jobId: started.jobId });
    if (res.status === 'running') continue;
    if (res.status === 'error') throw new Error(res.error);
    const recipe = { ...parseImportedRecipe(res.recipeJson), sourceUrl: pdfUrl, productUrl };
    return { recipe, pdfUrl, productUrl, imageUrl };
  }
  if (isCancelled()) return null;
  throw new Error('The import took too long. Try again.');
}
