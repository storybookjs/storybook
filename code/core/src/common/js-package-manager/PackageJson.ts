import type { PackageJson } from 'storybook/internal/types';

export type PackageJsonWithDepsAndDevDeps = PackageJson &
  Required<Pick<PackageJson, 'dependencies' | 'devDependencies'>>;

export type PackageJsonWithMaybeDeps = Partial<
  Pick<PackageJson, 'dependencies' | 'devDependencies' | 'peerDependencies' | 'files'>
>;

export type { PackageJson };

/**
 * Returns the version of `packageName` bundled by the package installed under that name, read from
 * `bundledVersions` as Vite+ declares it when installed as `vite` or `vitest`.
 */
export function getBundledVersion(packageJson: PackageJson | null, packageName: string) {
  const version: unknown = packageJson?.bundledVersions?.[packageName];
  return typeof version === 'string' ? version : undefined;
}
