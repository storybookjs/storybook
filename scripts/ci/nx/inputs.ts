// The workspace packages and the files their Nx inputs (nx.json) hash, for the tests that guard
// those inputs (compile-inputs.test.ts, check-inputs.test.ts, nx-shared-globals.test.ts).
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { minimatch } from 'minimatch';
import { join, relative } from 'pathe';

export const ROOT = join(import.meta.dirname, '../../..');
const CODE = join(ROOT, 'code');

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

export const nxJson = read(join(ROOT, 'nx.json'));

export type NamedInputs = Record<string, unknown[]>;

export type Package = {
  // Relative to the workspace root.
  root: string;
  name: string;
  file: string;
  project: {
    name: string;
    targets: Record<string, Record<string, any>>;
    namedInputs?: NamedInputs;
  };
  dependencies: string[];
};

export const packages: Package[] = [
  '',
  'addons',
  'builders',
  'frameworks',
  'lib',
  'presets',
  'renderers',
]
  .flatMap((group) =>
    readdirSync(join(CODE, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(CODE, group, entry.name))
  )
  .filter((dir) => existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'project.json')))
  .map((dir) => {
    const pkg = read(join(dir, 'package.json'));
    return {
      root: relative(ROOT, dir),
      name: pkg.name,
      file: join(dir, 'project.json'),
      project: read(join(dir, 'project.json')),
      // The manifest fields Nx draws a project's dependencies from.
      dependencies: Object.keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
        ...pkg.optionalDependencies,
      }),
    };
  });

const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));

// The workspace packages a package depends on, directly or not, as Nx's `^` inputs reach them.
export const dependenciesOf = (pkg: Package) => {
  const reached = new Set<Package>();
  const visit = (name: string) => {
    const dependency = byName.get(name);
    if (dependency && !reached.has(dependency)) {
      reached.add(dependency);
      dependency.dependencies.forEach(visit);
    }
  };
  pkg.dependencies.forEach(visit);
  reached.delete(pkg);
  return [...reached];
};

export const ownerOf = (file: string) =>
  packages
    .filter((pkg) => file.startsWith(`${pkg.root}/`))
    .sort((a, b) => b.root.length - a.root.length)[0];

// The globs, relative to the workspace root, that a project's own inputs hash. A dependency's
// input (`^…`) and every input that is not a glob or a named input resolve to none.
export function globsOf(inputs: unknown[], namedInputs: NamedInputs, root: string): string[] {
  const named = { ...nxJson.namedInputs, ...namedInputs };
  return inputs.flatMap((input) => {
    if (typeof input !== 'string' || input.startsWith('^')) {
      return [];
    }
    if (named[input]) {
      return globsOf(named[input], namedInputs, root);
    }
    return [input.replace('{workspaceRoot}/', '').replace('{projectRoot}', root)];
  });
}

// Whether Nx hashes the file for these globs: one matches, and no negated one does.
export const covers = (globs: string[], path: string) => {
  const matches = (glob: string) => minimatch(path, glob, { dot: true });
  return (
    globs.some((glob) => !glob.startsWith('!') && matches(glob)) &&
    !globs.some((glob) => glob.startsWith('!') && matches(glob.slice(1)))
  );
};
