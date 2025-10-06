import { readFileSync } from 'node:fs';

import { generate, parser, types as t } from 'storybook/internal/babel';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig } from 'storybook/internal/types';

import { transformSync } from 'esbuild';
import { walk } from 'estree-walker';
import { basename, normalize } from 'pathe';

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
 * A wrapper around the babel parser that enables the necessary plugins to handle modern JavaScript
 * features, including TSX.
 *
 * @param code - The code to parse.
 * @returns The parsed code.
 */
export const babelParser = (code: string) => {
  return parser.parse(code, {
    sourceType: 'module',
    // Enable plugins to handle modern JavaScript features, including TSX.
    plugins: ['typescript', 'jsx', 'classProperties', 'objectRestSpread'],
    errorRecovery: true,
  }).program;
};

/** Utility to rewrite sb.mock(import('...'), ...) to sb.mock('...', ...) */
export function rewriteSbMockImportCalls(code: string) {
  const ast = babelParser(code);

  walk(ast as any, {
    enter(node: any) {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'sb' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'mock' &&
        node.arguments.length > 0 &&
        node.arguments[0].type === 'CallExpression' &&
        node.arguments[0].callee.type === 'Import' &&
        node.arguments[0].arguments.length === 1 &&
        node.arguments[0].arguments[0].type === 'StringLiteral'
      ) {
        // Replace sb.mock(import('foo'), ...) with sb.mock('foo', ...)
        node.arguments[0] = t.stringLiteral(node.arguments[0].arguments[0].value);
      }
    },
  });
  return generate(ast, {}, code);
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
  ) => t.Node,
  root: string
): MockCall[] {
  try {
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
          prop.type === 'ObjectProperty' &&
          ((prop.key.type === 'Identifier' && prop.key.name === 'spy') ||
            (prop.key.type === 'StringLiteral' && prop.key.value === 'spy')) &&
          prop.value.type === 'BooleanLiteral' &&
          prop.value.value === true
        ) {
          return true;
        }
      }
      return false;
    }

    walk(ast as any, {
      // @ts-expect-error - Node comes from babel
      async enter(node: t.Node) {
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

        if (node.arguments.length === 0) {
          return;
        }

        let path: string | undefined;
        // Support sb.mock('foo', ...) and sb.mock(import('foo'), ...)
        if (node.arguments[0].type === 'StringLiteral') {
          path = node.arguments[0].value as string;
        } else if (
          node.arguments[0].type === 'CallExpression' &&
          node.arguments[0].callee.type === 'Import' &&
          node.arguments[0].arguments[0].type === 'StringLiteral'
        ) {
          path = node.arguments[0].arguments[0].value;
        } else {
          return;
        }

        const spy =
          node.arguments.length > 1 &&
          node.arguments[1].type === 'ObjectExpression' &&
          hasSpyTrue(node.arguments[1]);

        const { absolutePath, redirectPath } = resolveMock(path, root, options.previewConfigPath);

        const pathWithoutExtension = path.replace(/\.[^/.]+$/, '');
        const basenameAbsolutePath = basename(absolutePath);
        const basenamePath = basename(path);

        const pathWithoutExtensionAndBasename =
          basenameAbsolutePath === basenamePath ? pathWithoutExtension : path;

        mocks.push({
          path: pathWithoutExtensionAndBasename,
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
  } catch (error) {
    logger.debug('Error extracting mock calls', error);
    return [];
  }
}
