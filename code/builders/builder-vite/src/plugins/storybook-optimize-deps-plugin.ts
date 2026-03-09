import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options, PreviewAnnotation, StoryIndex } from 'storybook/internal/types';

import { resolve } from 'pathe';
import { type Plugin } from 'vite';

import { processPreviewAnnotation } from '../utils/process-preview-annotation';
import { getUniqueImportPaths } from '../utils/unique-import-paths';

/**
 * Escapes special glob characters in a file path so Vite's dep optimizer treats it as a literal
 * path rather than a glob pattern. This is necessary for paths containing characters like `(` and
 * `)` (e.g. Next.js route group directories such as `src/(group)/...`) which would otherwise be
 * interpreted as extglob patterns by fast-glob.
 */
export function escapeGlobPath(filePath: string): string {
  return filePath.replace(/[()[\]{}!*?|+@]/g, '\\$&');
}

/** A Vite plugin that configures dependency optimization for Storybook's dev server. */
export function storybookOptimizeDepsPlugin(options: Options): Plugin {
  return {
    name: 'storybook:optimize-deps-plugin',
    async config(config, { command }) {
      // optimizeDeps only applies to the dev server, not production builds
      if (command !== 'serve') {
        return;
      }

      const projectRoot = resolve(options.configDir, '..');

      const [extraOptimizeDeps, storyIndexGenerator, previewAnnotations] = await Promise.all([
        options.presets.apply<string[]>('optimizeViteDeps', []),
        options.presets.apply<StoryIndexGenerator>('storyIndexGenerator'),
        options.presets.apply<PreviewAnnotation[]>('previewAnnotations', [], options),
      ]);

      const index: StoryIndex = await storyIndexGenerator.getIndex();

      // Include the user's preview file and all addon/framework/renderer preview annotations
      // as optimizer entries so Vite can discover all transitive CJS dependencies automatically.
      const previewOrConfigFile = loadPreviewOrConfigFile({ configDir: options.configDir });
      const previewAnnotationEntries = [...previewAnnotations, previewOrConfigFile]
        .filter((path): path is PreviewAnnotation => path !== undefined)
        .map((path) => processPreviewAnnotation(path, projectRoot));

      return {
        optimizeDeps: {
          // Story files + preview annotation files as entry points for the dep optimizer.
          // Vite will crawl these to discover all transitive CJS dependencies that need
          // pre-bundling, removing the need for a hard-coded include list.
          // Paths are escaped so that special glob characters (e.g. parentheses in Next.js route
          // group directories) are treated as literal characters, not glob syntax.
          entries: [
            ...(typeof config.optimizeDeps?.entries === 'string'
              ? [config.optimizeDeps.entries]
              : (config.optimizeDeps?.entries ?? [])),
            ...getUniqueImportPaths(index).map(escapeGlobPath),
            ...previewAnnotationEntries.map(escapeGlobPath),
          ],
          // Extra deps explicitly included by Storybook presets (e.g. framework-specific packages).
          include: [...extraOptimizeDeps, ...(config.optimizeDeps?.include ?? [])],
        },
      };
    },
  };
}
