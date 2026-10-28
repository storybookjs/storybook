import { readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractMockCalls,
  findMockRedirect,
  getIsExternal,
  resolveExternalModule,
  resolveWithExtensions,
} from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';

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

const RELATIVE_REQUEST = /^\.\.?(?:[/\\]|$)/;

// Resolution can add extensions, index files or package entry points to these prefixes.
function getRequestPaths(path: string): string[] {
  const paths = [path];
  for (let index = 1; index < path.length; index++) {
    if (
      (path[index] === '.' && path[index - 1] !== '/' && path[index - 1] !== sep) ||
      path[index] === '/' ||
      path[index] === sep
    ) {
      paths.push(path.slice(0, index));
    }
  }
  return paths;
}

function getPackageNames(dir: string): string[] {
  const names: string[] = [];
  for (let current = dir; ; current = dirname(current)) {
    try {
      const { name } = JSON.parse(readFileSync(join(current, 'package.json'), 'utf-8'));
      if (typeof name === 'string') {
        names.push(name);
      }
    } catch {
      // No package.json, or not one we can read.
    }
    if (dirname(current) === current) {
      return names;
    }
  }
}

function getPackageName(request: string): string {
  const [first, second] = request.split('/');
  return first.startsWith('@') && second ? `${first}/${second}` : first;
}

/**
 * A Webpack plugin that enables module mocking for Storybook. It scans the preview config for
 * `sb.mock()` calls and uses Webpack's NormalModuleReplacementPlugin to substitute the original
 * modules with mocks.
 */
export class WebpackMockPlugin {
  private readonly options: WebpackMockPluginOptions;
  private mockMap: Map<string, ResolvedMock> = new Map();
  private candidateSpecifiers: Set<string> = new Set();
  private mockRequestPaths: Set<string> = new Set();
  private mockPackageNames: Set<string> = new Set();
  private realDirectories: Map<string, string> = new Map();
  private lastPreviewMtime: number | undefined;

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
    // This function will be called to update the mock map before each compilation.
    const updateMocks = () => {
      this.realDirectories.clear();
      const mTimePreviewConfig = this.getPreviewConfigMtime(compiler);
      if (
        this.lastPreviewMtime !== undefined &&
        mTimePreviewConfig !== undefined &&
        mTimePreviewConfig === this.lastPreviewMtime
      ) {
        return; // unchanged
      }
      const resolved = this.extractAndResolveMocks(compiler);
      this.mockMap = new Map(
        resolved.flatMap((mock) => [
          [mock.absolutePath, mock],
          [mock.absolutePath.replace(/\.[^.]+$/, ''), mock],
        ])
      );
      this.candidateSpecifiers = new Set(resolved.map((m) => m.path));
      this.mockRequestPaths = new Set(
        // Convert to platform separators to match resolve(context, request) in canResolveToMock.
        resolved.flatMap((mock) => getRequestPaths(resolve(mock.absolutePath)))
      );
      this.mockPackageNames = new Set(
        resolved.flatMap((mock) => getPackageNames(dirname(mock.absolutePath)))
      );
      this.lastPreviewMtime = mTimePreviewConfig;

      if (resolved.length > 0) {
        logger.info(`Mock map updated with ${resolved.length} mocks.`);
      }
    };

    compiler.hooks.beforeRun.tap(PLUGIN_NAME, updateMocks); // for build
    compiler.hooks.watchRun.tap(PLUGIN_NAME, updateMocks); // for dev

    // Apply the replacement plugin. Its callback will now use the dynamically updated mockMap.
    new compiler.webpack.NormalModuleReplacementPlugin(/.*/, (resource) => {
      try {
        // The plugin also calls back after resolution, when a new request has no effect.
        if (resource.createData.resource) {
          return;
        }
        const mock = this.findMock(resource.request, resource.context);
        if (mock) {
          resource.request = mock.replacementResource;
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

  private findMock(request: string, context: string): ResolvedMock | undefined {
    if (this.mockMap.size === 0 || !this.canResolveToMock(request, context)) {
      return;
    }
    const isExternal = getIsExternal(request, context);
    // Early filter only for external specifiers. Relative/local specifiers need resolution
    if (isExternal && !this.candidateSpecifiers.has(request)) {
      return;
    }
    const absolutePath = isExternal
      ? resolveExternalModule(request, context)
      : resolveWithExtensions(request, context);
    return this.mockMap.get(absolutePath);
  }

  // Heuristic run before require.resolve. It skips these cases, which full resolution would mock:
  // an imported file or directory that is itself a symlink; a directory whose package.json
  // main points outside it; a bare request through a link or npm: alias whose name differs
  // from the package's name; or a request resolved only through NODE_PATH.
  private canResolveToMock(request: string, context: string): boolean {
    if (RELATIVE_REQUEST.test(request) || isAbsolute(request)) {
      // `require.resolve` joins the request to the context and then follows symlinks, unless Node
      // runs with `--preserve-symlinks`, so accept the joined path both as written and with
      // symlinks in its directory followed.
      const path = resolve(context, request);
      return (
        this.mockRequestPaths.has(path) ||
        this.mockRequestPaths.has(join(this.getRealDirectory(dirname(path)), basename(path)))
      );
    }
    return (
      this.candidateSpecifiers.has(request) || this.mockPackageNames.has(getPackageName(request))
    );
  }

  private getRealDirectory(directory: string): string {
    let realDirectory = this.realDirectories.get(directory);
    if (realDirectory === undefined) {
      try {
        realDirectory = realpathSync(directory);
      } catch {
        realDirectory = directory;
      }
      this.realDirectories.set(directory, realDirectory);
    }
    return realDirectory;
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
