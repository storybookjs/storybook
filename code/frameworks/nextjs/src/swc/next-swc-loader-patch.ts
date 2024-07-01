// THIS IS A PATCH over the original code from Next 14.0.0
// we use our own patch because we need to remove tracing from the original code
// which is not possible otherwise

/*
Copyright (c) 2017 The swc Project Developers
Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:
The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/

import type { NextConfig } from 'next';
import { isWasm, transform } from 'next/dist/build/swc';
import { getLoaderSWCOptions } from 'next/dist/build/swc/options';
import path, { isAbsolute } from 'path';

export interface SWCLoaderOptions {
  rootDir: string;
  isServer: boolean;
  pagesDir?: string;
  appDir?: string;
  hasReactRefresh: boolean;
  optimizeServerReact?: boolean;
  nextConfig: NextConfig;
  jsConfig: any;
  supportedBrowsers: string[] | undefined;
  swcCacheDir: string;
  serverComponents?: boolean;
  isReactServerLayer?: boolean;
}

const mockCurrentTraceSpan = {
  traceChild: (name: string) => mockCurrentTraceSpan,
  traceAsyncFn: async (fn: any) => fn(),
};

async function loaderTransform(this: any, parentTrace: any, source?: string, inputSourceMap?: any) {
  // Make the loader async
  const filename = this.resourcePath;

  const loaderOptions: SWCLoaderOptions = this.getOptions() || {};

  const {
    isServer,
    rootDir,
    pagesDir,
    appDir,
    hasReactRefresh,
    nextConfig,
    jsConfig,
    supportedBrowsers,
    swcCacheDir,
    serverComponents,
    isReactServerLayer,
  } = loaderOptions;
  const isPageFile = filename.startsWith(pagesDir);
  const relativeFilePathFromRoot = path.relative(rootDir, filename);

  const swcOptions = getLoaderSWCOptions({
    pagesDir,
    appDir,
    filename,
    isServer,
    isPageFile,
    development: this.mode === 'development',
    hasReactRefresh,
    modularizeImports: nextConfig?.modularizeImports,
    optimizePackageImports: nextConfig?.experimental?.optimizePackageImports,
    swcPlugins: nextConfig?.experimental?.swcPlugins,
    compilerOptions: nextConfig?.compiler,
    optimizeServerReact: nextConfig?.experimental?.optimizeServerReact,
    jsConfig,
    supportedBrowsers,
    swcCacheDir,
    relativeFilePathFromRoot,
    serverComponents,
    // @ts-expect-error Relevant for Next.js < 14.1
    // TODO: Remove this when Next.js < 14.1 is no longer supported
    isReactServerLayer,
  });

  const programmaticOptions = {
    ...swcOptions,
    filename,
    inputSourceMap:
      inputSourceMap && typeof inputSourceMap === 'object'
        ? JSON.stringify(inputSourceMap)
        : undefined,

    // Set the default sourcemap behavior based on Webpack's mapping flag,
    sourceMaps: this.sourceMap,
    inlineSourcesContent: this.sourceMap,

    // Ensure that Webpack will get a full absolute path in the sourcemap
    // so that it can properly map the module back to its internal cached
    // modules.
    sourceFileName: filename,
  };
  // Transpiles the broken syntax to the closest non-broken modern syntax.
  // E.g. it won't transpile parameter destructuring in Safari
  // which would break how we detect if the mount context property is used in the play function.
  programmaticOptions.env.bugfixes = true;

  if (!programmaticOptions.inputSourceMap) {
    delete programmaticOptions.inputSourceMap;
  }

  // auto detect development mode
  if (
    this.mode &&
    programmaticOptions.jsc &&
    programmaticOptions.jsc.transform &&
    programmaticOptions.jsc.transform.react &&
    !Object.prototype.hasOwnProperty.call(programmaticOptions.jsc.transform.react, 'development')
  ) {
    programmaticOptions.jsc.transform.react.development = this.mode === 'development';
  }

  const swcSpan = parentTrace.traceChild('next-swc-transform');
  return swcSpan.traceAsyncFn(() =>
    transform(source as any, programmaticOptions).then((output) => {
      if (output.eliminatedPackages && this.eliminatedPackages) {
        for (const pkg of JSON.parse(output.eliminatedPackages)) {
          this.eliminatedPackages.add(pkg);
        }
      }
      return [output.code, output.map ? JSON.parse(output.map) : undefined];
    })
  );
}

const EXCLUDED_PATHS = /[\\/](cache[\\/][^\\/]+\.zip[\\/]node_modules|__virtual__)[\\/]/g;

export function pitch(this: any) {
  const callback = this.async();
  (async () => {
    if (
      // TODO: investigate swc file reading in PnP mode?
      !process.versions.pnp &&
      !EXCLUDED_PATHS.test(this.resourcePath) &&
      this.loaders.length - 1 === this.loaderIndex &&
      isAbsolute(this.resourcePath) &&
      !(await isWasm())
    ) {
      const loaderSpan = mockCurrentTraceSpan.traceChild('next-swc-loader');
      this.addDependency(this.resourcePath);
      return loaderSpan.traceAsyncFn(() => loaderTransform.call(this, loaderSpan));
    }

    return null;
  })().then((r) => {
    if (r) return callback(null, ...r);
    callback();
    return null;
  }, callback);
}

export default function swcLoader(this: any, inputSource: string, inputSourceMap: any) {
  const loaderSpan = mockCurrentTraceSpan.traceChild('next-swc-loader');
  const callback = this.async();
  loaderSpan
    .traceAsyncFn(() => loaderTransform.call(this, loaderSpan, inputSource, inputSourceMap))
    .then(
      ([transformedSource, outputSourceMap]: any) => {
        callback(null, transformedSource, outputSourceMap || inputSourceMap);
      },
      (err: Error) => {
        callback(err);
      }
    );
}

// accept Buffers instead of strings
export const raw = true;
