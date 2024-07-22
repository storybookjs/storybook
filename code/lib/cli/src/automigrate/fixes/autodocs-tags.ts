import { dedent } from 'ts-dedent';
import chalk from 'chalk';
import type { DocsOptions } from '@storybook/core/types';
import { readConfig, writeConfig } from '@storybook/core/csf-tools';
import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

const logger = console;

const MIGRATION =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mainjs-docsautodocs-is-deprecated';

interface Options {
  autodocs: DocsOptions['autodocs'];
  mainConfigPath?: string;
  previewConfigPath?: string;
}

/**
 */
export const autodocsTags: Fix<Options> = {
  id: 'autodocs-tags',
  versionRange: ['*.*.*', '>=8.0.*'],
  async check({ mainConfig, mainConfigPath, previewConfigPath }) {
    const autodocs = mainConfig?.docs?.autodocs;
    if (autodocs === undefined) return null;

    if (autodocs === true && !previewConfigPath) {
      throw Error(dedent`
        ❌ Failed to remove the deprecated ${chalk.cyan('docs.autodocs')} setting from ${chalk.cyan(
          mainConfigPath
        )}.

        There is no preview config file in which to add the ${chalk.cyan('autodocs')} tag.

        Please perform the migration by hand: ${chalk.yellow(MIGRATION)}
      `);
      return null;
    }

    return { autodocs, mainConfigPath, previewConfigPath };
  },

  prompt({ autodocs, mainConfigPath, previewConfigPath }) {
    let falseMessage = '',
      trueMessage = '';

    if (autodocs === false) {
      falseMessage = dedent`


        There is no ${chalk.cyan('docs.autodocs = false')} equivalent.
        You'll need to check your stories to ensure none are tagged with ${chalk.cyan('autodocs')}.
      `;
    } else if (autodocs === true) {
      trueMessage = ` and update ${chalk.cyan(previewConfigPath)}`;
    }

    return dedent`
      The ${chalk.cyan('docs.autodocs')} setting in ${chalk.cyan(
        mainConfigPath
      )} is deprecated.${falseMessage}
  
      Learn more: ${chalk.yellow(MIGRATION)}

      Remove ${chalk.cyan('docs.autodocs')}${trueMessage}?
    `;
  },

  async run({ dryRun, mainConfigPath, result }) {
    if (!dryRun) {
      if (result.autodocs === true) {
        logger.info(`✅ Adding "autodocs" tag to ${result.previewConfigPath}`);
        const previewConfig = await readConfig(result.previewConfigPath!);
        const tags = previewConfig.getFieldNode(['tags']);
        if (tags) {
          previewConfig.appendValueToArray(['tags'], 'autodocs');
        } else {
          previewConfig.setFieldValue(['tags'], ['autodocs']);
        }
        await writeConfig(previewConfig);
      }

      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
        logger.info(`✅ Removing "docs.autodocs" from ${mainConfigPath}`);
        main.removeField(['docs', 'autodocs']);
      });
    }
  },
};
