import type { Options, StorybookConfigRaw } from 'storybook/internal/types';

import { basename } from 'pathe';
import { dedent } from 'ts-dedent';

import { RN_FRAMEWORK_PACKAGE, RN_STORYBOOK_DIR } from '../../shared/constants/config-folder.ts';
import { frameworkPackages } from './framework.ts';
import { matchPackageName } from './match-package-name.ts';

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
 * extractFrameworkPackageName('/path/to/@storybook/angular'); // => '@storybook/angular'
 * extractFrameworkPackageName('@third-party/framework'); // => '@third-party/framework'
 * ```
 */
export const extractFrameworkPackageName = (framework: string) =>
  matchPackageName(framework, Object.keys(frameworkPackages)) ?? framework;

/**
 * Returns the framework package of a main config, or null when it has none.
 *
 * A React Native on-device config in `.rnstorybook` may omit `framework`; it resolves to
 * `@storybook/react-native`. Omit `configDir` to skip that folder fallback.
 */
export const getFrameworkPackageName = (
  mainConfig: StorybookConfigRaw | undefined,
  configDir?: string
) => {
  const framework =
    typeof mainConfig?.framework === 'string' ? mainConfig.framework : mainConfig?.framework?.name;

  if (framework) {
    return extractFrameworkPackageName(framework);
  }

  return configDir && basename(configDir) === RN_STORYBOOK_DIR ? RN_FRAMEWORK_PACKAGE : null;
};
