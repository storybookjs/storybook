import { dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractMockCalls, findMockRedirect } from 'storybook/internal/mocking-utils';
import type { MockCall } from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';

import { normalize } from 'pathe';
import type { Compiler, ResolveData } from 'webpack';

export interface WebpackMockPluginOptions {
  previewConfigPath: string;
}

const PLUGIN_NAME = 'storybook-mock-plugin';

const isBareSpecifier = (path: string) => !path.startsWith('.') && !isAbsolute(path);

export class WebpackMockPlugin {
  private mocksByPath = new Map<string, MockCall>();
  private mocksBySpecifier = new Map<string, MockCall>();
  private lastPreviewMtime: number | undefined;
  private readonly options: WebpackMockPluginOptions;

  constructor(options: WebpackMockPluginOptions) {
    if (!options.previewConfigPath) {
      throw new Error(`[${PLUGIN_NAME}] \`previewConfigPath\` is required.`);
    }
    this.options = options;
  }

  public apply(compiler: Compiler): void {
    const automockLoader = fileURLToPath(
      import.meta.resolve('@storybook/builder-webpack5/loaders/webpack-automock-loader')
    );

    const updateMocks = () => {
      const previewMtime = this.getPreviewConfigMtime(compiler);
      if (previewMtime !== undefined && previewMtime === this.lastPreviewMtime) {
        return;
      }
      const { previewConfigPath } = this.options;
      const mocks = extractMockCalls(
        { previewConfigPath, configDir: dirname(previewConfigPath) },
        compiler.context,
        findMockRedirect
      );
      this.mocksByPath = new Map(mocks.map((mock) => [mock.absolutePath, mock]));
      this.mocksBySpecifier = new Map(
        mocks.filter((mock) => isBareSpecifier(mock.path)).map((mock) => [mock.path, mock])
      );
      this.lastPreviewMtime = previewMtime;

      if (mocks.length > 0) {
        logger.info(`Mock map updated with ${mocks.length} mocks.`);
      }
    };

    compiler.hooks.beforeRun.tap(PLUGIN_NAME, updateMocks);
    compiler.hooks.watchRun.tap(PLUGIN_NAME, updateMocks);

    compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (factory) => {
      factory.hooks.afterResolve.tapAsync(PLUGIN_NAME, (resolveData, callback) => {
        const mock = this.findMock(resolveData.createData);
        if (!mock) {
          return callback();
        }
        if (!mock.redirectPath) {
          const { createData } = resolveData;
          const loader = { loader: automockLoader, options: `spy=${mock.spy}` };
          // Index 0 runs last, so the automock sees the output of the configured loaders.
          createData.loaders!.unshift(loader);
          createData.request = `${loader.loader}?${loader.options}!${createData.request}`;
          return callback();
        }
        // Resolving the mock file through webpack again gives it its own loaders and context.
        resolveData.request = mock.redirectPath;
        resolveData.context = dirname(mock.redirectPath);
        factory.hooks.resolve.callAsync(resolveData, (error) => callback(error));
      });
    });

    compiler.hooks.afterCompile.tap(PLUGIN_NAME, (compilation) => {
      compilation.fileDependencies.add(this.options.previewConfigPath);

      for (const mock of this.mocksByPath.values()) {
        if (mock.redirectPath && mock.redirectPath.includes('__mocks__')) {
          compilation.contextDependencies.add(dirname(mock.redirectPath));
        }
      }
    });
  }

  private findMock({ resourceResolveData, resource, rawRequest }: ResolveData['createData']) {
    if (this.mocksByPath.size === 0) {
      return undefined;
    }
    const path = resourceResolveData?.path;
    const resourcePath = normalize(typeof path === 'string' ? path : (resource ?? ''));
    return (
      this.mocksByPath.get(resourcePath) ??
      (rawRequest === undefined ? undefined : this.mocksBySpecifier.get(rawRequest))
    );
  }

  private getPreviewConfigMtime(compiler: Compiler): number | undefined {
    try {
      const fs = compiler.inputFileSystem as any;
      const stat = fs.statSync?.(this.options.previewConfigPath);
      return stat?.mtime?.getTime?.();
    } catch {
      return undefined;
    }
  }
}
