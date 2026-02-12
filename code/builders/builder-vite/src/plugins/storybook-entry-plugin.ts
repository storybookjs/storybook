import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { codeGeneratorPlugin } from './code-generator-plugin';
import { injectExportOrderPlugin } from './inject-export-order-plugin';
import { stripStoryHMRBoundary } from './strip-story-hmr-boundaries';

/**
 * A composite Vite plugin that manages the generation and injection of virtual entry points for
 * Storybook stories. This is builder-specific and NOT shared with addon-vitest.
 */
export async function storybookEntryPlugin(options: Options): Promise<Plugin[]> {
  return [
    // Pre-enforcement: handles virtual module resolution and loading (must run first)
    codeGeneratorPlugin(options),
    // Post-enforcement: injects __namedExportsOrder after TypeScript transpilation
    await injectExportOrderPlugin(),
    // Post-enforcement: removes import.meta.hot.accept() from story files
    await stripStoryHMRBoundary(),
  ];
}
