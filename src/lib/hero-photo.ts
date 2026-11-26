// The photograph a page opens with is its Largest Contentful Paint. The browser only finds it in
// the body, after the font preloads in the head, so on a slow connection it waits for the fonts.
// These helpers compute the photograph's sources once: the page renders them and also passes
// the AVIF ones to BaseLayout, which preloads them ahead of the fonts. Computing both from the
// same call keeps the preloaded addresses identical to the ones the page asks for, so nothing is
// downloaded twice (a browser test checks this).
import { getImage } from 'astro:assets';

type Source = Parameters<typeof getImage>[0]['src'];
type Cover = Source & { width: number; height: number };

/** One `<source>` of a photograph: its media query, type and candidate files. */
export interface PhotoSource {
  media?: string;
  type: `image/${string}`;
  srcset: string;
  sizes: string;
}

/** What BaseLayout needs to preload a photograph's sources for one media query. */
export type ImagePreload = Omit<PhotoSource, 'type'>;

const formats = ['avif', 'webp'] as const;

/** Only the AVIF sources, as preloads. Browsers without AVIF skip them and load the image as usual. */
export function preloadsFor(sources: readonly PhotoSource[]): ImagePreload[] {
  return sources
    .filter((source) => source.type === 'image/avif')
    .map(({ media, srcset, sizes }) => ({ media, srcset, sizes }));
}

/** The project page cover: full width, at its own proportions. */
export const COVER_WIDTHS = [640, 960, 1280, 1920, 2400];
export const COVER_SIZES = '100vw';

/** A project card's cover (ProjectCard.astro), whatever its slot's width. */
export const CARD_WIDTHS = [480, 800, 1200, 1600];

/**
 * The first project card's AVIF candidates, exactly as `<Picture>` writes them in Photo.astro, for
 * the portfolio page's preload: the first card is the largest image at the top of the page.
 */
export async function cardPreload(cover: Source, sizes: string): Promise<ImagePreload> {
  const image = await getImage({ src: cover, widths: CARD_WIDTHS, format: 'avif' });
  return { srcset: image.srcSet.attribute, sizes };
}

/**
 * The cover's AVIF candidates exactly as `<Picture>` writes them in Photo.astro for the same
 * widths, for the project page's preload.
 */
export async function coverPreload(cover: Source): Promise<ImagePreload> {
  const image = await getImage({ src: cover, widths: COVER_WIDTHS, format: 'avif' });
  return { srcset: image.srcSet.attribute, sizes: COVER_SIZES };
}

/**
 * The home hero, art directed: on wide screens the cover as it is; on screens taller than they
 * are wide, a 3:4 crop from its middle, so a phone downloads a file it shows nearly whole.
 */
const HOME_CROPS = [
  { media: '(orientation: landscape)', widths: [960, 1440, 1920, 2400] },
  { media: '(orientation: portrait)', widths: [480, 768, 1080, 1200], aspect: 3 / 4 },
];
export const HOME_HERO_SIZES = '100vw';

/** The home hero's `<source>` list, landscape before portrait, AVIF before WebP in each. */
export async function homeHeroSources(cover: Cover): Promise<PhotoSource[]> {
  return Promise.all(
    HOME_CROPS.flatMap(({ media, widths, aspect }) =>
      formats.map(async (format) => {
        const crop = aspect
          ? {
              width: Math.round(cover.height * aspect),
              height: cover.height,
              fit: 'cover' as const,
              position: 'center',
            }
          : {};
        const image = await getImage({ src: cover, widths, format, ...crop });
        return {
          media,
          type: `image/${format}` as const,
          srcset: image.srcSet.attribute,
          sizes: HOME_HERO_SIZES,
        };
      }),
    ),
  );
}

/** The home hero's fallback `<img>`: the landscape widths as JPEG. */
export function homeHeroFallback(cover: Source) {
  return getImage({ src: cover, widths: HOME_CROPS[0].widths, format: 'jpg' });
}
