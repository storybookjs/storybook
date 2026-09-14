import { Tag } from 'storybook/internal/core-server';
import { types as t } from 'storybook/internal/babel';
import { HandledError } from 'storybook/internal/common';
import { readConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import { assertConfigMutationSuccess } from '../helpers/config-object.ts';

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
      const value = config.get(['docs', 'autodocs']);
      assertConfigMutationSuccess(config);
      const autodocs = t.isBooleanLiteral(value)
        ? value.value
        : t.isStringLiteral(value, { value: 'tag' })
          ? 'tag'
          : undefined;

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
      main.remove(['docs', 'autodocs']);
    });

    // If autodocs was true, update preview config to use tags
    if (autodocs === true && previewConfigPath) {
      logger.log(`🔄 Updating ${picocolors.cyan('tags')} parameter in preview config file...`);
      await updateMainConfig(
        { mainConfigPath: previewConfigPath, dryRun: !!dryRun },
        async (preview) => {
          const tags = preview.get(['tags']);
          if (!tags) {
            preview.set(['tags'], [Tag.AUTODOCS]);
          } else if (!t.isArrayExpression(tags)) {
            throw new HandledError(
              'Cannot add the autodocs tag because tags is not a static array'
            );
          } else if (
            !tags.elements.some((tag) => t.isStringLiteral(tag, { value: Tag.AUTODOCS }))
          ) {
            preview.transform(['tags'], (value) =>
              t.isArrayExpression(value)
                ? t.arrayExpression([...value.elements, t.stringLiteral(Tag.AUTODOCS)])
                : undefined
            );
          }
        }
      );
    }
  },
};
