import type { Options } from '@storybook/core/types';

import { dedent } from 'ts-dedent';

import { frameworkPackages } from './get-storybook-info';
import { normalizePath } from './normalize-path';

/** Framework can be a string or an object. This utility always returns the string name. */
export async function getFrameworkName(options: Options) {
  const framework = await options.presets.apply('framework', '', options);

  if (!framework) {
    throw new Error(dedent`
      You must specify a framework in '.storybook/main.js' config.

      https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#framework-field-mandatory
    `);
  }

  return typeof framework === 'object' ? framework.name : framework;
}

/**
 * Extracts the proper framework name from the given framework field. The framework field can be the
 * framework package name or a path to the framework package.
 *
 * @example
 *
 * ```ts
 * ExtractProperFrameworkName('/path/to/@storybook/angular'); // => '@storybook/angular'
 * extractProperFrameworkName('@third-party/framework'); // => '@third-party/framework'
 * ```
 */
export const extractProperFrameworkName = (framework: string) => {
  const normalizedPath = normalizePath(framework);
  const frameworkName = Object.keys(frameworkPackages).find((pkg) => normalizedPath.endsWith(pkg));

  return frameworkName ?? framework;
};
