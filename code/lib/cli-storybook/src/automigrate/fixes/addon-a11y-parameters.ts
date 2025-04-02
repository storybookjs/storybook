import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { commonGlobOptions, getProjectRoot } from 'storybook/internal/common';
import { writeConfig, writeCsf } from 'storybook/internal/csf-tools';

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
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

  check: async ({ mainConfig, previewConfigPath }) => {
    // Check if the a11y addon is installed
    const hasA11yAddon = mainConfig.addons?.some((addon) =>
      typeof addon === 'string'
        ? addon === '@storybook/addon-a11y'
        : addon.name === '@storybook/addon-a11y'
    );

    if (!hasA11yAddon) {
      return null;
    }

    const projectRoot = getProjectRoot();
    // eslint-disable-next-line depend/ban-dependencies
    const globby = (await import('globby')).globby;

    // Get story files from main config patterns
    const storyFiles = await globby([join(projectRoot, '**/*.stor(y|ies).@(js|jsx|mjs|ts|tsx)')], {
      ...commonGlobOptions(''),
      cwd: projectRoot,
      gitignore: true,
      absolute: true,
    });

    // Filter files that contain both 'a11y' and 'element' in their content
    const storyFilesWithA11y = (
      await Promise.all(
        storyFiles.map(async (file) => {
          const content = await readFile(file, 'utf-8');
          return content.includes('a11y') && content.includes('element') ? file : null;
        })
      )
    ).filter((file): file is string => file !== null);

    let hasA11yConfigInPreview = false;

    if (previewConfigPath) {
      const content = await readFile(previewConfigPath, 'utf-8');
      hasA11yConfigInPreview = content.includes('a11y') && content.includes('element');
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
      Found story or config files that may need to be updated.
      
      The a11y addon has changed removed the ${picocolors.yellow('element')} parameter and replaced it with the ${picocolors.yellow('context')} parameter:
      ${picocolors.yellow('parameters.a11y.element')} -> ${picocolors.yellow('parameters.a11y.context')}

      This change affects how accessibility checks are scoped in your stories and allows you to have more flexibility in defining the scope of your checks such as including or excluding multiple elements. We can update your code automatically.

      More info: ${picocolors.cyan('https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#a11y-addon-replace-element-parameter-with-context-parameter')}

      Would you like to update these files to use the new parameter name?
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
            await writeConfig(code);
          } catch (error) {
            errors.push({ file: previewFileToUpdate, error: error as Error });
          }
        } else {
          console.log('Would have updated', code.fileName);
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
                await writeCsf(code);
              } else {
                console.log('Would have updated', file);
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
