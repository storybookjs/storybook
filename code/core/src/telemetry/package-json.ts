import { fileURLToPath, pathToFileURL } from 'node:url';

import * as pkg from 'empathic/package';
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
  // Use a proper file URL as the resolution parent so that import.meta.resolve
  // behaves consistently across Node.js and Vitest environments.
  const parentUrl = pathToFileURL(process.cwd() + '/').href;

  try {
    // Resolve to a file URL that can be passed to import().
    // We always store a file URL (not a plain path) so the final import() call is consistent.
    let resolvedPackageJsonUrl: string | undefined;

    try {
      const filePath = pkg.up({
        cwd: fileURLToPath(import.meta.resolve(packageName, parentUrl)),
      });
      if (filePath) {
        resolvedPackageJsonUrl = pathToFileURL(filePath).href;
      }
    } catch {
      // Primary resolution failed (e.g. package has no default "." export).
      // Fall through to the package.json subpath fallback below.
    }

    if (!resolvedPackageJsonUrl) {
      // import.meta.resolve already returns a file URL string, so use it directly.
      resolvedPackageJsonUrl = import.meta.resolve(`${packageName}/package.json`, parentUrl);
    }

    const { default: packageJson } = await import(resolvedPackageJsonUrl, {
      with: { type: 'json' },
    });
    return packageJson;
  } catch (err) {
    return undefined;
  }
};
