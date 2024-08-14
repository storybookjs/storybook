import { join } from 'node:path';

import { getStorybookVersionSpecifier } from 'storybook/internal/cli';
import { commonGlobOptions } from 'storybook/internal/common';

import slash from 'slash';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

const logger = console;

interface Options {
  value?: boolean;
}

/**
 */
export const mdxgfm: Fix<Options> = {
  id: 'github-flavored-markdown-mdx',

  versionRange: ['<7', '>=7'],

  async check({ configDir, mainConfig }) {
    const hasMDXFiles = await mainConfig?.stories?.reduce(async (acc, item) => {
      const val = await acc;

      if (val === true) {
        return true;
      }

      let pattern;

      if (typeof configDir === 'undefined') {
        return false;
      }

      if (typeof item === 'string') {
        pattern = slash(join(configDir, item));
      } else if (typeof item === 'object') {
        const directory = item.directory || '..';
        const files = item.files || '**/*.@(mdx|stories.@(mdx|js|jsx|mjs|ts|tsx))';
        pattern = slash(join(configDir, directory, files));
      }

      if (!pattern) {
        return false;
      }

      // Dynamically import globby because it is a pure ESM module
      const { globby } = await import('globby');

      const files = await globby(pattern, commonGlobOptions(pattern));

      return files.some((f) => f.endsWith('.mdx'));
    }, Promise.resolve(false));

    // @ts-expect-error (user might be upgrading from an older version that still had it)
    const usesMDX1 = mainConfig?.features?.legacyMdx1 === true || false;
    const skip =
      usesMDX1 ||
      !hasMDXFiles ||
      !!mainConfig.addons?.find((item) => {
        if (item === '@storybook/addon-mdx-gfm') {
          return true;
        }
        if (typeof item === 'string') {
          return false;
        }
        if (item.name === '@storybook/addon-docs') {
          return item.options?.mdxPluginOptions?.mdxCompileOptions?.remarkPlugins?.length > 0;
        }
        return false;
      });

    if (skip) {
      return null;
    }

    return {};
  },

  prompt() {
    return dedent`
      In MDX1 you had the option of using GitHub flavored markdown.

      Storybook >= 8.0 uses MDX3 for compiling MDX, and thus no longer supports GFM out of the box.
      Because of this you need to explicitly add the GFM plugin in the addon-docs options:
      https://storybook.js.org/docs/writing-docs/mdx#markdown-tables-arent-rendering-correctly

      We recommend that you follow the guide in the link above; however, we can add a temporary Storybook addon to help make this migration easier.
      We'll install the addon and add it to your storybook config.
    `;
  },

  async run({ packageManager, dryRun, mainConfigPath, skipInstall }) {
    if (!dryRun) {
      const packageJson = await packageManager.retrievePackageJson();
      const versionToInstall = getStorybookVersionSpecifier(
        await packageManager.retrievePackageJson()
      );
      await packageManager.addDependencies(
        { installAsDevDependencies: true, skipInstall, packageJson },
        [`@storybook/addon-mdx-gfm@${versionToInstall}`]
      );

      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
        logger.info(`✅ Adding "@storybook/addon-mdx-gfm" addon`);
        if (!dryRun) {
          main.appendValueToArray(['addons'], '@storybook/addon-mdx-gfm');
        }
      });
    }
  },
};
