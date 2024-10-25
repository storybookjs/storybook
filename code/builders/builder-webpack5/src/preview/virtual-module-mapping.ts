import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getBuilderOptions,
  loadPreviewOrConfigFile,
  normalizeStories,
  readTemplate,
} from 'storybook/internal/common';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import { toImportFn } from '@storybook/core-webpack';

import slash from 'slash';

import type { BuilderOptions } from '../types';

export const getVirtualModules = async (options: Options) => {
  const virtualModules: Record<string, string> = {};
  const builderOptions = await getBuilderOptions<BuilderOptions>(options);
  const workingDir = process.cwd();
  const isProd = options.configType === 'PRODUCTION';
  const nonNormalizedStories = await options.presets.apply('stories', []);
  const entries = [];

  const stories = normalizeStories(nonNormalizedStories, {
    configDir: options.configDir,
    workingDir,
  });

  const previewAnnotations = [
    ...(await options.presets.apply<PreviewAnnotation[]>('previewAnnotations', [], options)).map(
      (entry) => slash(entry)
    ),
    loadPreviewOrConfigFile(options),
  ].filter(Boolean);

  const storiesFilename = 'storybook-stories.js';
  const storiesPath = resolve(join(workingDir, storiesFilename));

  const needPipelinedImport = !!builderOptions.lazyCompilation && !isProd;
  virtualModules[storiesPath] = toImportFn(stories, { needPipelinedImport });
  const configEntryPath = resolve(join(workingDir, 'storybook-config-entry.js'));
  virtualModules[configEntryPath] = (
    await readTemplate(
      fileURLToPath(
        import.meta.resolve('@storybook/builder-webpack5/templates/virtualModuleModernEntry.js')
      )
    )
  )
    .replaceAll(`'{{storiesFilename}}'`, `'./${storiesFilename}'`)
    .replaceAll(
      `'{{previewAnnotations}}'`,
      previewAnnotations
        .filter(Boolean)
        .map((entry) => `'${entry}'`)
        .join(',')
    )
    .replaceAll(
      `'{{previewAnnotations_requires}}'`,
      previewAnnotations
        .filter(Boolean)
        .map((entry) => `require('${entry}')`)
        .join(',')
    )
    // We need to double escape `\` for webpack. We may have some in windows paths
    .replace(/\\/g, '\\\\');
  entries.push(configEntryPath);

  return {
    virtualModules,
    entries,
  };
};
