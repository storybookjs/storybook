// The workspace packages under code/ that are Nx projects: their package.json and project.json,
// and the workspace dependencies Nx draws from their manifest. For the sandbox projects'
// dependencies (create-nx-sandbox-projects.ts) and the tests that guard the Nx inputs
// (scripts/ci/nx/inputs.ts).
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { join, relative } from 'pathe';

const ROOT = join(import.meta.dirname, '../..');
const CODE = join(ROOT, 'code');

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

export type WorkspacePackage = {
  // Relative to the workspace root.
  root: string;
  name: string;
  file: string;
  project: {
    name: string;
    targets: Record<string, Record<string, any>>;
    namedInputs?: Record<string, unknown[]>;
  };
  dependencies: string[];
};

export const workspacePackages: WorkspacePackage[] = [
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
