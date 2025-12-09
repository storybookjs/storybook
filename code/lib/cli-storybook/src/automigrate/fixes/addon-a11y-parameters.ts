import { readFile } from 'node:fs/promises';

import { writeConfig, writeCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import {
  transformPreviewA11yParameters,
  transformStoryA11yParameters,
} from '../helpers/addon-a11y-parameters';
import type { Fix, RunOptions } from '../types';

interface A11yOptions {
  storyFilesToUpdate: string[];
  previewFileToUpdate: string | undefined;
}

export const addonA11yParameters: Fix<A11yOptions> = {
  id: 'addon-a11y-parameters',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#a11y-addon-replace-element-parameter-with-context-parameter',

  check: async ({ mainConfig, previewConfigPath, storiesPaths }) => {
    // Check if the a11y addon is installed
    const hasA11yAddon = mainConfig.addons?.some((addon) =>
      typeof addon === 'string'
        ? addon === '@storybook/addon-a11y'
        : addon.name === '@storybook/addon-a11y'
    );

    if (!hasA11yAddon) {
      return null;
    }

    const maybeHasA11yParameter = (content: string) =>
      content.includes('a11y:') && content.includes('element:');

    // Filter files that contain both 'a11y' and 'element' in their content
    const storyFilesWithA11y = (
      await Promise.all(
        storiesPaths.map(async (file) => {
          const content = await readFile(file, 'utf-8');
          return maybeHasA11yParameter(content) ? file : null;
        })
      )
    ).filter((file): file is string => file !== null);

    let hasA11yConfigInPreview = false;

    if (previewConfigPath) {
      const content = await readFile(previewConfigPath, 'utf-8');
      hasA11yConfigInPreview = maybeHasA11yParameter(content);
    }

    if (storyFilesWithA11y.length === 0 && !hasA11yConfigInPreview) {
      return null;
    }

    return {
      storyFilesToUpdate: storyFilesWithA11y,
      previewFileToUpdate: hasA11yConfigInPreview ? previewConfigPath : undefined,
    };
  },

  prompt: () => {
    return dedent`
      The a11y addon has replaced ${picocolors.yellow('parameters.a11y.element')} with ${picocolors.yellow('parameters.a11y.context')} for more flexible accessibility check scoping.
    `;
  },

  run: async (options: RunOptions<A11yOptions>) => {
    const { result, dryRun = false } = options;
    const { storyFilesToUpdate, previewFileToUpdate } = result;
    const errors: Array<{ file: string; error: Error }> = [];

    if (previewFileToUpdate) {
      const content = await readFile(previewFileToUpdate, 'utf-8');
      const code = transformPreviewA11yParameters(content);

      if (code) {
        if (!dryRun) {
          try {
            await writeConfig(code, previewFileToUpdate);
          } catch (error) {
            errors.push({ file: previewFileToUpdate, error: error as Error });
          }
        } else {
          logger.log(`Would have updated ${code.fileName}`);
        }
      }
    }

    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(10);

    await Promise.all(
      storyFilesToUpdate.map((file) =>
        limit(async () => {
          try {
            const content = await readFile(file, 'utf-8');
            const code = transformStoryA11yParameters(content);

            if (code) {
              if (!dryRun) {
                await writeCsf(code, file);
              } else {
                logger.log(`Would have updated ${file}`);
              }
            }
          } catch (error) {
            errors.push({ file, error: error as Error });
          }
        })
      )
    );

    if (errors.length > 0) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        `Failed to process ${errors.length} files:\n${errors
          .map(({ file, error }) => `- ${file}: ${error.message}`)
          .join('\n')}`
      );
    }
  },
} as const;
