import { fileURLToPath } from 'node:url';

import { extractMockCalls, findMockRedirect } from 'storybook/internal/mocking-utils';
import type { MockCall } from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';

import { dirname, isAbsolute, normalize } from 'pathe';
import type { Compiler, ResolveData, Resolver } from 'webpack';

export interface WebpackMockPluginOptions {
  previewConfigPath: string;
}

const PLUGIN_NAME = 'storybook-mock-plugin';

const isBareSpecifier = (specifier: string) => !specifier.startsWith('.') && !isAbsolute(specifier);

export class WebpackMockPlugin {
  private mocksByPath = new Map<string, MockCall>();
  private redirectsBySpecifier = new Map<string, string>();
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
      const previewDir = dirname(previewConfigPath);
      const mocks = extractMockCalls(
        { previewConfigPath, configDir: previewDir },
        compiler.context,
        findMockRedirect
      );
      // Mocks resolve through webpack's resolver so that aliases, symlink handling and package
      // conditions match the resolution of the imports they are compared against. A dual package
      // can resolve to one file for `import` and another for `require`, so both are keyed.
      const resolvers = ['esm', 'commonjs'].map((dependencyType) =>
        compiler.resolverFactory.get('normal', { dependencyType })
      );
      this.mocksByPath = new Map();
      this.redirectsBySpecifier = new Map();
      for (const mock of mocks) {
        if (mock.redirectPath && isBareSpecifier(mock.specifier)) {
          this.redirectsBySpecifier.set(mock.specifier, mock.redirectPath);
        }
        const paths = await Promise.all(
          resolvers.map((resolver) => resolveWithWebpack(resolver, previewDir, mock.specifier))
        );
        const resolved = paths.filter((path): path is string => path !== undefined);
        if (resolved.length === 0 && !this.redirectsBySpecifier.has(mock.specifier)) {
          logger.warn(
            `Could not resolve "${mock.specifier}" from ${previewDir}, so its sb.mock() call is ignored.`
          );
        }
        for (const path of resolved) {
          this.mocksByPath.set(normalize(path), mock);
        }
      }
      this.lastPreviewMtime = previewMtime;

      if (mocks.length > 0) {
        logger.info(`Mock map updated with ${mocks.length} mocks.`);
      }
    };

    compiler.hooks.beforeRun.tapPromise(PLUGIN_NAME, updateMocks);
    compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, updateMocks);

    compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (factory) => {
      // A package the browser build cannot resolve, such as one with a server-only `exports` map,
      // still needs its manual mock, so a bare request is redirected before resolution.
      factory.hooks.beforeResolve.tap(PLUGIN_NAME, (resolveData) => {
        const redirectPath = this.redirectsBySpecifier.get(resolveData.request);
        if (redirectPath) {
          resolveData.request = redirectPath;
          resolveData.context = dirname(redirectPath);
        }
      });

      factory.hooks.afterResolve.tapAsync(PLUGIN_NAME, (resolveData, callback) => {
        const mock = this.findMock(resolveData.createData);
        if (!mock) {
          return callback();
        }
        // Resolving the replacement through webpack again gives a `__mocks__` file its own loaders
        // and context, and places the inline automock loader between the post and normal loaders.
        if (mock.redirectPath) {
          resolveData.request = mock.redirectPath;
          resolveData.context = dirname(mock.redirectPath);
        } else {
          resolveData.request = `${automockLoader}?spy=${mock.spy}!${resolveData.createData.resource}`;
        }
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

function resolveWithWebpack(resolver: Resolver, context: string, specifier: string) {
  return new Promise<string | undefined>((resolve) => {
    resolver.resolve({}, context, specifier, {}, (error, _result, request) => {
      const path = request?.path;
      resolve(!error && typeof path === 'string' ? path : undefined);
    });
  });
}
