import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { basename, dirname, join } from 'pathe';
import { globSync } from 'tinyglobby';

import {
  type BuiltPackage,
  FULL_RUN_MARKER,
  type Metafile,
  selectAffectedTests,
} from './affected-tests.ts';

const ROOT = join(import.meta.dirname, '../..');
const METAFILES_DIR = join(ROOT, 'code/bench/esbuild-metafiles');

function readMetafiles(packageDirName: string): Metafile[] | undefined {
  const dir = join(METAFILES_DIR, packageDirName);
  const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.json')) : [];

  return files.length > 0
    ? files.map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as Metafile)
    : undefined;
}

function loadPackages(): BuiltPackage[] {
  const dirs = globSync(
    [
      'code/core/package.json',
      'code/{addons,builders,frameworks,lib,presets,renderers}/*/package.json',
      'scripts/package.json',
      'agent-eval/package.json',
    ],
    { cwd: ROOT }
  ).map((file) => dirname(file));

  // The build names metafile folders by package directory basename, so a shared basename makes
  // them impossible to attribute.
  const dirsByBasename = Map.groupBy(dirs, (dir) => basename(dir));

  return dirs.map((dir) => ({
    dir,
    metafiles:
      dirsByBasename.get(basename(dir))?.length === 1 ? readMetafiles(basename(dir)) : undefined,
    distFiles: globSync(`${dir}/dist/**/*.{js,mjs,cjs}`, { cwd: ROOT }),
    testFiles: globSync(`${dir}/**/*.{test,spec,test-d}.{ts,tsx,js,jsx,mjs,cjs}`, {
      cwd: ROOT,
      ignore: ['**/node_modules/**', '**/dist/**'],
    }),
  }));
}

const [changedFilesPath] = process.argv.slice(2);

if (!changedFilesPath) {
  throw new Error('Usage: node scripts/ci/select-affected-tests.ts <changed-files.txt>');
}

const changedFiles = readFileSync(changedFilesPath, 'utf8').split('\n').filter(Boolean);
const selection = selectAffectedTests(changedFiles, loadPackages());

process.stdout.write(
  selection.kind === 'full'
    ? `${FULL_RUN_MARKER}\n`
    : selection.files.map((file) => `${file}\n`).join('')
);
