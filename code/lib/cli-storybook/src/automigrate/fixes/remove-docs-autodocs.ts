import { readConfig } from 'storybook/internal/csf-tools';
import { Tag } from 'storybook/internal/core-server';

import picocolors from 'picocolors';

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
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mainjs-docsautodocs-is-deprecated',

  async check({ mainConfigPath }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      const config = await readConfig(mainConfigPath);
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
    return `${picocolors.cyan('docs.autodocs')} has been removed in Storybook 9 and will be removed from your configuration.`;
  },

  async run({ result, dryRun, mainConfigPath, previewConfigPath }) {
    const { autodocs } = result;

    // Remove autodocs from main config
    logger.log(`🔄 Updating ${picocolors.cyan('docs')} parameter in main config file...`);
    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
      const docs = main.getFieldValue(['docs']) || {};

      if (!dryRun) {
        delete docs.autodocs;

        // If docs object is now empty, remove it entirely
        if (Object.keys(docs).length === 0) {
          main.removeField(['docs']);
        } else {
          main.setFieldValue(['docs'], docs);
        }
      }
    });

    // If autodocs was true, update preview config to use tags
    if (autodocs === true && previewConfigPath) {
      logger.log(`🔄 Updating ${picocolors.cyan('tags')} parameter in preview config file...`);
      await updateMainConfig(
        { mainConfigPath: previewConfigPath, dryRun: !!dryRun },
        async (preview) => {
          const tags = preview.getFieldValue(['tags']) || [];

          if (!tags.includes(Tag.AUTODOCS) && !dryRun) {
            preview.setFieldValue(['tags'], [...tags, Tag.AUTODOCS]);
          }
        }
      );
    }
  },
};
