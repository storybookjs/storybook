import { existsSync, readFileSync, readdirSync } from 'node:fs';

import type { Metafile as EsbuildMetafile } from 'esbuild';
import { basename, dirname, join } from 'pathe';
import { globSync } from 'tinyglobby';

import { metafileDirFor } from '../build/utils/metafiles.ts';
import { type BuiltPackage, type Metafile, selectAffectedTests } from './affected-tests.ts';

const ROOT = join(import.meta.dirname, '../..');

function readMetafiles(packageDir: string): Metafile[] | undefined {
  const dir = metafileDirFor(packageDir);
  const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.json')) : [];

  return files.length > 0
    ? files.map(
        (file): Metafile => JSON.parse(readFileSync(join(dir, file), 'utf8')) as EsbuildMetafile
      )
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
    metafiles: dirsByBasename.get(basename(dir))?.length === 1 ? readMetafiles(dir) : undefined,
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
process.stdout.write(
  selectAffectedTests(changedFiles, loadPackages())
    .map((file) => `${file}\n`)
    .join('')
);
