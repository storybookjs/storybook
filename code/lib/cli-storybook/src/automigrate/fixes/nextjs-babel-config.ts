import { findBabelConfigFile, getProjectRoot } from 'storybook/internal/common';

import { basename, dirname } from 'pathe';
import { dedent } from 'ts-dedent';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary, isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

export const nextjsBabelConfig: Fix<{ babelConfigFile: string }> = {
  id: 'nextjs-babel-config',
  promptType: 'notification',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nextjs-storybooknextjs-always-compiles-with-swc',

  async check({ mainConfig, beforeVersion, storybookVersion, requested }) {
    if (
      getFrameworkPackageName(mainConfig) !== '@storybook/nextjs' ||
      !isAtOrPastVersion(storybookVersion, '11.0.0')
    ) {
      return null;
    }
    // Report once, on the upgrade to 11. The framework warns on every start after that.
    if (
      !requested &&
      !(beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, '11.0.0'))
    ) {
      return null;
    }
    // The folder @storybook/nextjs loads next.config from.
    const nextConfigPath: string | undefined =
      typeof mainConfig.framework === 'string'
        ? undefined
        : mainConfig.framework?.options?.nextConfigPath;
    const babelConfigFile = findBabelConfigFile(
      nextConfigPath ? dirname(nextConfigPath) : getProjectRoot()
    );
    return babelConfigFile ? { babelConfigFile } : null;
  },

  prompt(result) {
    return dedent`
      @storybook/nextjs now always compiles with SWC and ignores your Babel config${result ? ` (${basename(result.babelConfigFile)})` : ''}, so its plugins no longer run in Storybook.

      Plugins with a next.config.js equivalent keep working: styled-components, emotion, relay, removeConsole and reactRemoveProperties through \`compiler\`, others through \`experimental.swcPlugins\`. Run any other plugin with a \`babel-loader\` rule in \`webpackFinal\`. Set \`experimental.forceSwcTransforms: true\` to hide Storybook's warning about the ignored config.
    `;
  },
};
