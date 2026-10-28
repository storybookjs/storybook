import type { Storybook } from '@storybook/core';
import type { PreviewSources } from '@storybook/core/internal/preview-page';

import type { Plugin } from 'vite';

import { codeGeneratorPlugin } from './code-generator-plugin.ts';
import { injectExportOrderPlugin } from './inject-export-order-plugin.ts';
import { stripStoryHMRBoundary } from './strip-story-hmr-boundaries.ts';

/** Serve the preview page and its entry; the Vitest addon does not use these plugins. */
export async function storybookEntryPlugin(
  storybook: Storybook,
  preview: PreviewSources
): Promise<Plugin[]> {
  return [
    codeGeneratorPlugin(storybook, preview),
    injectExportOrderPlugin(),
    await stripStoryHMRBoundary(),
  ];
}
