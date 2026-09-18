import { readFile, writeFile } from 'node:fs/promises';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';
import {
  ComponentSubtitleMigrationError,
  previewSubtitleInheritance,
  transformPreviewSource,
  transformStorySource,
} from './component-subtitle-transform.ts';

export { transformPreviewSource, transformStorySource } from './component-subtitle-transform.ts';

interface ComponentSubtitleOptions {
  files: string[];
  previewConfigPath?: string;
}

export const componentSubtitle: Fix<ComponentSubtitleOptions> = {
  id: 'component-subtitle',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#parameterscomponentsubtitle-removed',

  async check({ previewConfigPath, storiesPaths }) {
    const files = [...storiesPaths];
    if (previewConfigPath) {
      files.unshift(previewConfigPath);
    }
    const matchingFiles = (
      await Promise.all(
        files.map(async (file) => {
          try {
            const source = await readFile(file, 'utf-8');
            const transformed =
              file === previewConfigPath
                ? transformPreviewSource(source)
                : transformStorySource(source);
            return transformed ? file : null;
          } catch (error) {
            return error instanceof ComponentSubtitleMigrationError ? file : null;
          }
        })
      )
    ).filter((file): file is string => file !== null);
    return matchingFiles.length > 0 ? { files, previewConfigPath } : null;
  },

  prompt() {
    return `Move deprecated ${picocolors.cyan('parameters.componentSubtitle')} values to ${picocolors.cyan('parameters.docs.subtitle')}`;
  },

  async run({ dryRun, result }) {
    const transformedFiles: Array<{ file: string; source: string }> = [];
    const errors: Array<{ file: string; message: string }> = [];
    let inheritance = { subtitleCanWin: false, legacySubtitle: false };

    if (result.previewConfigPath) {
      try {
        inheritance = previewSubtitleInheritance(await readFile(result.previewConfigPath, 'utf-8'));
      } catch (error) {
        errors.push({
          file: result.previewConfigPath,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const file of result.files) {
      if (errors.some((entry) => entry.file === file)) {
        continue;
      }
      try {
        const source = await readFile(file, 'utf-8');
        const transformed =
          file === result.previewConfigPath
            ? transformPreviewSource(source)
            : transformStorySource(source, inheritance);
        if (transformed) {
          transformedFiles.push({ file, source: transformed });
        }
      } catch (error) {
        errors.push({ file, message: error instanceof Error ? error.message : String(error) });
      }
    }

    if (errors.length > 0) {
      throw new ComponentSubtitleMigrationError(
        `Could not migrate parameters.componentSubtitle automatically:\n${errors
          .map(({ file, message }) => `- ${file}: ${message}`)
          .join('\n')}\nMove each value to parameters.docs.subtitle manually.`
      );
    }

    if (!dryRun) {
      await Promise.all(transformedFiles.map(({ file, source }) => writeFile(file, source)));
    }
  },
};
