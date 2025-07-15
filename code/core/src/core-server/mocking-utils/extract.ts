import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig } from 'storybook/internal/types';

import { transformSync } from 'esbuild';
import { type Node, walk } from 'estree-walker';
import { readFileSync } from 'fs';
import { normalize } from 'pathe';

import { resolveMock } from './resolve';

const DEFAULT_MODULE_DIRECTORIES = ['/node_modules/'];

export function isModuleDirectory(path: string) {
  const normalizedPath = normalize(path);
  return DEFAULT_MODULE_DIRECTORIES.some((dir: string) => normalizedPath.includes(dir));
}

export type MockCall = {
  path: string;
  absolutePath: string;
  redirectPath: string | null;
  spy: boolean;
};

interface ExtractMockCallsOptions {
  /** The absolute path to the preview.tsx file where mocks are defined. */
  previewConfigPath: string;
  /** The absolute path to the Storybook config directory. */
  coreOptions?: CoreConfig;
  /** Configuration directory */
  configDir: string;
}

/**
 * Extracts all sb.mock() calls from the preview config file.
 *
 * @param this PluginContext
 */
export function extractMockCalls(
  options: ExtractMockCallsOptions,
  parse: (
    input: string,
    options?: {
      allowReturnOutsideFunction?: boolean;
      jsx?: boolean;
    }
  ) => Node,
  root: string
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
    async enter(node) {
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

      const { absolutePath, redirectPath } = resolveMock(path, root, options.previewConfigPath);

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
