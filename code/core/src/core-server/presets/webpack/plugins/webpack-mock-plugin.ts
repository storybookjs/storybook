import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';
import type { CallExpression, Literal } from 'estree';
import { walk } from 'estree-walker';
import { readFileSync } from 'fs';
import { type Compiler } from 'webpack';

import { resolveMock } from '../../../mocking-utils/resolve';

/** Options for configuring the WebpackMockPlugin. */
export interface WebpackMockPluginOptions {
  /**
   * The absolute path to the preview configuration file (e.g., `.storybook/preview.ts`). This file
   * will be scanned for `sb.mock()` calls.
   */
  previewConfigPath: string;
}

/** Represents a single `sb.mock()` call extracted directly from the AST. */
interface ExtractedMock {
  /** The raw module path string from the mock call (e.g., '../utils/api'). */
  path: string;
  /** Whether the mock was configured with `{ spy: true }`. */
  spy: boolean;
}

/** Represents a fully processed mock, with resolved paths and its replacement resource. */
interface ResolvedMock extends ExtractedMock {
  /** The absolute resolved path of the module to be mocked. */
  absolutePath: string;
  /** The resource that Webpack will use to replace the original module. */
  replacementResource: string;
}

const PLUGIN_NAME = 'WebpackMockPlugin';

export class WebpackMockPlugin {
  private readonly options: WebpackMockPluginOptions;

  constructor(options: WebpackMockPluginOptions) {
    if (!options.previewConfigPath) {
      throw new Error(`[${PLUGIN_NAME}] \`previewConfigPath\` is required.`);
    }
    this.options = options;
  }

  apply(compiler: Compiler) {
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);
    const resolvedMocks = this.extractAndResolveMocks(compiler);

    if (resolvedMocks.length === 0) {
      logger.info('No `sb.mock()` calls found. Skipping module replacement.');
      return;
    }

    logger.info(`Found ${resolvedMocks.length} module mock(s). Applying replacements...`);

    // Create a Map for efficient lookup of absolute paths to their mock data.
    const mockMap = new Map<string, ResolvedMock>(
      resolvedMocks.map((mock) => [mock.absolutePath, mock])
    );

    // For each resolved mock, apply a replacement rule.
    new compiler.webpack.NormalModuleReplacementPlugin(
      /.*/, // Intercept every module request.
      (resource) => {
        try {
          // `resource.request` is the raw string (e.g., '../utils/api')
          // `resource.context` is the directory of the file making the import.
          const absolutePath = require.resolve(resource.request, {
            paths: [resource.context],
          });

          // Check if the resolved absolute path is one we need to mock.
          if (mockMap.has(absolutePath)) {
            const mock = mockMap.get(absolutePath)!;
            // If so, rewrite the request to point to our mock resource.
            resource.request = mock.replacementResource;
          }
        } catch (e) {
          // This can fail for virtual modules, built-ins, etc.
          // It's safe to ignore these errors as they are not user modules we intend to mock.
        }
      }
    ).apply(compiler);
  }

  /**
   * Reads the preview config, parses it to find all `sb.mock()` calls, and resolves their
   * corresponding mock implementations.
   *
   * @param {Compiler} compiler The Webpack compiler instance.
   * @returns {ResolvedMock[]} An array of fully processed mocks.
   */
  private extractAndResolveMocks(compiler: Compiler): ResolvedMock[] {
    const { previewConfigPath } = this.options;
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

    // 1. Extract raw mock calls from the preview file's AST.
    const code = readFileSync(previewConfigPath, 'utf-8');
    const { code: jsCode } = transformSync(code, { loader: 'tsx' });
    const ast = parse(jsCode, {
      sourceType: 'module',
    });

    const extractedMocks: ExtractedMock[] = [];
    walk(ast as any, {
      enter: (node) => {
        if (this.isSbMockCall(node)) {
          const path = (node.arguments[0] as Literal).value as string;
          const spy = node.arguments[1]?.properties.some(
            (p: any) => p.key.name === 'spy' && p.value.value === true
          );
          extractedMocks.push({ path, spy });
        }
      },
    });

    // 2. Resolve each mock call to its absolute path and replacement resource.
    const resolvedMocks: ResolvedMock[] = [];
    for (const mock of extractedMocks) {
      try {
        const { absolutePath, redirectPath } = resolveMock(
          mock.path,
          compiler.context,
          previewConfigPath
        );

        let replacementResource: string;

        if (redirectPath) {
          // A `__mocks__` file exists. Use it directly as the replacement.
          replacementResource = redirectPath;
        } else {
          // No `__mocks__` file found. Use our custom loader to automock the module.
          const loaderPath = require.resolve(
            'storybook/internal/core-server/presets/webpack/plugins/webpack-automock-loader'
          );
          replacementResource = `${loaderPath}?spy=${mock.spy}!${absolutePath}`;
        }

        resolvedMocks.push({
          ...mock,
          absolutePath,
          replacementResource,
        });
      } catch (e) {
        logger.warn(`Could not resolve mock for "${mock.path}". It will be ignored.`);
      }
    }

    return resolvedMocks;
  }

  /**
   * Type guard to check if an AST node is a valid `sb.mock()` call expression.
   *
   * @param {any} node The AST node to check.
   * @returns {node is CallExpression}
   */
  private isSbMockCall(node: any): node is CallExpression & { arguments: [Literal, ...any[]] } {
    return (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'sb' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'mock' &&
      node.arguments.length > 0 &&
      node.arguments[0].type === 'StringLiteral'
    );
  }

  /**
   * Escapes a string for use in a regular expression.
   *
   * @param {string} str The string to escape.
   * @returns {string}
   */
  private escapeRegex(str: string): string {
    // Escape characters with special meaning in regular expressions.
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
