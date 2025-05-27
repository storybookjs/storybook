import type { JsPackageManager } from 'storybook/internal/common';

import { lt } from 'semver';

type Result<M extends Record<string, string>> = {
  installedVersion: string | undefined;
  packageName: keyof M;
  minimumVersion: string;
};

const typedKeys = <TKey extends string>(obj: Record<TKey, any>) => Object.keys(obj) as TKey[];

/**
 * Finds the outdated package in the list of packages.
 *
 * @param minimalVersionsMap - The map of minimal versions for the packages.
 * @param options - The options for the function.
 * @returns The outdated package or false if no outdated package is found.
 */
export async function findOutdatedPackage<M extends Record<string, string>>(
  minimalVersionsMap: M,
  options: {
    packageManager: JsPackageManager;
  }
): Promise<false | Result<M>> {
  const list = await Promise.all(
    typedKeys(minimalVersionsMap).map(async (packageName) => ({
      packageName,
      installedVersion: options.packageManager.getModulePackageJSON(packageName)?.version ?? null,
      minimumVersion: minimalVersionsMap[packageName],
    }))
  );

  return list.reduce<false | Result<M>>(
    (acc, { installedVersion, minimumVersion, packageName }) => {
      if (acc) {
        return acc;
      }
      if (packageName && installedVersion && lt(installedVersion, minimumVersion)) {
        return {
          installedVersion,
          packageName,
          minimumVersion,
        };
      }
      return acc;
    },
    false
  );
}
