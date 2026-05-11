import { relative } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import type { Plugin } from 'vite';

import { ENV_MARKER } from './before-environment-plugin.ts';
import { getFileAtHead } from './git-file-at-head.ts';

interface BeforeContentPluginOptions {
  repoRoot: string;
}

/**
 * Vite plugin that intercepts module loading and returns file content from git
 * HEAD instead of the working directory. The load hook fires only when the
 * resolved id carries the `?env=before` marker; the marker is attached by
 * `beforeEnvironmentPlugin.resolveId` when an importer chain traces back to
 * the before-iframe entry. Virtual modules and files that don't exist at HEAD
 * fall through to default Vite resolution.
 */
export function beforeContentPlugin({ repoRoot }: BeforeContentPluginOptions): Plugin {
  return {
    name: 'storybook:before-content-override',
    enforce: 'pre',

    async load(id) {
      // Only serve HEAD content for marker-bearing ids — see plugin docstring.
      if (!id.includes(ENV_MARKER)) {
        return null;
      }

      // Skip virtual modules — the marker on them is purely for HMR
      // partitioning; the generated content is identical to client env.
      if (id.startsWith('\0') || id.startsWith('virtual:')) {
        return null;
      }

      // Strip query parameters from the id to get the file path
      const filePath = id.split('?')[0];

      // Skip files outside the repo (node_modules, etc.)
      if (!filePath.startsWith(repoRoot)) {
        return null;
      }

      // Get the repo-relative path (normalize to forward slashes for git on Windows)
      const repoRelativePath = relative(repoRoot, filePath).replaceAll('\\', '/');

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
