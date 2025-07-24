import { dirname, isAbsolute } from 'node:path';

import type { Compiler } from 'webpack';

import { babelParser, extractMockCalls } from '../../../mocking-utils/extract';
import { resolveMock } from '../../../mocking-utils/resolve';

// --- Type Definitions ---

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

const PLUGIN_NAME = 'storybook-mock-plugin';

/**
 * A Webpack plugin that enables module mocking for Storybook. It scans the preview config for
 * `sb.mock()` calls and uses Webpack's NormalModuleReplacementPlugin to substitute the original
 * modules with mocks.
 */
export class WebpackMockPlugin {
  private readonly options: WebpackMockPluginOptions;
  private mockMap: Map<string, ResolvedMock> = new Map();

  constructor(options: WebpackMockPluginOptions) {
    if (!options.previewConfigPath) {
      throw new Error(`[${PLUGIN_NAME}] \`previewConfigPath\` is required.`);
    }
    this.options = options;
  }

  /**
   * The main entry point for the Webpack plugin.
   *
   * @param {Compiler} compiler The Webpack compiler instance.
   */
  public apply(compiler: Compiler): void {
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);

    // This function will be called to update the mock map before each compilation.
    const updateMocks = () => {
      this.mockMap = new Map(
        this.extractAndResolveMocks(compiler).map((mock) => [mock.absolutePath, mock])
      );
      logger.info(`Mock map updated with ${this.mockMap.size} mocks.`);
    };

    // Hook into `beforeRun` for single builds and `watchRun` for development mode.
    compiler.hooks.beforeRun.tap(PLUGIN_NAME, updateMocks);
    compiler.hooks.watchRun.tap(PLUGIN_NAME, updateMocks);

    // Apply the replacement plugin. Its callback will now use the dynamically updated mockMap.
    new compiler.webpack.NormalModuleReplacementPlugin(/.*/, (resource) => {
      try {
        const absolutePath = require.resolve(resource.request, {
          paths: [resource.context],
        });
        if (this.mockMap.has(absolutePath)) {
          const mock = this.mockMap.get(absolutePath)!;
          resource.request = mock.replacementResource;
        }
      } catch (e) {
        // Ignore errors for virtual modules, built-ins, etc.
      }
    }).apply(compiler);

    compiler.hooks.afterCompile.tap(PLUGIN_NAME, (compilation) => {
      compilation.fileDependencies.add(this.options.previewConfigPath);

      for (const mock of this.mockMap.values()) {
        if (
          isAbsolute(mock.replacementResource) &&
          mock.replacementResource.includes('__mocks__')
        ) {
          compilation.contextDependencies.add(dirname(mock.replacementResource));
        }
      }
    });
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

    // Use extractMockCalls to get all mocks from the transformed preview file
    const mocks = extractMockCalls(
      { previewConfigPath, configDir: dirname(previewConfigPath) },
      babelParser,
      compiler.context
    );

    // 2. Resolve each mock call to its absolute path and replacement resource.
    const resolvedMocks: ResolvedMock[] = [];
    for (const mock of mocks) {
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
            'storybook/internal/core-server/presets/webpack/loaders/webpack-automock-loader'
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
}
