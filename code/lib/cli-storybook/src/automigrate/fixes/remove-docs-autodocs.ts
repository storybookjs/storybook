import { loadConfig, writeConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

const logger = {
  log: (message: string) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(message);
    }
  },
};

interface RemoveDocsAutodocsOptions {
  autodocs: boolean | 'tag' | undefined;
}

/**
 * Migration to remove the docs.autodocs field from main.ts config This field was deprecated in
 * Storybook 7-8 and removed in Storybook 9
 */
export const removeDocsAutodocs: Fix<RemoveDocsAutodocsOptions> = {
  id: 'remove-docs-autodocs',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

  async check({ mainConfigPath }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      const config = loadConfig(mainConfigPath).parse();
      const autodocs = config.getSafeFieldValue(['docs', 'autodocs']);

      if (autodocs === undefined) {
        return null;
      }

      return {
        autodocs,
      };
    } catch (err) {
      return null;
    }
  },

  prompt: () => {
    return dedent`
      The \`docs.autodocs\` field in Storybook's main configuration has been removed in Storybook 9.
      This field was deprecated in Storybook 7-8 and is no longer supported.
      
      We can make the necessary changes in your configuration automatically.
      
      More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mainjs-docsautodocs-is-deprecated
    `;
  },

  async run({ result, dryRun, mainConfigPath, previewConfigPath }) {
    const { autodocs } = result;

    // Remove autodocs from main config
    logger.log(`🔄 Updating ${picocolors.cyan('docs')} parameter in main config file...`);
    if (!dryRun) {
      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
        const docs = main.getFieldValue(['docs']) || {};
        delete docs.autodocs;

        // If docs object is now empty, remove it entirely
        if (Object.keys(docs).length === 0) {
          main.removeField(['docs']);
        } else {
          main.setFieldValue(['docs'], docs);
        }
      });
    }

    // If autodocs was true, update preview config to use tags
    if (autodocs === true && previewConfigPath) {
      const previewConfig = loadConfig(previewConfigPath).parse();
      const tags = previewConfig.getFieldValue(['tags']) || [];

      if (!tags.includes('autodocs')) {
        logger.log(`🔄 Updating ${picocolors.cyan('tags')} parameter in preview config file...`);
        if (!dryRun) {
          previewConfig.setFieldValue(['tags'], [...tags, 'autodocs']);
          await writeConfig(previewConfig);
        }
      }
    }
  },
};
