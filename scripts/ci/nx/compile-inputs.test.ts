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
    return readdirSync(join(METAFILES, folder))
      .filter((file) => file.endsWith('.json'))
      .flatMap((metafile) => {
        const { inputs } = read(join(METAFILES, folder, metafile)) as {
          inputs: Record<string, unknown>;
        };
        return Object.keys(inputs)
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
