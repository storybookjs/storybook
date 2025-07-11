import { isAbsolute, join } from 'node:path';

import { findMockRedirect } from '@vitest/mocker/redirect';
import { transformSync } from 'esbuild';
import { walk } from 'estree-walker';
import { readFileSync } from 'fs';
import type { PluginContext } from 'rollup';
import type { ResolvedConfig, ViteDevServer } from 'vite';

import { telemetry } from '../../../../telemetry';
import type { MockPluginOptions } from './plugin';

const DEFAULT_MODULE_DIRECTORIES = ['/node_modules/'];

export function isModuleDirectory(path: string) {
  return DEFAULT_MODULE_DIRECTORIES.some((dir: string) => path.includes(dir));
}

/**
 * Get the clean id of a module.
 *
 * @param id - The id of the module.
 * @returns Extracts the id of node_modules for optimized deps
 */
export function getCleanId(id: string) {
  return id
    .replace(/^.*\/deps\//, '') // Remove everything up to and including /deps/
    .replace(/\.js.*$/, '') // Remove .js and anything after (query params)
    .replace(/_/g, '/');
}

/**
 * Invalidate all related modules for a given mock (by absolute path and package name), including
 * optimized deps and node_modules variants.
 */
export function invalidateAllRelatedModules(
  server: ViteDevServer,
  absPath: string,
  pkgName: string
) {
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    if (mod.id === absPath || (mod.id && getCleanId(mod.id) === pkgName)) {
      server.moduleGraph.invalidateModule(mod);
    }
  }
}

export type MockCall = {
  path: string;
  absolutePath: string;
  redirectPath: string | null;
  spy: boolean;
};

/**
 * Extracts all sb.mock() calls from the preview config file.
 *
 * @param this PluginContext
 */
export function extractMockCalls(
  options: MockPluginOptions,
  parse: PluginContext['parse'],
  viteConfig: ResolvedConfig
): MockCall[] {
  const previewConfigCode = readFileSync(options.previewConfigPath, 'utf-8');
  const { code: jsCode } = transformSync(previewConfigCode, { loader: 'tsx', format: 'esm' });
  const ast = parse(jsCode);
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

  if (!options.coreOptions?.disableTelemetry) {
    telemetry(
      'mocking',
      {
        modulesMocked: mocks.length,
        modulesSpied: mocks.map((mock) => mock.spy).filter(Boolean).length,
        modulesManuallyMocked: mocks.map((mock) => !!mock.redirectPath).filter(Boolean).length,
      },
      { configDir: options.configDir }
    );
  }
  return mocks;
}
