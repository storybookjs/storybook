import { relative } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import type { Plugin } from 'vite';

import { getFileAtHead } from './git-file-at-head.ts';

interface BeforeContentPluginOptions {
  repoRoot: string;
  /**
   * When `true`, the plugin scopes itself to the `storybook-before` Vite
   * environment via `applyToEnvironment`. This is the path used by the
   * Environment-API design (`STORYBOOK_BEFORE_AFTER_ENV_API=1`).
   *
   * When `false` (or omitted), the plugin runs unconditionally — the legacy
   * subprocess path always loads HEAD content because the entire dev server
   * runs in the "before" role.
   */
  scopeToBeforeEnvironment?: boolean;
}

/**
 * Vite plugin that intercepts module loading and returns file content from git
 * HEAD instead of the working directory. This ensures the "before" view always
 * renders the HEAD version of all project files.
 *
 * Virtual modules and files that don't exist at HEAD (new files) fall through to
 * default Vite resolution.
 */
export function beforeContentPlugin({
  repoRoot,
  scopeToBeforeEnvironment = false,
}: BeforeContentPluginOptions): Plugin {
  const plugin: Plugin = {
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

  if (scopeToBeforeEnvironment) {
    // Vite ≥ 6 Environment API: only fire `load()` for the before environment.
    // Cast keeps the plugin compilable against Vite 5 type definitions used by
    // the legacy subprocess path. The env name matches `BEFORE_ENV_NAME` from
    // `before-environment-plugin.ts`; Vite forbids hyphens in env names.
    (
      plugin as unknown as { applyToEnvironment: (env: { name: string }) => boolean }
    ).applyToEnvironment = (env) => env.name === 'storybookBefore';
  }

  return plugin;
}
