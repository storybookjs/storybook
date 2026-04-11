import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { isPreservingSymlinks, loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import { babelParser, extractMockCalls, findMockRedirect } from 'storybook/internal/mocking-utils';
import { globalsNameReferenceMap } from 'storybook/internal/preview/globals';
import type {
  Builder_EnvsRaw,
  Options,
  PreviewAnnotation,
  StoryIndex,
} from 'storybook/internal/types';

import * as pkg from 'empathic/package';
import { dirname, join, resolve } from 'pathe';
import type { Alias, EnvironmentOptions } from 'vite';

import { stringifyProcessEnvs } from '../../builder-vite/src/envs';
import {
  escapeGlobPath,
  getMockRedirectIncludeEntries,
} from '../../builder-vite/src/plugins/storybook-optimize-deps-plugin';
import { processPreviewAnnotation } from '../../builder-vite/src/utils/process-preview-annotation';
import { getUniqueImportPaths } from '../../builder-vite/src/utils/unique-import-paths';

export interface StorybookEnvOptionsInput {
  options: Options;
  configDir: string;
  envPrefix: readonly string[];
}

/**
 * Precomputes the storybook-specific slice of Vite's `EnvironmentOptions` so that the main plugin
 * can return it from its `configEnvironment('storybook')` hook.
 *
 * Historically the same pieces lived as top-level `config` hooks on each preview plugin (aliases,
 * optimizeDeps, define, etc.) — but since top-level hooks fire on every environment, those
 * configurations leaked into the user's own app. Lifting them here and returning them through
 * `configEnvironment('storybook')` scopes them strictly to the storybook environment.
 *
 * Writes the external-globals alias cache files as a side effect — same as the legacy
 * `storybookExternalGlobalsPlugin`.
 */
export async function computeStorybookEnvOptions({
  options,
  configDir,
  envPrefix,
}: StorybookEnvOptionsInput): Promise<Partial<EnvironmentOptions>> {
  const projectRoot = resolve(configDir, '..');

  const [aliases, defineRecord, optimizeDeps] = await Promise.all([
    computeExternalGlobalsAliases(options),
    computeDefine(options, envPrefix),
    computeOptimizeDeps(options, projectRoot),
  ]);

  return {
    resolve: {
      conditions: ['storybook', 'stories', 'test'],
      preserveSymlinks: isPreservingSymlinks(),
      alias: aliases,
    },
    define: defineRecord,
    optimizeDeps,
  };
}

/**
 * Replicates `storybookExternalGlobalsPlugin`'s cache-writing + alias map. Each storybook module
 * (e.g. `storybook/preview-api`) is aliased to a small cache file that re-exports the module from
 * a runtime-injected global, so the real module never ends up in the bundle.
 */
async function computeExternalGlobalsAliases(options: Options): Promise<Alias[]> {
  const build = await options.presets.apply('build');

  const externals: typeof globalsNameReferenceMap & Record<string, string> = {
    ...globalsNameReferenceMap,
  };

  if (build?.test?.disableBlocks) {
    externals['@storybook/addon-docs/blocks'] = '__STORYBOOK_BLOCKS_EMPTY_MODULE__';
  }

  const cachePath =
    pkg.cache('sb-vite-plugin-externals', { create: true }) ??
    join(process.cwd(), 'node_modules', '.cache', 'sb-vite-plugin-externals');

  const aliases: Alias[] = [];
  await Promise.all(
    (Object.keys(externals) as Array<keyof typeof externals>).map(async (externalKey) => {
      const externalCachePath = join(cachePath, `${externalKey}.js`);
      aliases.push({
        find: new RegExp(`^${externalKey}$`),
        replacement: externalCachePath,
      });
      if (!existsSync(externalCachePath)) {
        await mkdir(dirname(externalCachePath), { recursive: true });
      }
      await writeFile(externalCachePath, `module.exports = ${externals[externalKey]};`);
    })
  );

  return aliases;
}

/**
 * Replicates `storybookSanitizeEnvs`'s `define` output — exposes storybook env vars through
 * `import.meta.env.*`, scoped to the storybook environment only.
 */
async function computeDefine(
  options: Options,
  envPrefix: readonly string[]
): Promise<Record<string, string>> {
  const envs = await options.presets.apply<Builder_EnvsRaw>('env');
  if (!envs || Object.keys(envs).length === 0) {
    return {};
  }
  return stringifyProcessEnvs(envs, envPrefix as string[]);
}

/**
 * Replicates `storybookOptimizeDepsPlugin`'s `optimizeDeps` config. The legacy plugin was
 * registered at top level, which in Vite 6+ caused the optimizer config to apply to the client
 * environment instead of the storybook environment — silently broken. Returning it from
 * `configEnvironment('storybook')` puts it on the right environment.
 */
async function computeOptimizeDeps(
  options: Options,
  projectRoot: string
): Promise<EnvironmentOptions['optimizeDeps']> {
  const [extraOptimizeDeps, storyIndexGenerator, previewAnnotations] = await Promise.all([
    options.presets.apply<string[]>('optimizeViteDeps', []),
    options.presets.apply<StoryIndexGenerator>('storyIndexGenerator'),
    options.presets.apply<PreviewAnnotation[]>('previewAnnotations', [], options),
  ]);

  const index: StoryIndex = await storyIndexGenerator.getIndex();

  const previewOrConfigFile = loadPreviewOrConfigFile({ configDir: options.configDir });

  const mockRedirectIncludeEntries = previewOrConfigFile
    ? getMockRedirectIncludeEntries(
        extractMockCalls(
          {
            previewConfigPath: previewOrConfigFile,
            coreOptions: { disableTelemetry: true },
            configDir: options.configDir,
          },
          babelParser,
          projectRoot,
          findMockRedirect
        )
      )
    : [];

  const previewAnnotationEntries = [...previewAnnotations, previewOrConfigFile]
    .filter((path): path is PreviewAnnotation => path !== undefined)
    .map((path) => processPreviewAnnotation(path, projectRoot));

  return {
    entries: [
      ...mockRedirectIncludeEntries,
      ...getUniqueImportPaths(index).map(escapeGlobPath),
      ...previewAnnotationEntries.map(escapeGlobPath),
    ],
    include: [...extraOptimizeDeps, 'storybook/internal/preview/runtime'],
  };
}
