import type { StorybookConfig } from '../../instance/addons.ts';

import { frameworkPackages } from './get-storybook-info.ts';
import { normalizePath } from './normalize-path.ts';

/** Read the package name or path from a configured framework. */
export function getFrameworkNameFromConfig(
  framework: StorybookConfig['framework']
): string | undefined {
  return typeof framework === 'string'
    ? framework
    : framework && 'meta' in framework
      ? framework.meta.name
      : framework?.name;
}

/**
 * Extracts the proper framework name from the given framework field. The framework field can be the
 * framework package name or a path to the framework package.
 *
 * @example
 *
 * ```ts
 * extractFrameworkPackageName('/path/to/@storybook/angular'); // => '@storybook/angular'
 * extractFrameworkPackageName('@third-party/framework'); // => '@third-party/framework'
 * ```
 */
export const extractFrameworkPackageName = (framework: string) => {
  const normalizedPath = normalizePath(framework);
  const frameworkName = Object.keys(frameworkPackages).find(
    (pkg) =>
      normalizedPath.endsWith(pkg) ||
      // pnpm virtual-store dirs encode the scope slash as '+' and append '@<version>',
      // e.g. .../node_modules/.pnpm/@storybook+react-vite@9.0.0 — the trailing '@' keeps
      // '@storybook/react' from matching '@storybook+react-vite@...'.
      normalizedPath.includes(`/.pnpm/${pkg.replace('/', '+')}@`)
  );

  return frameworkName ?? framework;
};
