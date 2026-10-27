import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'path';

export async function updatePackageScripts({ cwd, prefix }: { cwd: string; prefix: string }) {
  const packageJsonPath = join(cwd, 'package.json');
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);
  packageJson.scripts = {
    ...packageJson.scripts,
    ...(packageJson.scripts.storybook && {
      storybook: `${prefix} ${packageJson.scripts.storybook}`,
      'build-storybook': `${prefix} ${packageJson.scripts['build-storybook']}`,
    }),
  };
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

export async function injectResolutions({
  cwd,
  resolutions,
}: {
  cwd: string;
  resolutions: Record<string, string>;
}) {
  const packageJsonPath = join(cwd, 'package.json');
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);
  packageJson.resolutions = {
    ...packageJson.resolutions,
    ...resolutions,
  };
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

/**
 * Split a package spec into its name and version/range part. Unlike a naive `lastIndexOf('@')`
 * split, this correctly handles `npm:` aliases (e.g. `@types/react@npm:types-react@beta` →
 * `['@types/react', 'npm:types-react@beta']`) by splitting on the first `@` after an optional scope.
 */
function parsePackageSpec(spec: string): [name: string, version: string | undefined] {
  const scoped = spec.startsWith('@');
  const body = scoped ? spec.slice(1) : spec;
  const atIndex = body.indexOf('@');
  if (atIndex === -1) {
    return [spec, undefined];
  }
  return [`${scoped ? '@' : ''}${body.slice(0, atIndex)}`, body.slice(atIndex + 1)];
}

/**
 * Add packages to a project's package.json without installing them. Specs must be versioned (e.g.
 * resolved via `getVersionedPackages`); `npm:` aliases and dist-tags are written verbatim, since
 * both are valid package.json values that the package manager resolves on the next install.
 */
export async function addPackageDependencies({
  cwd,
  dependencies = [],
  devDependencies = [],
}: {
  cwd: string;
  dependencies?: string[];
  devDependencies?: string[];
}) {
  const packageJsonPath = join(cwd, 'package.json');
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);

  const assign = (section: 'dependencies' | 'devDependencies', specs: string[]) => {
    if (specs.length === 0) {
      return;
    }
    packageJson[section] ??= {};
    for (const spec of specs) {
      const [name, version] = parsePackageSpec(spec);
      packageJson[section][name] = version ?? 'latest';
    }
  };

  assign('dependencies', dependencies);
  assign('devDependencies', devDependencies);

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

/** Remove packages from a project's package.json (per section) without running an install. */
export async function removePackageDependencies({
  cwd,
  dependencies = [],
  devDependencies = [],
}: {
  cwd: string;
  dependencies?: string[];
  devDependencies?: string[];
}) {
  const packageJsonPath = join(cwd, 'package.json');
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);

  for (const dep of dependencies) {
    delete packageJson.dependencies?.[dep];
  }
  for (const dep of devDependencies) {
    delete packageJson.devDependencies?.[dep];
  }

  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}
