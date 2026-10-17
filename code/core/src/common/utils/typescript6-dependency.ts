import { coerce } from 'semver';

import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';

export const TYPESCRIPT6_PACKAGE = '@typescript/typescript6@^6.0.2';

const majorVersion = (version: string | null | undefined) =>
  version ? (coerce(version, { includePrerelease: true })?.major ?? null) : null;

/**
 * Package spec to install when the project uses TypeScript 7 and does not already depend on
 * `@typescript/typescript6`. Resolves to `null` when nothing should be installed.
 */
export async function typescript6PackageToInstall(
  packageManager: Pick<JsPackageManager, 'getAllDependencies' | 'getInstalledVersion'>
): Promise<string | null> {
  const dependencies = packageManager.getAllDependencies();
  if (dependencies['@typescript/typescript6']) {
    return null;
  }

  const installedMajor = majorVersion(await packageManager.getInstalledVersion('typescript'));
  const typescriptMajor = installedMajor ?? majorVersion(dependencies.typescript);
  if (typescriptMajor === null || typescriptMajor < 7) {
    return null;
  }
  return TYPESCRIPT6_PACKAGE;
}
