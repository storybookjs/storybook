import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options, PreviewAnnotation, StoryIndex } from 'storybook/internal/types';

import { resolve } from 'pathe';
import { type Plugin } from 'vite';

import { getPackageName, isLocalWorkspacePackage } from '../utils/is-local-workspace-package';
import { processPreviewAnnotation } from '../utils/process-preview-annotation';
import { getUniqueImportPaths } from '../utils/unique-import-paths';

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
          entries: [
            ...(typeof config.optimizeDeps?.entries === 'string'
              ? [config.optimizeDeps.entries]
              : (config.optimizeDeps?.entries ?? [])),
            ...getUniqueImportPaths(index),
            ...previewAnnotationEntries,
          ],
          // Extra deps explicitly included by Storybook presets (e.g. framework-specific packages).
          // Local workspace packages (symlinked monorepo packages) are excluded so that Vite
          // watches and serves their dist files directly, enabling cache invalidation when
          // those packages are rebuilt during development.
          include: [
            ...extraOptimizeDeps.filter((dep) => {
              const pkgName = getPackageName(dep);
              return !isLocalWorkspacePackage(pkgName, projectRoot);
            }),
            ...(config.optimizeDeps?.include ?? []),
          ],
        },
      };
    },
  };
}
