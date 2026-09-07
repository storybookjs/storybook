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

import semver from 'semver';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';
import webpackModule from 'webpack';

import type { BuilderOptions } from '../types.ts';

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
        if (typeof entry === 'object') {
          return entry.absolute;
        }

        return slash(entry);
      }
    ),
    loadPreviewOrConfigFile(options),
  ].filter(Boolean);

  const storiesFilename = 'storybook-stories.js';
  const storiesPath = resolve(join(workingDir, storiesFilename));

  // The import pipeline is a workaround for a webpack lazy-compilation bug that was fixed in
  // webpack 5.101.3 (https://github.com/webpack/webpack/issues/15541#issuecomment-1143138832).
  // We only enable it for lazy compilation in dev mode on older webpack versions.
  // If the webpack version cannot be parsed, we conservatively disable the pipeline since
  // the bug is fixed in newer versions and we prefer to avoid unnecessary performance overhead.
  const webpackVersion = webpackModule.version ? semver.coerce(webpackModule.version) : null;
  const needPipelinedImport =
    !!builderOptions.lazyCompilation &&
    !isProd &&
    !!webpackVersion &&
    semver.lt(webpackVersion, '5.101.3');
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
