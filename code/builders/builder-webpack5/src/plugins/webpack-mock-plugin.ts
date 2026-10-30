import { fileURLToPath } from 'node:url';

import { extractMockCalls, findMockRedirect } from 'storybook/internal/mocking-utils';
import type { MockCall } from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';

import { dirname, normalize } from 'pathe';
import type { Compiler, ResolveData, Resolver } from 'webpack';

export interface WebpackMockPluginOptions {
  previewConfigPath: string;
}

const PLUGIN_NAME = 'storybook-mock-plugin';

export class WebpackMockPlugin {
  private mocksByPath = new Map<string, MockCall>();
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

    const updateMocks = async () => {
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
      // Mocks resolve through webpack's resolver so that aliases, symlink handling and package
      // conditions match the resolution of the imports they are compared against.
      const resolver = compiler.resolverFactory.get('normal', { dependencyType: 'esm' });
      const paths = await Promise.all(
        mocks.map((mock) => resolveWithWebpack(resolver, dirname(previewConfigPath), mock))
      );
      this.mocksByPath = new Map(mocks.map((mock, index) => [normalize(paths[index]), mock]));
      this.lastPreviewMtime = previewMtime;

      if (mocks.length > 0) {
        logger.info(`Mock map updated with ${mocks.length} mocks.`);
      }
    };

    compiler.hooks.beforeRun.tapPromise(PLUGIN_NAME, updateMocks);
    compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, updateMocks);

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

  private findMock({ resourceResolveData, resource }: ResolveData['createData']) {
    if (this.mocksByPath.size === 0) {
      return undefined;
    }
    const path = resourceResolveData?.path;
    return this.mocksByPath.get(normalize(typeof path === 'string' ? path : (resource ?? '')));
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

function resolveWithWebpack(resolver: Resolver, context: string, mock: MockCall) {
  return new Promise<string>((resolve) => {
    resolver.resolve({}, context, mock.specifier, {}, (error, _result, request) => {
      const path = request?.path;
      resolve(!error && typeof path === 'string' ? path : mock.absolutePath);
    });
  });
}
