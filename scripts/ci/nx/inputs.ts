// The workspace packages and the files their Nx inputs (nx.json) hash, for the tests that guard
// those inputs (compile-inputs.test.ts, check-inputs.test.ts, nx-shared-globals.test.ts).
import { readFileSync } from 'node:fs';

import { minimatch } from 'minimatch';
import { join } from 'pathe';

import { type WorkspacePackage, workspacePackages } from '../../utils/workspace-packages.ts';

export const ROOT = join(import.meta.dirname, '../../..');

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

export const nxJson = read(join(ROOT, 'nx.json'));

export type NamedInputs = Record<string, unknown[]>;

export type Package = WorkspacePackage;

export const packages: Package[] = workspacePackages;

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
