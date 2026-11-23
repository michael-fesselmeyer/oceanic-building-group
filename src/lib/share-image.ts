// Share images for pages that have a photograph of their own. Link previews
// show the photograph cropped to the 1200 x 630 card, as a JPEG, because not
// every preview service reads AVIF or WebP. Pages without one fall back to the
// brand card (see Seo.astro).
import { getImage } from 'astro:assets';
import { DEFAULT_SHARE_IMAGE } from './seo';

type Source = Parameters<typeof getImage>[0]['src'];

export interface ShareImage {
  /** Address as Astro serves it; Seo.astro makes it absolute. */
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** The photograph cropped to the share card size. */
export async function shareImageFor(cover: Source, alt: string): Promise<ShareImage> {
  const { width, height } = DEFAULT_SHARE_IMAGE;
  const image = await getImage({ src: cover, width, height, fit: 'cover', format: 'jpg' });
  return { src: image.src, alt, width, height };
}
