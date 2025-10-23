import type { Plugin } from 'vite';

import {
  GHOST_STORIES_VIRTUAL_PREFIX,
  generateVirtualCsfContent,
  parseGhostStoryModuleId,
} from './virtual-module-handler';

/** Vite plugin for handling Ghost Stories virtual modules */
export function ghostStoriesPlugin(options: { workingDir?: string } = {}): Plugin {
  const { workingDir = process.cwd() } = options;

  return {
    name: 'storybook:ghost-stories',

    resolveId(source: string) {
      if (source.startsWith(GHOST_STORIES_VIRTUAL_PREFIX)) {
        // Return the virtual module ID with a null byte prefix to indicate it's virtual
        return `\0${source}`;
      }
      return undefined;
    },

    async load(id: string) {
      if (id.startsWith(`\0${GHOST_STORIES_VIRTUAL_PREFIX}`)) {
        const cleanId = id.substring(1); // Remove the null byte prefix

        const parsed = parseGhostStoryModuleId(cleanId);
        if (!parsed) {
          throw new Error(`Invalid ghost story module ID: ${cleanId}`);
        }

        try {
          const csfContent = generateVirtualCsfContent(
            parsed.originalPath,
            parsed.componentName,
            workingDir
          );

          return {
            code: csfContent,
            map: null, // We could generate source maps if needed
          };
        } catch (error) {
          console.error(`Error loading ghost story module ${cleanId}:`, error);

          // Return a fallback module that will show an error
          return {
            code: `
import React from 'react';

export default {
  title: 'Error',
  component: () => React.createElement('div', null, 'Error loading ghost story'),
};
`,
            map: null,
          };
        }
      }

      return undefined;
    },

    // Handle HMR for ghost stories
    handleHotUpdate(ctx) {
      const { file } = ctx;

      // If a component file changes, we should invalidate related ghost stories
      if (file.includes('.stories.')) {
        return; // Don't handle story files
      }

      // Check if this is a component file that has ghost stories
      const virtualModuleIds = this.getModuleIds().filter(
        (id) => id.includes(GHOST_STORIES_VIRTUAL_PREFIX) && id.includes(file)
      );

      if (virtualModuleIds.length > 0) {
        // Invalidate ghost story modules when component files change
        virtualModuleIds.forEach((moduleId) => {
          const module = this.getModuleInfo(moduleId);
          if (module) {
            ctx.server.reloadModule(moduleId);
          }
        });
      }

      return undefined;
    },
  };
}
