import { readFile } from 'node:fs/promises';

import { join, relative } from 'pathe';
import type { Plugin } from 'vite';

const codeDir = join(import.meta.dirname, '..');

// Mirrors `workspaces` in the root package.json.
const workspacePackage = 'core|(?:addons|builders|frameworks|lib|presets|renderers)/[^/]+';
const prebuiltChunk = new RegExp(`^(?:${workspacePackage})/dist/.+\\.js$`);

// Vite's dev server appends a generated sourcemap to every JS response that has none, on each
// request, unless the module's map has empty mappings. For a prebuilt chunk that generated map only
// describes the chunk itself. The empty map must be set in `load`: Vite ignores a map returned by
// `transform` when no plugin changes the code.
export function skipDistFallbackSourcemaps(): Plugin {
  return {
    name: 'storybook-internal:skip-dist-fallback-sourcemaps',
    apply: 'serve',
    load: {
      // Last, so a loader that replaces a chunk, such as an `sb.mock` redirect, still runs.
      order: 'post',
      async handler(id) {
        if (!prebuiltChunk.test(relative(codeDir, id))) {
          return null;
        }
        const code = await readFile(id, 'utf-8').catch(() => null);
        // Vite's own loader reports an unreadable file and extracts the sourcemap a chunk ships.
        if (code === null || code.includes('sourceMappingURL=')) {
          return null;
        }
        return { code, map: { mappings: '' } };
      },
    },
  };
}
