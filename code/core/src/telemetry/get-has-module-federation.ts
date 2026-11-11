import { matchesPackagePattern } from '../shared/utils/ecosystem-identifier.ts';
import type { PackageJson } from '../types/index.ts';

const MODULE_FEDERATION_PACKAGES = ['@module-federation/*', '@originjs/vite-plugin-federation'];

/**
 * @param packageJson The package JSON of the project
 * @returns Boolean Does this project have a Module Federation package installed?
 *
 *   Only detects Module Federation via an installed package (e.g. `@module-federation/*` or
 *   `@originjs/vite-plugin-federation`). Projects that configure webpack's built-in
 *   `ModuleFederationPlugin` directly, without any of these packages, are not detectable this way.
 */
export function getHasModuleFederation(packageJson: PackageJson) {
  const allDependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  };

  return Object.keys(allDependencies).some((depName) =>
    matchesPackagePattern(depName, MODULE_FEDERATION_PACKAGES)
  );
}
