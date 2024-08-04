import type { Options, PreviewAnnotation } from 'storybook/internal/types';
import { join, resolve } from 'path';
import {
  getBuilderOptions,
  handlebars,
  loadPreviewOrConfigFile,
  normalizeStories,
  readTemplate,
} from 'storybook/internal/common';
import slash from 'slash';
import { toImportFn } from '@storybook/core-webpack';
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
      (entry) => {
        // If entry is an object, use the absolute import specifier.
        // This is to maintain back-compat with community addons that bundle other addons
        // and package managers that "hide" sub dependencies (e.g. pnpm / yarn pnp)
        // The vite builder uses the bare import specifier.
        if (typeof entry === 'object') {
          return entry.absolute;
        }

        return slash(entry);
      }
    ),
    await loadPreviewOrConfigFile(options),
  ].filter(Boolean);

  const storiesFilename = 'storybook-stories.js';
  const storiesPath = resolve(join(workingDir, storiesFilename));

  const needPipelinedImport = !!builderOptions.lazyCompilation && !isProd;
  virtualModules[storiesPath] = toImportFn(stories, { needPipelinedImport });
  const configEntryPath = resolve(join(workingDir, 'storybook-config-entry.js'));
  virtualModules[configEntryPath] = handlebars(
    await readTemplate(
      require.resolve(
        '@storybook/builder-webpack5/templates/virtualModuleModernEntry.js.handlebars'
      )
    ),
    {
      storiesFilename,
      previewAnnotations,
    }
    // We need to double escape `\` for webpack. We may have some in windows paths
  ).replace(/\\/g, '\\\\');
  entries.push(configEntryPath);

  return {
    virtualModules,
    entries,
  };
};
