import { relative } from 'node:path';

import { loadPreviewOrConfigFile } from 'storybook/internal/common';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import type { UserConfig, InlineConfig as ViteInlineConfig } from 'vite';

import { listStories } from './list-stories';
import { processPreviewAnnotation } from './utils/process-preview-annotation';

/**
 * Collects all preview annotation files from presets and user's preview file. These files need to
 * be included as entries so Vite can optimize their dependencies.
 */
async function getPreviewAnnotations(options: Options, projectRoot: string): Promise<string[]> {
  const { normalizePath } = await import('vite');

  // Get preview annotations from presets (addons, renderers, frameworks)
  const previewAnnotations = await options.presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );

  // Get user's preview file
  const previewOrConfigFile = loadPreviewOrConfigFile({ configDir: options.configDir });

  // Combine all preview annotations
  const allPreviewAnnotations = [...previewAnnotations, previewOrConfigFile].filter(
    (entry): entry is PreviewAnnotation => entry !== undefined
  );

  // Process each annotation to get absolute paths
  return allPreviewAnnotations.map((annotation) =>
    normalizePath(processPreviewAnnotation(annotation, projectRoot))
  );
}

/**
 * Configures Vite's dependency optimization by providing all entry points. This includes story
 * files and preview annotation files, allowing Vite to automatically discover and optimize
 * dependencies without requiring a manual list.
 *
 * This approach prevents hard reloads caused by runtime dependency discovery, improves Storybook
 * load times, and makes Vitest tests more stable.
 */
export async function getOptimizeDeps(config: ViteInlineConfig, options: Options) {
  const extraOptimizeDeps = await options.presets.apply('optimizeViteDeps', []);

  const { root = process.cwd() } = config;
  const { normalizePath } = await import('vite');

  // Get all story files as entries
  const absoluteStories = await listStories(options);
  const stories = absoluteStories.map((storyPath) => normalizePath(relative(root, storyPath)));

  // Get all preview annotation files as entries
  const previewAnnotations = await getPreviewAnnotations(options, root);
  const relativePreviewAnnotations = previewAnnotations.map((path) =>
    normalizePath(relative(root, path))
  );

  // Combine all entries: stories + preview annotations
  const allEntries = [...stories, ...relativePreviewAnnotations];

  const optimizeDeps: UserConfig['optimizeDeps'] = {
    ...config.optimizeDeps,
    // Include both story files and preview annotation files as entries.
    // Vite will automatically discover and optimize dependencies from these entry points.
    entries: allEntries,
    // Allow additional dependencies to be specified via presets or user config
    include: [...extraOptimizeDeps, ...(config.optimizeDeps?.include || [])],
  };

  return optimizeDeps;
}
