import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { findUp } from 'find-up';
import { join } from 'pathe';
import type { PackageJson } from 'type-fest';

import type { Dependency } from './types';

export const getActualPackageVersions = async (packages: Record<string, Partial<Dependency>>) => {
  const packageNames = Object.keys(packages);
  return Promise.all(packageNames.map(getActualPackageVersion));
};

export const getActualPackageVersion = async (packageName: string) => {
  try {
    const packageJson = await getActualPackageJson(packageName);
    return {
      name: packageJson?.name || packageName,
      version: packageJson?.version || null,
    };
  } catch (err) {
    return {
      name: packageName,
      version: null,
    };
  }
};

export const getActualPackageJson = async (
  packageName: string
): Promise<PackageJson | undefined> => {
  try {
    let resolvedPackageJsonPath = await findUp('package.json', {
      cwd: fileURLToPath(import.meta.resolve(packageName, process.cwd())),
    });
    if (!resolvedPackageJsonPath) {
      resolvedPackageJsonPath = import.meta.resolve(
        join(packageName, 'package.json'),
        process.cwd()
      );
    }

    const { default: packageJson } = await import(pathToFileURL(resolvedPackageJsonPath).href, {
      with: { type: 'json' },
    });
    return packageJson;
  } catch (err) {
    return undefined;
  }
};
