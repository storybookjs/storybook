import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import { babelParser, extractMockCalls, findMockRedirect } from 'storybook/internal/mocking-utils';
import type { Options, PreviewAnnotation, StoryIndex } from 'storybook/internal/types';

import { resolve } from 'pathe';
import { type Plugin } from 'vite';

import { processPreviewAnnotation } from '../utils/process-preview-annotation.ts';
import { getUniqueImportPaths } from '../utils/unique-import-paths.ts';

/**
 * Escapes special glob characters in a file path so Vite's dep optimizer treats it as a literal
 * path rather than a glob pattern. This is necessary for paths containing characters like `(` and
 * `)` (e.g. Next.js route group directories such as `src/(group)/...`) which would otherwise be
 * interpreted as extglob patterns by fast-glob.
 */
export function escapeGlobPath(filePath: string): string {
  return filePath.replace(/[()[\]{}!*?|+@]/g, '\\$&');
}

/** Converts extracted sb.mock calls into optimizeDeps include entries for manual **mocks** files. */
export function getMockRedirectIncludeEntries(
  mockCalls: Array<{ redirectPath: string | null }>
): string[] {
  return Array.from(
    new Set(
      mockCalls
        .map((mockCall) => mockCall.redirectPath)
        .filter((redirectPath): redirectPath is string => redirectPath !== null)
        .map(escapeGlobPath)
    )
  );
}

async function computeOptimizeDeps(options: Options) {
  const projectRoot = resolve(options.configDir, '..');

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

/** A Vite plugin that configures dependency optimization for Storybook's dev server. */
export function storybookOptimizeDepsPlugin(options: Options): Plugin {
  let cached: Awaited<ReturnType<typeof computeOptimizeDeps>> | undefined;

  const getOptimizeDeps = async () => {
    if (!cached) {
      cached = await computeOptimizeDeps(options);
    }
    return cached;
  };

  return {
    name: 'storybook:optimize-deps-plugin',
    async config(config, { command }) {
      if (command !== 'serve') {
        return;
      }
      const optimizeDeps = await getOptimizeDeps();
      return {
        optimizeDeps: {
          entries: [
            ...(typeof config.optimizeDeps?.entries === 'string'
              ? [config.optimizeDeps.entries]
              : (config.optimizeDeps?.entries ?? [])),
            ...optimizeDeps.entries,
          ],
          include: [...optimizeDeps.include, ...(config.optimizeDeps?.include ?? [])],
        },
      };
    },
  };
}
