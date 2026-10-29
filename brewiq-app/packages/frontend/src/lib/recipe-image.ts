import { getRayfinClient } from '@/lib/rayfin-client';

const MAX_LENGTH = 600;

/**
 * Turns what the brewer pasted into an image URL to link to: a direct https image link is used
 * as is, anything else is treated as a product page and read for its main image.
 */
export async function resolveImageUrl(input: string): Promise<string> {
  const value = input.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid URL.');
  }
  if (url.protocol !== 'https:') throw new Error('Only https links are supported.');
  if (/\.(png|jpe?g|webp|gif|avif)$/i.test(url.pathname)) {
    if (value.length > MAX_LENGTH) throw new Error('That image link is too long.');
    return value;
  }
  const res = await (await getRayfinClient()).functions.readProductPage.invoke({ pageUrl: value });
  if (!res.ok) throw new Error(`${res.message} You can paste a direct image link instead.`);
  if (!res.imageUrl) throw new Error('No image found on that page. Paste a direct image link instead.');
  return res.imageUrl;
}

/** Reads a product page for its image and recipe PDF link. */
export async function readProductPage(pageUrl: string): Promise<{ imageUrl: string | null; pdfUrl: string | null }> {
  const res = await (await getRayfinClient()).functions.readProductPage.invoke({ pageUrl: pageUrl.trim() });
  if (!res.ok) throw new Error(res.message);
  return { imageUrl: res.imageUrl, pdfUrl: res.pdfUrl };
}
