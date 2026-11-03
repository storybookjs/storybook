import { PackageManagerName } from '../js-package-manager/JsPackageManager.ts';
import { JsPackageManagerFactory } from '../js-package-manager/JsPackageManagerFactory.ts';

/**
 * Packages that only the deprecated builder docgen (`features.docgenServer: false`) uses, with the
 * version range to install. The React packages declare them as optional peer dependencies, so
 * projects on the docgen server do not install them.
 *
 * Each range must equal the peer dependency range in the package.json files of
 * `@storybook/react`, `@storybook/react-vite` and `@storybook/preset-react-webpack`, which a test
 * checks.
 */
export const BUILDER_DOCGEN_PACKAGES = {
  'react-docgen': '^8.0.2',
  'react-docgen-typescript': '^2.2.2',
  '@joshwooding/vite-plugin-react-docgen-typescript': '^0.7.0',
  '@storybook/react-docgen-typescript-plugin': '1.0.6--canary.9.0c3f3b7.0',
} as const;

export type BuilderDocgenPackage = keyof typeof BUILDER_DOCGEN_PACKAGES;

/** The `typescript.reactDocgen` main config option. */
export type ReactDocgenOption = 'react-docgen' | 'react-docgen-typescript' | false;

/**
 * Return the packages that React builder docgen needs for a `typescript.reactDocgen` value.
 *
 * `react-docgen-typescript` mode needs the builder plugin and `react-docgen-typescript` itself,
 * which `@storybook/react` loads for the components manifest. In that mode the `react-docgen` pass
 * over JavaScript files is skipped when `react-docgen` is not installed.
 */
export function getReactBuilderDocgenPackages(
  reactDocgen: ReactDocgenOption | undefined,
  builder: 'vite' | 'webpack'
): BuilderDocgenPackage[] {
  if (reactDocgen === 'react-docgen') {
    return ['react-docgen'];
  }
  if (reactDocgen === 'react-docgen-typescript') {
    return [
      builder === 'vite'
        ? '@joshwooding/vite-plugin-react-docgen-typescript'
        : '@storybook/react-docgen-typescript-plugin',
      'react-docgen-typescript',
    ];
  }
  return [];
}

/**
 * Return whether a package resolves.
 *
 * `resolve` must resolve from the package that declares the optional peer dependency, for example
 * `(specifier) => import.meta.resolve(specifier)`, because strict package managers only expose a
 * peer to the packages that declare it.
 */
export function isPackageResolvable(resolve: (specifier: string) => string, packageName: string) {
  try {
    resolve(packageName);
    return true;
  } catch {
    return false;
  }
}

/** Return whether an import failed because a module or package could not be found. */
export const isModuleNotFoundError = (error: unknown) =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND');

const ADD_DEV_DEPENDENCY_COMMANDS: Record<PackageManagerName, string> = {
  [PackageManagerName.NPM]: 'npm install -D',
  [PackageManagerName.YARN1]: 'yarn add -D',
  [PackageManagerName.YARN2]: 'yarn add -D',
  [PackageManagerName.PNPM]: 'pnpm add -D',
  [PackageManagerName.BUN]: 'bun add -D',
};

const detectPackageManager = () => {
  try {
    return JsPackageManagerFactory.getPackageManagerType();
  } catch {
    // Fall back to npm, which every Node.js installation ships with.
    return PackageManagerName.NPM;
  }
};

/** Return `name@range` for each package, as `addDependencies` and install commands take them. */
export const getBuilderDocgenPackageSpecifiers = (packages: readonly BuilderDocgenPackage[]) =>
  packages.map((name) => `${name}@${BUILDER_DOCGEN_PACKAGES[name]}`);

/**
 * Return the command that adds builder docgen packages to the project's devDependencies.
 *
 * Specifiers with a range character such as `^` are quoted, so the command works in every shell.
 */
export function getAddBuilderDocgenPackagesCommand(
  packages: readonly BuilderDocgenPackage[],
  packageManager = detectPackageManager()
) {
  const specifiers = getBuilderDocgenPackageSpecifiers(packages).map((specifier) =>
    /^[\w@/.-]+$/.test(specifier) ? specifier : `"${specifier}"`
  );
  return [ADD_DEV_DEPENDENCY_COMMANDS[packageManager], ...specifiers].join(' ');
}
