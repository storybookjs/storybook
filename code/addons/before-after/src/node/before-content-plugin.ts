import { relative } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import type { Plugin } from 'vite';

import { getFileAtHead } from './git-file-at-head.ts';

interface BeforeContentPluginOptions {
  repoRoot: string;
}

/**
 * Vite plugin that intercepts module loading and returns file content from git
 * HEAD instead of the working directory. This ensures the "before" server always
 * renders the HEAD version of all project files.
 *
 * Virtual modules and files that don't exist at HEAD (new files) fall through to
 * default Vite resolution.
 */
export function beforeContentPlugin({ repoRoot }: BeforeContentPluginOptions): Plugin {
  return {
    name: 'storybook:before-content-override',
    enforce: 'pre',

    async load(id) {
      // Skip virtual modules
      if (id.startsWith('\0') || id.startsWith('virtual:')) {
        return null;
      }

      // Strip query parameters from the id to get the file path
      const filePath = id.split('?')[0];

      // Skip files outside the repo (node_modules, etc.)
      if (!filePath.startsWith(repoRoot)) {
        return null;
      }

      // Get the repo-relative path
      const repoRelativePath = relative(repoRoot, filePath);

      // Skip node_modules — deps are identical between HEAD and working tree
      if (repoRelativePath.includes('node_modules')) {
        return null;
      }

      try {
        const headContent = await getFileAtHead(repoRoot, repoRelativePath);

        // If file doesn't exist at HEAD (new file), fall through to default
        if (headContent === null) {
          return null;
        }

        return headContent;
      } catch (error) {
        logger.warn(`[before-after] Error loading HEAD content for ${repoRelativePath}: ${error}`);
        return null;
      }
    },
  };
}
