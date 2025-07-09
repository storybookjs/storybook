import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { automockModule } from '@vitest/mocker/node';
import { findMockRedirect } from '@vitest/mocker/redirect';
import { transformSync } from 'esbuild';
import { walk } from 'estree-walker';
import type { PluginContext } from 'rollup';
import type { Plugin, ResolvedConfig } from 'vite';

import { __STORYBOOK_GLOBAL_THIS_ACCESSOR__ } from '../vite-inject-mocker/constants';
import { isModuleDirectory } from './utils';

interface MockBuildManifestPluginOptions {
  /** The absolute path to the preview.tsx file where mocks are defined. */
  previewConfigPath: string;
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
 * - Resolve and emit mock/automock chunks
 * - Generate a manifest mapping original modules to their mocks
 *
 * @see MockBuildManifestPluginOptions
 */
export function viteMockPlugin(options: MockBuildManifestPluginOptions): Plugin[] {
  // --- Plugin State ---
  let viteConfig: ResolvedConfig;
  let mockCalls: MockCall[] = [];

  // --- Types ---
  type MockCall = { path: string; absolutePath: string; redirectPath: string | null; spy: boolean };

  // --- Helpers ---

  /**
   * Extracts all sb.mock() calls from the preview config file.
   *
   * @param this PluginContext
   */
  function extractMockCalls(this: PluginContext): MockCall[] {
    const previewConfigCode = readFileSync(options.previewConfigPath, 'utf-8');
    const { code: jsCode } = transformSync(previewConfigCode, { loader: 'tsx', format: 'esm' });
    const ast = this.parse(jsCode);
    const mocks: MockCall[] = [];

    /** Helper to check if an ObjectExpression node has spy: true */
    function hasSpyTrue(objectExpression: any): boolean {
      if (!objectExpression || !objectExpression.properties) {
        return false;
      }
      for (const prop of objectExpression.properties) {
        if (
          prop.type === 'Property' &&
          ((prop.key.type === 'Identifier' && prop.key.name === 'spy') ||
            (prop.key.type === 'Literal' && prop.key.value === 'spy')) &&
          prop.value.type === 'Literal' &&
          prop.value.value === true
        ) {
          return true;
        }
      }
      return false;
    }

    walk(ast as any, {
      enter(node) {
        if (
          node.type !== 'CallExpression' ||
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.object.name !== 'sb' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'mock'
        ) {
          return;
        }

        if (node.arguments.length === 0 || node.arguments[0].type !== 'Literal') {
          return;
        }
        const spy =
          node.arguments.length > 1 &&
          node.arguments[1].type === 'ObjectExpression' &&
          hasSpyTrue(node.arguments[1]);

        const path = node.arguments[0].value as string;

        const isExternal = (function () {
          try {
            return (
              !isAbsolute(path) &&
              isModuleDirectory(require.resolve(path, { paths: [viteConfig.root] }))
            );
          } catch (e) {
            return false;
          }
        })();

        const external = isExternal ? path : null;

        const absolutePath = external
          ? require.resolve(path, { paths: [viteConfig.root] })
          : require.resolve(join(options.previewConfigPath, '..', path), {
              paths: [viteConfig.root],
            });

        const redirectPath = findMockRedirect(viteConfig.root, absolutePath, external);

        mocks.push({
          path,
          absolutePath,
          redirectPath,
          spy,
        });
      },
    });
    return mocks;
  }

  // --- Plugin Definition ---
  return [
    {
      name: 'storybook:mock-loader',

      configResolved(config) {
        viteConfig = config;
      },

      buildStart() {
        mockCalls = extractMockCalls.bind(this)();
      },

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

            const cleanId = id
              .replace(/^.*\/deps\//, '') // Remove everything up to and including /deps/
              .replace(/\.js.*$/, '') // Remove .js and anything after (query params)
              .replace(/_/g, '/'); // Replace underscores with slashes

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
