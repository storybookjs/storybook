import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as pkg from 'empathic/package';
import type { PackageJson } from 'type-fest';

import type { Dependency } from './types.ts';

export const getActualPackageVersions = async (
  packages: Record<string, Partial<Dependency>>,
  cwd = process.cwd()
) => {
  const packageNames = Object.keys(packages);
  return Promise.all(packageNames.map((packageName) => getActualPackageVersion(packageName, cwd)));
};

export const getActualPackageVersion = async (packageName: string, cwd = process.cwd()) => {
  try {
    const packageJson = await getActualPackageJson(packageName, cwd);
    return {
      name: packageJson?.name || packageName,
      version: packageJson?.version || null,
    };
  } catch {
    return {
      name: packageName,
      version: null,
    };
  }
};

export const getActualPackageJson = async (
  packageName: string,
  cwd = process.cwd()
): Promise<PackageJson | undefined> => {
  const resolvedPackageJsonPath = resolvePackageJsonPath(packageName, cwd);
  if (!resolvedPackageJsonPath) {
    return undefined;
  }
  try {
    const { default: packageJson } = await import(pathToFileURL(resolvedPackageJsonPath).href, {
      with: { type: 'json' },
    });
    return packageJson;
  } catch {
    return undefined;
  }
};

const attempt = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

/**
 * Resolves the package.json of a package as installed for the project directory. Resolution must
 * be anchored to the project rather than to this module: when the Storybook CLI runs from outside
 * the project (e.g. via `npx`), module-relative resolution finds the CLI's own dependency tree.
 */
const resolvePackageJsonPath = (packageName: string, cwd: string): string | undefined => {
  const projectRequire = createRequire(join(cwd, 'package.json'));
  return (
    attempt(() => projectRequire.resolve(`${packageName}/package.json`)) ??
    attempt(() => pkg.up({ cwd: projectRequire.resolve(packageName) }) || undefined) ??
    findPackageJsonInNodeModules(packageName, cwd)
  );
};

/**
 * Fallback for packages whose exports map hides both `./package.json` and any require-able entry:
 * walk up from the project directory looking for `node_modules/<name>/package.json`.
 */
const findPackageJsonInNodeModules = (packageName: string, cwd: string): string | undefined => {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', packageName, 'package.json');
    if (existsSync(candidate)) {
      return candidate;
    }
    if (dirname(dir) === dir) {
      return undefined;
    }
  }
};
