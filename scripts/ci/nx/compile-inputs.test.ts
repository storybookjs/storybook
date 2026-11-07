import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { minimatch } from 'minimatch';
import { join, relative } from 'pathe';
import { expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');
const CODE = join(ROOT, 'code');
// Written by every `compile` (scripts/build/utils/generate-bundle.ts), one folder per Nx project.
const METAFILES = join(CODE, 'bench/esbuild-metafiles');

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const nxJson = read(join(ROOT, 'nx.json'));

// A named input as the globs Nx hashes, relative to the workspace root.
function globsOf(inputs: unknown[], named: Record<string, unknown[]>, root: string): string[] {
  return inputs.flatMap((input) => {
    if (typeof input !== 'string' || input.startsWith('^')) {
      return [];
    }
    if (named[input]) {
      return globsOf(named[input], named, root);
    }
    return [input.replace('{workspaceRoot}/', '').replace('{projectRoot}', root)];
  });
}

const covers = (globs: string[], path: string) => {
  const matches = (glob: string) => minimatch(path, glob, { dot: true });
  return (
    globs.some((glob) => !glob.startsWith('!') && matches(glob)) &&
    !globs.some((glob) => glob.startsWith('!') && matches(glob.slice(1)))
  );
};

type Package = {
  dir: string;
  name: string;
  project: string;
  dependencies: string[];
  production: string[];
};

const packages: Package[] = ['', 'addons', 'builders', 'frameworks', 'lib', 'presets', 'renderers']
  .flatMap((group) =>
    readdirSync(join(CODE, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(CODE, group, entry.name))
  )
  .filter((dir) => existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'project.json')))
  .map((dir) => {
    const pkg = read(join(dir, 'package.json'));
    const project = read(join(dir, 'project.json'));
    const named = { ...nxJson.namedInputs, ...project.namedInputs };
    return {
      dir,
      name: pkg.name,
      project: project.name,
      dependencies: Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      }),
      production: globsOf(['production'], named, relative(ROOT, dir)),
    };
  });

const owner = (file: string) =>
  packages
    .filter((pkg) => file.startsWith(`${pkg.dir}/`))
    .sort((a, b) => b.dir.length - a.dir.length)[0];

const projectOf = (folder: string) => packages.find((pkg) => pkg.project === folder);

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
          .map((input) => ({ pkg, file: join(pkg.dir, input) }));
      });
  });

// CI compiles everything before the unit tests run, so the metafiles are there; locally, compile
// first.
const compiled = existsSync(METAFILES) || !!process.env.CI;

// `compile` hashes the package's `production`, and so do the tasks that use the package, through
// `^production`: a sandbox, for one. A bundled file outside `production` changes the bundle without
// changing those hashes, so they restore stale results and `nx affected` skips them.
it.skipIf(!compiled)("every package's production covers the sources it bundles", () => {
  const missing = new Set(
    readdirSync(METAFILES)
      .filter((folder) => !projectOf(folder))
      .map((folder) => `no Nx project is named ${folder}`)
  );
  for (const { pkg, file } of bundledFiles()) {
    const from = owner(file);
    const path = relative(ROOT, file);
    const hashedBy =
      from && from !== pkg && pkg.dependencies.includes(from.name) ? from.production : [];
    if (!covers(pkg.production, path) && !covers(hashedBy, path)) {
      missing.add(`${pkg.project} bundles ${path}`);
    }
  }
  // Add the file to `namedInputs.production` in the package's project.json.
  expect([...missing].sort()).toEqual([]);
});

// `publish`, `init-empty` and the test Storybooks hash `all-production` for the packages they
// install from the local registry.
it.skipIf(!compiled)('all-production covers every bundled source', () => {
  const allProduction = globsOf(['all-production'], nxJson.namedInputs, '');
  const missing = new Set(
    bundledFiles()
      .map(({ file }) => relative(ROOT, file))
      .filter((path) => !covers(allProduction, path))
  );
  expect([...missing].sort()).toEqual([]);
});
