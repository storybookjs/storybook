import { dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  babelParser,
  extractMockCalls,
  getIsExternal,
  resolveExternalModule,
  resolveWithExtensions,
} from 'storybook/internal/mocking-utils';

import { findMockRedirect } from '@vitest/mocker/redirect';
import type { Compiler } from 'webpack';

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
        this.extractAndResolveMocks(compiler).flatMap((mock) => [
          // first one, full path
          [mock.absolutePath, mock],
          // second one, without the extension
          [mock.absolutePath.replace(/\.[^.]+$/, ''), mock],
        ])
      );
      // divide by 2 because we add both the full path and the path without the extension
      logger.info(`Mock map updated with ${this.mockMap.size / 2} mocks.`);
    };

    compiler.hooks.beforeRun.tap(PLUGIN_NAME, updateMocks); // for build
    compiler.hooks.watchRun.tap(PLUGIN_NAME, updateMocks); // for dev

    // Apply the replacement plugin. Its callback will now use the dynamically updated mockMap.
    new compiler.webpack.NormalModuleReplacementPlugin(/.*/, (resource) => {
      try {
        const path = resource.request;
        const importer = resource.context;

        const isExternal = getIsExternal(path, importer);
        const absolutePath = isExternal
          ? resolveExternalModule(path, importer)
          : resolveWithExtensions(path, importer);

        if (this.mockMap.has(absolutePath)) {
          resource.request = this.mockMap.get(absolutePath)!.replacementResource;
        }
      } catch (e) {
        logger.debug(`Could not resolve mock for "${resource.request}".`);
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
      compiler.context,
      findMockRedirect
    );

    // 2. Resolve each mock call to its absolute path and replacement resource.
    const resolvedMocks: ResolvedMock[] = [];
    for (const mock of mocks) {
      try {
        const { absolutePath, redirectPath } = mock;

        let replacementResource: string;

        if (redirectPath) {
          // A `__mocks__` file exists. Use it directly as the replacement.
          replacementResource = redirectPath;
        } else {
          // No `__mocks__` file found. Use our custom loader to automock the module.
          const loaderPath = fileURLToPath(
            import.meta.resolve('@storybook/builder-webpack5/loaders/webpack-automock-loader')
          );
          replacementResource = `${loaderPath}?spy=${mock.spy}!${absolutePath}`;
        }

        resolvedMocks.push({
          ...mock,
          replacementResource,
        });
      } catch (e) {
        logger.warn(`Could not resolve mock for "${mock.path}". It will be ignored.`);
      }
    }

    return resolvedMocks;
  }
}
