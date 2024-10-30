import { readConfig, writeConfig } from 'storybook/internal/csf-tools';
import type { DocsOptions } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

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

export const autodocsTags: Fix<Options> = {
  id: 'autodocs-tags',
  versionRange: ['*.*.*', '>=8.0.*'],
  async check({ mainConfig, mainConfigPath, previewConfigPath }) {
    const autodocs = mainConfig?.docs?.autodocs;

    if (autodocs === undefined) {
      return null;
    }

    if (autodocs === true && !previewConfigPath) {
      throw Error(dedent`
        ❌ Failed to remove the deprecated ${picocolors.cyan(
          'docs.autodocs'
        )} setting from ${picocolors.cyan(mainConfigPath)}.
        
        There is no preview config file in which to add the ${picocolors.cyan('autodocs')} tag.

        Please perform the migration by hand: ${picocolors.yellow(MIGRATION)}
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


        There is no ${picocolors.cyan('docs.autodocs = false')} equivalent.
        You'll need to check your stories to ensure none are tagged with ${picocolors.cyan(
          'autodocs'
        )}.
      `;
    } else if (autodocs === true) {
      trueMessage = ` and update ${picocolors.cyan(previewConfigPath)}`;
    }

    return dedent`
      The ${picocolors.cyan('docs.autodocs')} setting in ${picocolors.cyan(
        mainConfigPath
      )} is deprecated.${falseMessage}
        
      Learn more: ${picocolors.yellow(MIGRATION)}
      
      Remove ${picocolors.cyan('docs.autodocs')}${trueMessage}?
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
