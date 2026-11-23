import { normalizePath } from './normalize-path.ts';

/**
 * Finds which of the given package names a package name or a resolved package path refers to.
 *
 * @example
 *
 * ```ts
 * matchPackageName('/path/to/@storybook/angular', ['@storybook/angular']); // => '@storybook/angular'
 * matchPackageName('@third-party/framework', ['@storybook/angular']); // => undefined
 * ```
 */
export const matchPackageName = (nameOrPath: string, packageNames: string[]) => {
  const normalizedPath = normalizePath(nameOrPath);
  return packageNames.find(
    (pkg) =>
      normalizedPath === pkg ||
      normalizedPath.endsWith(`/${pkg}`) ||
      // pnpm virtual-store dirs encode the scope slash as '+' and append '@<version>',
      // e.g. .../node_modules/.pnpm/@storybook+react-vite@9.0.0 — the trailing '@' keeps
      // '@storybook/react' from matching '@storybook+react-vite@...'.
      normalizedPath.includes(`/.pnpm/${pkg.replace('/', '+')}@`)
  );
};
