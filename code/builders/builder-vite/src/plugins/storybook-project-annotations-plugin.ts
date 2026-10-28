import type { PreviewSources } from '@storybook/core/internal/preview-page';

import type { Plugin } from 'vite';

/** Serve core's project annotations module, which the Vitest addon also imports. */
export function storybookProjectAnnotationsPlugin(preview: PreviewSources): Plugin {
  const id = preview.virtualModuleIds.projectAnnotations;
  const resolvedId = `\0${id}`;

  return {
    name: 'storybook:project-annotations-plugin',
    enforce: 'pre',
    resolveId(source) {
      if (source === id) {
        return resolvedId;
      }
    },
    load(loadedId) {
      if (loadedId === resolvedId) {
        return preview.modules.projectAnnotations;
      }
    },
  };
}
