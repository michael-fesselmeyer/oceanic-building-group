// Turns a folder of camera files into project photographs the site can use
// (scripts/import-photos.mjs is the command). Each photograph is turned
// upright, scaled to at most 2400px on its long edge, converted to sRGB,
// saved as a JPEG with every piece of metadata removed (GPS position, camera
// and lens, dates, owner), and written to src/assets/projects/<project-id>/
// under a clean file name. A `cover` and `gallery` block for the project's
// content file is returned with empty alt text, which the content schema
// refuses (alt text is at least 10 characters), so the build fails until a
// person describes each photograph.
//
// Planning (names, collisions, what is skipped) is kept apart from the image
// work so the unit tests can check it with plain lists.
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

/** Longest edge of a master photograph, from the image rules in AGENTS.md. */
export const MAX_EDGE = 2400;

/** JPEG quality of the masters. Astro re-encodes them for the page, so keep them generous. */
export const JPEG_QUALITY = 90;

/** File types read directly. */
export const SUPPORTED = ['.jpg', '.jpeg', '.png', '.webp'];

/** iPhone photographs. Read only when the installed image library can decode them. */
export const HEIF = ['.heic', '.heif'];

export const HEIC_HELP =
  'HEIC photographs need an HEVC decoder, which the free image library bundled with the site ' +
  'does not include. Export them as JPEG first (Photos: File > Export, or on a Mac: ' +
  'sips -s format jpeg photo.heic --out photo.jpg) and run the import again.';

/** A project id is the content file's name: lowercase words joined by hyphens. */
export function isProjectId(id) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
}

/**
 * A clean name for a photograph: lowercase ASCII words joined by hyphens, always
 * ending in .jpg. "DJI_0042.JPG" becomes "dji-0042.jpg".
 * @param {string} fileName
 */
export function cleanName(fileName) {
  const stem = basename(fileName, extname(fileName))
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${stem || 'photo'}.jpg`;
}

/** Natural order, so "photo-2" comes before "photo-10". */
const naturally = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

/**
 * Decides what happens to each file in the folder: which are imported and under
 * which name, and which are skipped and why. Names that clean to the same thing
 * get -2, -3... in folder order.
 * @param {string[]} fileNames  Names in the source folder.
 * @returns {{ items: { source: string, target: string }[], skipped: { source: string, reason: string }[], heif: string[] }}
 */
export function planImport(fileNames) {
  const items = [];
  const skipped = [];
  const heif = [];
  const taken = new Set();
  for (const source of [...fileNames].sort(naturally)) {
    if (source.startsWith('.')) continue;
    const extension = extname(source).toLowerCase();
    if (HEIF.includes(extension)) heif.push(source);
    else if (!SUPPORTED.includes(extension)) {
      skipped.push({ source, reason: 'not a JPEG, PNG, WebP or HEIC file' });
      continue;
    }
    const clean = cleanName(source);
    let target = clean;
    for (let n = 2; taken.has(target); n++) target = clean.replace(/\.jpg$/, `-${n}.jpg`);
    taken.add(target);
    items.push({ source, target });
  }
  return { items, skipped, heif };
}

/** Where a project's photographs go, relative to the repository root. */
export function assetFolder(projectId) {
  return join('src', 'assets', 'projects', projectId);
}

/**
 * The block to paste into src/content/projects/<project-id>.md. The first
 * photograph is the cover and the rest form the gallery, in folder order;
 * reorder the lines as needed. Paths are relative to the content file.
 * @param {string} projectId
 * @param {string[]} targets  File names written to the project's asset folder.
 */
export function formatBlock(projectId, targets) {
  if (targets.length === 0) return '';
  const path = (name) => `../../assets/projects/${projectId}/${name}`;
  const note = '# describe this photograph (10 to 160 characters); the build fails until you do';
  const [cover, ...gallery] = targets;
  const lines = [`cover: ${path(cover)}`, `coverAlt: '' ${note}`];
  if (gallery.length > 0) {
    lines.push('gallery:');
    for (const name of gallery) lines.push(`  - src: ${path(name)}`, `    alt: '' ${note}`);
  }
  return lines.join('\n');
}

/**
 * Writes one master: upright, at most MAX_EDGE on the long edge, sRGB JPEG, no
 * metadata. sharp drops EXIF, XMP, IPTC and ICC data unless asked to keep them;
 * the pipeline never asks.
 * @param {string} input
 * @param {string} output
 */
export async function writeMaster(input, output) {
  const info = await sharp(input)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(output);
  return { width: info.width, height: info.height };
}

/** True when the installed image library can read this file. */
async function canDecode(path) {
  try {
    await sharp(path).metadata();
    return true;
  } catch {
    return false;
  }
}

/**
 * Imports every photograph in `folder` for `projectId`.
 * @param {{ folder: string, projectId: string, root: string, force?: boolean }} options
 * @returns {Promise<{ written: { source: string, target: string, width: number, height: number }[], skipped: { source: string, reason: string }[], block: string, outputFolder: string }>}
 */
export async function importPhotos({ folder, projectId, root, force = false }) {
  if (!isProjectId(projectId)) {
    throw new Error(
      `"${projectId}" is not a project id. Use the project file's name, for example masterpiece-on-the-river.`,
    );
  }
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new Error(`The folder "${folder}" does not exist.`);
  }

  const files = readdirSync(folder).filter((name) => statSync(join(folder, name)).isFile());
  const plan = planImport(files);
  const skipped = [...plan.skipped];

  // HEIC is imported only if this machine's image library can decode it.
  const items = [];
  for (const item of plan.items) {
    if (plan.heif.includes(item.source) && !(await canDecode(join(folder, item.source)))) {
      skipped.push({ source: item.source, reason: HEIC_HELP });
    } else {
      items.push(item);
    }
  }

  const outputFolder = join(root, assetFolder(projectId));
  const existing = items.filter((item) => existsSync(join(outputFolder, item.target)));
  if (existing.length > 0 && !force) {
    throw new Error(
      `These files already exist in ${assetFolder(projectId)} and were left alone: ` +
        `${existing.map((item) => item.target).join(', ')}. Run again with --force to replace them.`,
    );
  }

  mkdirSync(outputFolder, { recursive: true });
  const written = [];
  for (const item of items) {
    try {
      const size = await writeMaster(join(folder, item.source), join(outputFolder, item.target));
      written.push({ ...item, ...size });
    } catch (error) {
      skipped.push({ source: item.source, reason: `could not be read (${error.message})` });
    }
  }

  return {
    written,
    skipped,
    block: formatBlock(
      projectId,
      written.map((item) => item.target),
    ),
    outputFolder: assetFolder(projectId),
  };
}
