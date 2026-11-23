// Imports a folder of project photographs: resized masters without location or
// camera data in src/assets/projects/<project-id>/, and a cover and gallery
// block to paste into the project's content file. The work is in
// scripts/photo-import.mjs.
//
// Usage: npm run photos:import -- <folder> <project-id> [--force]
//
//   folder      The folder of camera files (JPEG, PNG, WebP; HEIC when this
//               machine can read it).
//   project-id  The project file's name in src/content/projects/, without .md.
//   --force     Replace photographs that already exist. Without it, nothing
//               is written when any of them exists.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { importPhotos } from './photo-import.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const [folder, projectId] = args.filter((arg) => !arg.startsWith('--'));

if (!folder || !projectId) {
  console.error('Usage: npm run photos:import -- <folder> <project-id> [--force]');
  process.exit(1);
}

try {
  const root = process.cwd();
  const result = await importPhotos({ folder, projectId, root, force });

  for (const item of result.written) {
    console.log(`  ${item.source} -> ${item.target} (${item.width} x ${item.height})`);
  }
  for (const item of result.skipped) console.log(`  skipped ${item.source}: ${item.reason}`);

  if (result.written.length === 0) {
    console.log('\nNo photographs were imported.');
    process.exitCode = 1;
  } else {
    console.log(`\n${result.written.length} photographs written to ${result.outputFolder}/.`);
    const contentFile = join('src', 'content', 'projects', `${projectId}.md`);
    if (!existsSync(join(root, contentFile))) {
      console.log(`There is no ${contentFile} yet: copy _template.md to it first.`);
    }
    console.log(
      `\nPaste this into the fields at the top of ${contentFile}, replacing its cover and gallery.`,
    );
    console.log('The first photograph is the cover; reorder the lines as you like.\n');
    console.log(result.block);
    console.log(
      '\nThe build stops until every alt text is written: describe what each photograph shows.',
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
