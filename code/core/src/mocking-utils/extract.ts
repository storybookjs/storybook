import { readFileSync } from 'node:fs';

import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig } from 'storybook/internal/types';

import { transformSync } from 'esbuild';
import { walk } from 'estree-walker';
import { basename, normalize } from 'pathe';

import { parseModule } from '../csf-tools/estree/ast.ts';
import { SourceEditor } from '../csf-tools/estree/editor.ts';
import { resolveMock } from './resolve.ts';

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
 * Parse a module into an ESTree program. The file extension picks the grammar, so a `.ts` module
 * keeps its generic arrows; without a TS or JS extension the TSX and TS grammars are both tried.
 * Throws on syntax errors.
 *
 * Node offsets index `normalizeLineEndings(code)`, which differs from `code` when it uses CRLF.
 */
export const parseModuleAst = (code: string, fileName?: string) =>
  parseModule(code, fileName).program;

/**
 * @deprecated Use `parseModuleAst`. It returns an ESTree program, no longer a Babel AST, and its
 *   offsets index the code with `\n` line endings.
 */
export const babelParser = parseModuleAst;

const isStringLiteral = (node: any): boolean =>
  node?.type === 'Literal' && typeof node.value === 'string';

// `import('foo')`, whose specifier `sb.mock` accepts in place of the string.
const isStaticImport = (node: any): boolean =>
  node?.type === 'ImportExpression' && isStringLiteral(node.source);

/** Utility to rewrite sb.mock(import('...'), ...) to sb.mock('...', ...) */
export function rewriteSbMockImportCalls(code: string, fileName: string) {
  const editor = new SourceEditor(code, fileName);

  walk(editor.program as any, {
    enter(node: any) {
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'sb' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'mock' &&
        node.arguments.length > 0 &&
        isStaticImport(node.arguments[0])
      ) {
        // Replace sb.mock(import('foo'), ...) with sb.mock('foo', ...)
        const [argument] = node.arguments;
        editor.edits.overwrite(argument.start, argument.end, JSON.stringify(argument.source.value));
      }
    },
  });
  if (!editor.pending) {
    return { code, map: null };
  }
  // Spread into a plain object: babel-loader, next in the webpack chain, rejects a string map.
  const map = { ...editor.generateMap() };
  return {
    code: editor.toString(),
    map: { ...map, sourcesContent: map.sourcesContent as string[] },
  };
}

/**
 * Extracts all sb.mock() calls from the preview config file.
 *
 * @param this PluginContext
 */
export function extractMockCalls(
  options: ExtractMockCallsOptions,
  parse: (input: string) => unknown,
  root: string,
  findMockRedirect: (
    root: string,
    absolutePath: string,
    externalPath: string | null
  ) => string | null
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
          prop.type === 'Property' &&
          ((prop.key.type === 'Identifier' && prop.key.name === 'spy') ||
            (isStringLiteral(prop.key) && prop.key.value === 'spy')) &&
          prop.value.type === 'Literal' &&
          prop.value.value === true
        ) {
          return true;
        }
      }
      return false;
    }

    walk(ast as any, {
      async enter(node: any) {
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

        // Support sb.mock('foo', ...) and sb.mock(import('foo'), ...)
        let path: string;
        if (isStringLiteral(node.arguments[0])) {
          path = node.arguments[0].value;
        } else if (isStaticImport(node.arguments[0])) {
          path = node.arguments[0].source.value;
        } else {
          return;
        }

        const spy =
          node.arguments.length > 1 &&
          node.arguments[1].type === 'ObjectExpression' &&
          hasSpyTrue(node.arguments[1]);

        const { absolutePath, redirectPath } = resolveMock(
          path,
          root,
          options.previewConfigPath,
          findMockRedirect
        );

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

    if (mocks.length > 0) {
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
    logger.debug('Error extracting mock calls: ' + String(error));
    return [];
  }
}
