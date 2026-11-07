import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { join } from 'pathe';
import { expect, it } from 'vitest';

import { type Package, ROOT, covers, globsOf, ownerOf, packages } from './inputs.ts';

// Written by every `compile` (scripts/build/utils/generate-bundle.ts), one folder per Nx project.
const METAFILES = join(ROOT, 'code/bench/esbuild-metafiles');

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

const productionOf = (pkg: Package, input: string) =>
  globsOf([input], pkg.project.namedInputs ?? {}, pkg.root);

const projectOf = (folder: string) => packages.find((pkg) => pkg.project.name === folder);

const bundledFiles = (): { pkg: Package; file: string }[] =>
  readdirSync(METAFILES).flatMap((folder) => {
    const pkg = projectOf(folder);
    if (!pkg) {
      return [];
    }
    // esbuild's metafiles, and the inputs of the runtimes Rolldown bundles in chunks.
    return readdirSync(join(METAFILES, folder)).flatMap((file) => {
      const path = join(METAFILES, folder, file);
      const inputs = file.endsWith('.json')
        ? Object.keys((read(path) as { inputs: Record<string, unknown> }).inputs)
        : file.endsWith('.rolldown-inputs')
          ? readFileSync(path, 'utf8').split('\n').filter(Boolean)
          : [];
      return inputs
        .filter((input) => !input.includes('node_modules/') && !input.includes(':'))
        .map((input) => ({ pkg, file: join(pkg.root, input) }));
    });
  });

// CI compiles everything before the unit tests run, so the metafiles are there; locally, compile
// first.
const compiled = existsSync(METAFILES) || !!process.env.CI;

it.skipIf(!compiled)(
  "every bundled source is hashed by the package's compile and by the tasks that use the package",
  () => {
    const missing = new Set(
      readdirSync(METAFILES)
        .filter((folder) => !projectOf(folder))
        .map((folder) => `no Nx project is named ${folder}`)
    );
    const runtimes = readdirSync(METAFILES).flatMap((folder) =>
      readdirSync(join(METAFILES, folder)).filter((file) => file.endsWith('.rolldown-inputs'))
    );
    if (runtimes.length === 0) {
      missing.add('no compile wrote the inputs of a runtime it bundles with Rolldown');
    }
    for (const { pkg, file } of bundledFiles()) {
      const from = ownerOf(file);
      const hashedBy =
        from && from !== pkg && pkg.dependencies.includes(from.name)
          ? productionOf(from, 'own-production')
          : [];
      if (!covers(productionOf(pkg, 'production'), file) && !covers(hashedBy, file)) {
        missing.add(`${pkg.project.name} bundles ${file}`);
      }
    }
    expect(
      [...missing].sort(),
      "Add the file to `namedInputs.production` in the package's project.json"
    ).toEqual([]);
  },
  30_000
);

it.skipIf(!compiled)(
  'all-production hashes every bundled source, for the tasks that install from the local registry',
  () => {
    const allProduction = globsOf(['all-production'], {}, '');
    const missing = new Set(
      bundledFiles()
        .map(({ file }) => file)
        .filter((path) => !covers(allProduction, path))
    );
    expect([...missing].sort()).toEqual([]);
  },
  30_000
);
