// The photo import behind `npm run photos:import` (scripts/photo-import.mjs).
// Test photographs are made at runtime with sharp in a temporary folder, so no
// image files are committed. The GPS position and camera are made up.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HEIC_HELP,
  MAX_EDGE,
  cleanName,
  formatBlock,
  importPhotos,
  isProjectId,
  planImport,
} from '../../scripts/photo-import.mjs';

/** A plain photograph with camera and GPS metadata, like one straight off a phone. */
async function cameraPhoto(path: string, width: number, height: number, orientation = 1) {
  await sharp({ create: { width, height, channels: 3, background: '#4080c0' } })
    .withExif({
      IFD0: { Make: 'ExampleCam', Model: 'Test One' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '26/1 56/1 0/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '80/1 5/1 0/1',
      },
    })
    .withMetadata({ orientation })
    .jpeg()
    .toFile(path);
}

/** True when an EXIF block holds a pointer to a GPS section (tag 0x8825). */
function hasGps(exif: Buffer) {
  for (let i = 0; i < exif.length - 1; i++) {
    if ((exif[i] === 0x88 && exif[i + 1] === 0x25) || (exif[i] === 0x25 && exif[i + 1] === 0x88))
      return true;
  }
  return false;
}

describe('project ids and file names', () => {
  it('accepts content file names only', () => {
    expect(isProjectId('masterpiece-on-the-river')).toBe(true);
    expect(isProjectId('Masterpiece')).toBe(false);
    expect(isProjectId('../escape')).toBe(false);
    expect(isProjectId('river-house.md')).toBe(false);
  });

  it('cleans camera names into lowercase hyphenated JPEG names', () => {
    expect(cleanName('DJI_0042.JPG')).toBe('dji-0042.jpg');
    expect(cleanName('Pool at dusk (2).png')).toBe('pool-at-dusk-2.jpg');
    expect(cleanName('Café terrace.webp')).toBe('cafe-terrace.jpg');
    expect(cleanName('___.jpeg')).toBe('photo.jpg');
  });
});

describe('planImport', () => {
  it('imports photographs in natural order and skips other files', () => {
    const plan = planImport(['photo-10.jpg', 'notes.txt', 'photo-2.jpg', '.DS_Store', 'a.mov']);
    expect(plan.items.map((item) => item.target)).toEqual(['photo-2.jpg', 'photo-10.jpg']);
    expect(plan.skipped.map((item) => item.source)).toEqual(['a.mov', 'notes.txt']);
  });

  it('gives names that clean to the same thing a number', () => {
    const plan = planImport(['Pool.jpg', 'pool.png', 'POOL.webp']);
    expect(plan.items.map((item) => item.target)).toEqual(['pool.jpg', 'pool-2.jpg', 'pool-3.jpg']);
  });

  it('marks HEIC files so they are tried, not silently dropped', () => {
    const plan = planImport(['IMG_0001.HEIC']);
    expect(plan.heif).toEqual(['IMG_0001.HEIC']);
    expect(plan.items.map((item) => item.target)).toEqual(['img-0001.jpg']);
  });
});

describe('formatBlock', () => {
  it('makes the first photograph the cover and the rest the gallery', () => {
    const block = formatBlock('river-house', ['front.jpg', 'pool.jpg']);
    expect(block).toContain('cover: ../../assets/projects/river-house/front.jpg');
    expect(block).toContain('  - src: ../../assets/projects/river-house/pool.jpg');
    expect(block).not.toContain('front.jpg\n    alt');
  });

  it('leaves every alt text empty, which the schema refuses (at least 10 characters)', () => {
    const block = formatBlock('river-house', ['front.jpg', 'pool.jpg', 'dock.jpg']);
    expect(block.match(/coverAlt: '' #/g)).toHaveLength(1);
    expect(block.match(/ {4}alt: '' #/g)).toHaveLength(2);
  });

  it('leaves out the gallery when there is only a cover', () => {
    expect(formatBlock('river-house', ['front.jpg'])).not.toContain('gallery');
  });
});

describe('importPhotos', () => {
  let work: string;
  let source: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'photo-import-'));
    source = join(work, 'camera');
    mkdirSync(source);
  });

  afterEach(() => rmSync(work, { recursive: true, force: true }));

  const run = (options: { force?: boolean } = {}) =>
    importPhotos({ folder: source, projectId: 'river-house', root: work, ...options });
  const output = (name: string) => join(work, 'src/assets/projects/river-house', name);

  it('strips GPS and camera metadata', async () => {
    await cameraPhoto(join(source, 'IMG_0001.jpg'), 120, 80);

    const before = await sharp(join(source, 'IMG_0001.jpg')).metadata();
    expect(before.exif && hasGps(before.exif)).toBe(true);
    expect(before.exif?.includes('ExampleCam')).toBe(true);

    await run();
    const after = await sharp(output('img-0001.jpg')).metadata();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
    expect(after.icc).toBeUndefined();
  });

  it('scales the long edge down to 2400px and never enlarges', async () => {
    await cameraPhoto(join(source, 'wide.jpg'), 3000, 2000);
    await cameraPhoto(join(source, 'tall.jpg'), 1500, 3600);
    await cameraPhoto(join(source, 'small.jpg'), 800, 600);

    const { written } = await run();
    const size = (name: string) => written.find((item) => item.target === name);
    expect(size('wide.jpg')).toMatchObject({ width: MAX_EDGE, height: 1600 });
    expect(size('tall.jpg')).toMatchObject({ width: 1000, height: MAX_EDGE });
    expect(size('small.jpg')).toMatchObject({ width: 800, height: 600 });
  });

  it('turns a sideways photograph upright before the orientation tag is dropped', async () => {
    await cameraPhoto(join(source, 'sideways.jpg'), 120, 80, 6);

    const { written } = await run();
    expect(written[0]).toMatchObject({ width: 80, height: 120 });
  });

  it('reads PNG and WebP and writes JPEG', async () => {
    const pixels = {
      create: { width: 40, height: 30, channels: 4 as const, background: '#ffffff00' },
    };
    await sharp(pixels).png().toFile(join(source, 'plan.png'));
    await sharp(pixels).webp().toFile(join(source, 'drone.webp'));

    const { written } = await run();
    expect(written.map((item) => item.target)).toEqual(['drone.jpg', 'plan.jpg']);
    expect((await sharp(output('plan.jpg')).metadata()).format).toBe('jpeg');
  });

  it('skips a HEIC file it cannot read, with a clear way forward', async () => {
    await cameraPhoto(join(source, 'front.jpg'), 40, 30);
    writeFileSync(join(source, 'IMG_0002.HEIC'), 'not an image the bundled library can read');

    const { written, skipped, block } = await run();
    expect(written.map((item) => item.target)).toEqual(['front.jpg']);
    expect(skipped).toEqual([{ source: 'IMG_0002.HEIC', reason: HEIC_HELP }]);
    expect(block).not.toContain('img-0002');
  });

  it('never overwrites a photograph without --force', async () => {
    await cameraPhoto(join(source, 'front.jpg'), 40, 30);
    await run();
    const first = readdirSync(join(work, 'src/assets/projects/river-house'));

    await cameraPhoto(join(source, 'front.jpg'), 60, 30);
    await expect(run()).rejects.toThrow(/already exist.*front\.jpg.*--force/);
    expect((await sharp(output('front.jpg')).metadata()).width).toBe(40);
    expect(readdirSync(join(work, 'src/assets/projects/river-house'))).toEqual(first);

    await run({ force: true });
    expect((await sharp(output('front.jpg')).metadata()).width).toBe(60);
  });

  it('refuses a project id that is not a content file name', async () => {
    await expect(
      importPhotos({ folder: work, projectId: '../../elsewhere', root: work }),
    ).rejects.toThrow(/not a project id/);
  });
});
