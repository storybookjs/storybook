import { readFileSync } from 'node:fs';

import { automockModule } from '@vitest/mocker/node';
import type { PluginContext } from 'rollup';
import type { Plugin, ResolvedConfig } from 'vite';

import { __STORYBOOK_GLOBAL_THIS_ACCESSOR__ } from '../vite-inject-mocker/constants';
import { type MockCall, extractMockCalls, getCleanId, invalidateAllRelatedModules } from './utils';

interface MockBuildManifestPluginOptions {
  /** The absolute path to the preview.tsx file where mocks are defined. */
  previewConfigPath: string;
}

let parse: PluginContext['parse'];

/**
 * Vite plugin for Storybook module mocking manifest generation.
 *
 * Scans the preview config for sb.mock() calls, processes them, and emits a manifest for runtime
 * use.
 *
 * Responsibilities:
 *
 * - Extract mock calls from preview config
 * - Resolve and emit mock/automock chunks
 * - Generate a manifest mapping original modules to their mocks
 *
 * @see MockBuildManifestPluginOptions
 */
export function viteMockPlugin(options: MockBuildManifestPluginOptions): Plugin[] {
  // --- Plugin State ---
  let viteConfig: ResolvedConfig;
  let mockCalls: MockCall[] = [];

  // --- Plugin Definition ---
  return [
    {
      name: 'storybook:mock-loader',

      configResolved(config) {
        viteConfig = config;
      },

      buildStart() {
        parse = this.parse.bind(this);
        this.addWatchFile(options.previewConfigPath);
        mockCalls = extractMockCalls(options, parse, viteConfig);
      },

      configureServer(server) {
        async function invalidateAffectedFiles(file: string) {
          if (file === options.previewConfigPath || file.includes('__mocks__')) {
            // Store the old mocks before updating
            const oldMockCalls = mockCalls;
            // Re-extract mocks to get the latest list
            mockCalls = extractMockCalls(options, parse, viteConfig);

            // Invalidate the preview file
            const previewMod = server.moduleGraph.getModuleById(options.previewConfigPath);
            if (previewMod) {
              server.moduleGraph.invalidateModule(previewMod);
            }

            // Invalidate all current mocks (including optimized/node_modules variants)
            for (const call of mockCalls) {
              invalidateAllRelatedModules(server, call.absolutePath, call.path);
            }

            // Invalidate all removed mocks (present in old, missing in new)
            const newAbsPaths = new Set(mockCalls.map((c) => c.absolutePath));
            for (const oldCall of oldMockCalls) {
              if (!newAbsPaths.has(oldCall.absolutePath)) {
                invalidateAllRelatedModules(server, oldCall.absolutePath, oldCall.path);
              }
            }

            // Force a full browser reload so all affected files are refetched
            server.ws.send({ type: 'full-reload' });

            return [];
          }
        }

        server.watcher.on('change', invalidateAffectedFiles);
        server.watcher.on('add', invalidateAffectedFiles);
        server.watcher.on('unlink', invalidateAffectedFiles);
      },

      // handleHotUpdate({ file, server }) {
      //   if (file === options.previewConfigPath) {
      //     // Store the old mocks before updating
      //     const oldMockCalls = mockCalls;
      //     // Re-extract mocks to get the latest list
      //     mockCalls = extractMockCalls(options, parse, viteConfig);

      //     // Invalidate the preview file
      //     const previewMod = server.moduleGraph.getModuleById(options.previewConfigPath);
      //     if (previewMod) {
      //       server.moduleGraph.invalidateModule(previewMod);
      //     }

      //     // Invalidate all current mocks (including optimized/node_modules variants)
      //     for (const call of mockCalls) {
      //       invalidateAllRelatedModules(server, call.absolutePath, call.path);
      //     }

      //     // Invalidate all removed mocks (present in old, missing in new)
      //     const newAbsPaths = new Set(mockCalls.map((c) => c.absolutePath));
      //     for (const oldCall of oldMockCalls) {
      //       if (!newAbsPaths.has(oldCall.absolutePath)) {
      //         invalidateAllRelatedModules(server, oldCall.absolutePath, oldCall.path);
      //       }
      //     }

      //     // Force a full browser reload so all affected files are refetched
      //     server.ws.send({ type: 'full-reload' });

      //     return [];
      //   }
      // },

      async load(id) {
        for (const call of mockCalls) {
          if (call.absolutePath !== id) {
            continue;
          }

          try {
            if (call.redirectPath) {
              return readFileSync(call.redirectPath, 'utf-8');
            } else {
              return null;
            }
          } catch (e) {
            return null;
          }
        }
        return null;
      },
      transform: {
        order: 'post',
        handler(code, id) {
          for (const call of mockCalls) {
            if (call.absolutePath !== id && viteConfig.command !== 'serve') {
              continue;
            }

            const isOptimizedDeps = id.includes('/sb-vite/deps/');

            const cleanId = getCleanId(id);

            if (
              viteConfig.command === 'serve' &&
              call.path !== cleanId &&
              call.absolutePath !== id
            ) {
              continue;
            }

            try {
              if (!call.redirectPath) {
                const automockedCode = automockModule(
                  code,
                  call.spy ? 'autospy' : 'automock',
                  this.parse,
                  {
                    globalThisAccessor: JSON.stringify(__STORYBOOK_GLOBAL_THIS_ACCESSOR__),
                  }
                );

                return {
                  code: automockedCode.toString(),
                  map: automockedCode.generateMap(),
                };
              } else if (call.redirectPath && isOptimizedDeps) {
                return readFileSync(call.redirectPath, 'utf-8');
              }
            } catch (e) {
              return null;
            }
          }
          return null;
        },
      },
    },
  ];
}
