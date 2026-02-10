import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { codeGeneratorPlugin } from './code-generator-plugin';
import { injectExportOrderPlugin } from './inject-export-order-plugin';
import { stripStoryHMRBoundary } from './strip-story-hmr-boundaries';

/**
 * A composite Vite plugin that manages the generation and injection of virtual entry points for
 * Storybook stories. This is builder-specific and NOT shared with addon-vitest.
 *
 * This handles:
 *
 * - Virtual module resolution for story imports, addon setup, and the main app entry
 * - Story import function generation (dynamic imports for code splitting)
 * - Iframe HTML transformation and build entry configuration
 * - Story index watching for HMR invalidation
 * - Export order injection (`__namedExportsOrder`) for consistent story discovery
 * - HMR boundary stripping to prevent stories from being treated as HMR boundaries
 *
 * Note: The project annotations virtual module is provided separately by the `viteCorePlugins`
 * preset so that it can be shared with addon-vitest.
 *
 * @returns An array of Vite plugins with appropriate enforcement ordering
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
