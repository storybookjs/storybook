import type { Storybook } from '@storybook/core';
import type { PreviewSources } from '@storybook/core/internal/preview-page';

import { resolve } from 'pathe';
import { type Plugin } from 'vite';

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

/** A Vite plugin that configures dependency optimization for Storybook's dev server. */
export function storybookOptimizeDepsPlugin(storybook: Storybook, preview: PreviewSources): Plugin {
  return {
    name: 'storybook:optimize-deps-plugin',
    async config(config, { command }) {
      // optimizeDeps only applies to the dev server, not production builds
      if (command !== 'serve') {
        return;
      }

      const { configDir } = storybook;
      const { previewConfigPath, previewAnnotations } = preview;

      // The mocking utils load while the index builds instead of when the builder is imported.
      const [extraOptimizeDeps, index, mocking] = await Promise.all([
        storybook.callHook('builder:vite-deps:collect', []),
        storybook.getStoryIndexGenerator().then((generator) => generator.getIndex()),
        previewConfigPath ? import('@storybook/core/internal/mocking-utils') : undefined,
      ]);

      const mockRedirectIncludeEntries =
        previewConfigPath && mocking
          ? getMockRedirectIncludeEntries(
              mocking.extractMockCalls(
                { previewConfigPath, coreOptions: { disableTelemetry: true }, configDir },
                resolve(configDir, '..'),
                mocking.findMockRedirect
              )
            )
          : [];

      return {
        // Vite's scanner ignores every directory named outDir, including addon dist entries.
        build: {
          outDir: config.build?.outDir ?? storybook.options.outputDir ?? 'storybook-static',
        },
        optimizeDeps: {
          // Story files and preview annotations let Vite discover the CJS dependencies to pre-bundle.
          // Paths are escaped so glob characters (e.g. Next.js route groups) stay literal.
          entries: [
            ...(typeof config.optimizeDeps?.entries === 'string'
              ? [config.optimizeDeps.entries]
              : (config.optimizeDeps?.entries ?? [])),
            ...mockRedirectIncludeEntries,
            ...getUniqueImportPaths(index).map(escapeGlobPath),
            ...previewAnnotations.map(escapeGlobPath),
          ],
          include: [
            preview.previewRuntimePath,
            ...extraOptimizeDeps,
            ...(config.optimizeDeps?.include ?? []),
          ],
        },
      };
    },
  };
}
