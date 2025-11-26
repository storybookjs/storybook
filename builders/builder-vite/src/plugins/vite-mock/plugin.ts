import { readFileSync } from 'node:fs';

import {
  babelParser,
  extractMockCalls,
  getAutomockCode,
  getRealPath,
  rewriteSbMockImportCalls,
} from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';
import type { CoreConfig } from 'storybook/internal/types';

import { findMockRedirect } from '@vitest/mocker/redirect';
import { normalize } from 'pathe';
import type { Plugin, ResolvedConfig } from 'vite';

import { type MockCall, getCleanId, invalidateAllRelatedModules } from './utils';

export interface MockPluginOptions {
  /** The absolute path to the preview.tsx file where mocks are defined. */
  previewConfigPath: string;
  /** The absolute path to the Storybook config directory. */
  coreOptions?: CoreConfig;
  /** Configuration directory */
  configDir: string;
}

/**
 * Vite plugin for Storybook module mocking manifest generation.
 *
 * Scans the preview config for sb.mock() calls, processes them, and emits a manifest for runtime
 * use.
 *
 * Responsibilities:
 *
 * - Extract mock calls from preview config
 * - Invalidate affected files when mocks change
 * - Transform mock calls to automocked code
 *
 * @see MockPluginOptions
 */
export function viteMockPlugin(options: MockPluginOptions): Plugin[] {
  // --- Plugin State ---
  let viteConfig: ResolvedConfig;
  let mockCalls: MockCall[] = [];

  const normalizedPreviewConfigPath = normalize(options.previewConfigPath);

  // --- Plugin Definition ---
  return [
    {
      name: 'storybook:mock-loader',

      configResolved(config) {
        viteConfig = config;
      },

      buildStart() {
        mockCalls = extractMockCalls(options, babelParser, viteConfig.root, findMockRedirect);
      },

      configureServer(server) {
        async function invalidateAffectedFiles(file: string) {
          if (file === options.previewConfigPath || file.includes('__mocks__')) {
            // Store the old mocks before updating
            const oldMockCalls = mockCalls;
            // Re-extract mocks to get the latest list
            mockCalls = extractMockCalls(options, babelParser, viteConfig.root, findMockRedirect);

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

      load: {
        order: 'pre',
        handler(id) {
          const preserveSymlinks = viteConfig.resolve.preserveSymlinks;

          const idNorm = getRealPath(id, preserveSymlinks);
          const cleanId = getCleanId(idNorm);

          for (const call of mockCalls) {
            const callNorm = getRealPath(call.absolutePath, preserveSymlinks);

            if (callNorm !== idNorm && call.path !== cleanId) {
              continue;
            }

            if (call.redirectPath) {
              this.addWatchFile(call.redirectPath);
              return readFileSync(call.redirectPath, 'utf-8');
            }
          }
          return null;
        },
      },
      transform: {
        order: 'pre',
        handler(code, id) {
          for (const call of mockCalls) {
            const preserveSymlinks = viteConfig.resolve.preserveSymlinks;

            const idNorm = getRealPath(id, preserveSymlinks);
            const callNorm = getRealPath(call.absolutePath, preserveSymlinks);

            if (viteConfig.command !== 'serve') {
              if (callNorm !== idNorm) {
                continue;
              }
            } else {
              const cleanId = getCleanId(idNorm);

              if (call.path !== cleanId && callNorm !== idNorm) {
                continue;
              }
            }

            try {
              if (!call.redirectPath) {
                const automockedCode = getAutomockCode(code, call.spy, babelParser as any);

                return {
                  code: automockedCode.toString(),
                  map: automockedCode.generateMap(),
                };
              }
            } catch (e) {
              logger.error(`Error automocking ${id}: ${e}`);
              return null;
            }
          }
          return null;
        },
      },
    },
    {
      name: 'storybook:mock-loader-preview',
      transform(code, id) {
        if (id === normalizedPreviewConfigPath) {
          try {
            return rewriteSbMockImportCalls(code);
          } catch (e) {
            logger.debug(`Could not transform sb.mock(import(...)) calls in ${id}: ${e}`);
            return null;
          }
        }
        return null;
      },
    },
  ];
}
