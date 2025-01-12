import type { PackageJson } from '@storybook/core/types';

export function getChromaticVersionSpecifier(packageJson: PackageJson) {
  const dependency =
    packageJson.dependencies?.chromatic ||
    packageJson.devDependencies?.chromatic ||
    packageJson.peerDependencies?.chromatic;

  if (dependency) {
    return dependency;
  }

  // Chromatic isn't necessarily installed in dependencies, it can be run from npx

  // Chromatic isn't necessarily installed in dependencies, it can be run from npx
  return packageJson.scripts &&
    Object.values(packageJson.scripts).find((s) => s?.match(/chromatic/))
    ? 'latest'
    : undefined;
}
