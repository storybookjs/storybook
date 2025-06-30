import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { automockModule, findMockRedirect } from '@vitest/mocker/node';
import { walk } from 'estree-walker';
import type { Plugin, ResolvedConfig } from 'vite';

interface MockBuildManifestPluginOptions {
  /** The absolute path to the preview.tsx file where mocks are defined. */
  previewConfigPath: string;
}

const VIRTUAL_AUTOMOCK_PREFIX = 'virtual:automock:';

/**
 * A Vite plugin that runs only during build. It scans the preview.tsx file for `sb.mock()` calls,
 * processes them, and creates a manifest for runtime use.
 */
export function viteMockBuildManifestPlugin(options: MockBuildManifestPluginOptions): Plugin {
  let viteConfig: ResolvedConfig;

  // Temporary maps to hold chunk references during the build.
  const redirectChunkRefs = new Map<string, string>();
  const automockChunkRefs = new Map<string, string>();

  return {
    name: 'storybook:mock-build-manifest',
    apply: 'build',

    buildStart() {
      redirectChunkRefs.clear();
      automockChunkRefs.clear();
    },

    configResolved(config) {
      viteConfig = config;
    },

    async transform(code, id) {
      // We only care about the specific `preview.tsx` file where mocks are defined.
      if (id !== options.previewConfigPath) {
        return null;
      }

      const ast = this.parse(code);
      const mockCalls: Array<{ path: string; isFactoryMock: boolean }> = [];

      // Use an AST walker to find all `sb.mock()` expressions.
      walk(ast as any, {
        enter(node) {
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'MemberExpression' &&
            node.callee.object.type === 'Identifier' &&
            node.callee.object.name === 'sb' &&
            node.callee.property.type === 'Identifier' &&
            node.callee.property.name === 'mock'
          ) {
            if (node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
              mockCalls.push({
                path: node.arguments[0].value as string,
                isFactoryMock: node.arguments.length > 1,
              });
            }
          }
        },
      });

      if (mockCalls.length === 0) {
        return null;
      }

      for (const call of mockCalls) {
        // Factory mocks (e.g., `sb.mock('path', () => ({ ... }))`) are handled at runtime
        // because the factory function needs to exist in the browser's memory with its scope.
        // We only need to process path-only mocks here.
        if (call.isFactoryMock) {
          continue;
        }

        const resolved = await this.resolve(call.path, id);
        if (!resolved) {
          this.warn(`[vitest-mocker] Could not resolve mock path "${call.path}" in ${id}`);
          continue;
        }

        const resolvedId = resolved.id;

        // Check for a corresponding file in a `__mocks__` directory.
        const redirectPath = findMockRedirect(viteConfig.root, resolvedId, null);

        if (redirectPath) {
          const chunkRef = this.emitFile({
            type: 'chunk',
            id: redirectPath,
            importer: options.previewConfigPath,
          });

          // The manifest maps the original module ID to the URL of the newly created asset.
          redirectChunkRefs.set(resolvedId, chunkRef);
        } else {
          // If there's no redirect, it's an automock. We'll generate the mocked version.
          const virtualId = `${VIRTUAL_AUTOMOCK_PREFIX}${resolvedId}`;

          const chunkRef = this.emitFile({
            type: 'chunk',
            id: virtualId, // The entry point is our virtual module ID.
            importer: options.previewConfigPath,
          });

          // The manifest maps the original module ID to the URL of the automocked asset.
          automockChunkRefs.set(resolvedId, chunkRef);
        }
      }

      // We return null because we don't need to change the preview.tsx file itself.
      // All our work is done by calling `this.emitFile`.
      return null;
    },

    // The resolveId and load hooks are used to provide the source for our virtual automock modules.
    resolveId(id) {
      if (id.startsWith(VIRTUAL_AUTOMOCK_PREFIX)) {
        return id;
      }
      return null;
    },

    async load(id) {
      if (id.startsWith(VIRTUAL_AUTOMOCK_PREFIX)) {
        const originalId = id.slice(VIRTUAL_AUTOMOCK_PREFIX.length);
        const originalCode = await readFile(originalId, 'utf-8');
        // Generate the mocked source code. Vite will transform this code after we return it.
        const mocked = automockModule(originalCode, 'automock', this.parse, {
          globalThisAccessor: JSON.stringify('__vitest_mocker__'),
        });
        return mocked.toString();
      }
      return null;
    },

    generateBundle() {
      // This hook runs after all chunks have been generated and filenames are finalized.
      const manifest = {
        redirects: {} as Record<string, string>,
        automocks: {} as Record<string, string>,
      };

      // Resolve the final URLs for our __mocks__ redirects.
      for (const [originalId, chunkRef] of redirectChunkRefs.entries()) {
        const finalFileName = this.getFileName(chunkRef);
        manifest.redirects[originalId] = `/${finalFileName}`;
      }

      // Resolve the final URLs for our automocked modules.
      for (const [originalId, chunkRef] of automockChunkRefs.entries()) {
        const finalFileName = this.getFileName(chunkRef);
        manifest.automocks[originalId] = `/${finalFileName}`;
      }

      // Emit the final manifest file.
      this.emitFile({
        type: 'asset',
        fileName: 'mock-manifest.json',
        source: JSON.stringify(manifest, null, 2),
      });
    },
  };
}
