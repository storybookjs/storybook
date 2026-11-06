import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { minimatch } from 'minimatch';
import { join, relative } from 'pathe';
import { expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');
const CODE = join(ROOT, 'code');
// Written by every `compile` (scripts/build/utils/generate-bundle.ts), one folder per package.
const METAFILES = join(CODE, 'bench/esbuild-metafiles');

type Package = { dir: string; name: string; dependencies: string[]; inputs: string[] };

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

const packages: Package[] = ['', 'addons', 'builders', 'frameworks', 'lib', 'presets', 'renderers']
  .flatMap((group) =>
    readdirSync(join(CODE, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(CODE, group, entry.name))
  )
  .filter((dir) => existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'project.json')))
  .map((dir) => {
    const pkg = read(join(dir, 'package.json'));
    const inputs: unknown[] = read(join(dir, 'project.json')).targets?.compile?.inputs ?? [];
    return {
      dir,
      name: pkg.name,
      dependencies: Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      }),
      inputs: inputs
        .filter((input): input is string => typeof input === 'string')
        .filter((input) => input.startsWith('{workspaceRoot}/'))
        .map((input) => input.slice('{workspaceRoot}/'.length)),
    };
  });

const owner = (file: string) =>
  packages
    .filter((pkg) => file.startsWith(`${pkg.dir}/`))
    .sort((a, b) => b.dir.length - a.dir.length)[0];

// Whether a package's `compile` hashes a file it bundles: its own, a dependency's (`^production`),
// or one its project.json lists in `compile.inputs`.
function hashes(pkg: Package, file: string) {
  const from = owner(file);
  if (!from || from === pkg || pkg.dependencies.includes(from.name)) {
    return true;
  }
  const path = relative(ROOT, file);
  const globs = pkg.inputs.filter((input) => !input.startsWith('!'));
  const negations = pkg.inputs.filter((input) => input.startsWith('!')).map((i) => i.slice(1));
  return (
    globs.some((glob) => minimatch(path, glob, { dot: true })) &&
    !negations.some((glob) => minimatch(path, glob, { dot: true }))
  );
}

// A package that bundles a file of another package without hashing it restores a stale `dist`
// from the cache when only that file changes, and `nx affected` does not rebuild it. CI compiles
// everything before the unit tests run, so the metafiles are there; locally, compile first.
it.skipIf(!existsSync(METAFILES))('every compile hashes the sources it bundles', () => {
  const missing: string[] = [];
  for (const folder of readdirSync(METAFILES)) {
    // The folder is the package directory's name; `mcp` is both an addon and a library.
    const candidates = packages.filter((pkg) => pkg.dir.endsWith(`/${folder}`));
    for (const metafile of readdirSync(join(METAFILES, folder)).filter((f) =>
      f.endsWith('.json')
    )) {
      const { inputs } = read(join(METAFILES, folder, metafile)) as {
        inputs: Record<string, unknown>;
      };
      for (const input of Object.keys(inputs)) {
        if (input.includes('node_modules/') || input.includes(':')) {
          continue;
        }
        const unhashed = candidates.filter((pkg) => !hashes(pkg, join(pkg.dir, input)));
        if (candidates.length > 0 && unhashed.length === candidates.length) {
          missing.push(
            `${candidates[0].name} bundles ${relative(ROOT, join(candidates[0].dir, input))}`
          );
        }
      }
    }
  }
  // Add the file's folder to `compile.inputs` in the package's project.json.
  expect([...new Set(missing)].sort()).toEqual([]);
});
