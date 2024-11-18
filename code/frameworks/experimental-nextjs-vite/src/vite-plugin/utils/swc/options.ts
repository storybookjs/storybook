// The MIT License (MIT)
// Copyright (c) 2024 Vercel, Inc.
// https://github.com/vercel/next.js/blob/canary/packages/next/src/build/swc/options.ts
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
import { createRequire } from 'node:module';

import type { NextConfig } from 'next';
import type { JsConfig, ResolvedBaseUrl } from 'next/dist/build/load-jsconfig.js';
import { getParserOptions } from 'next/dist/build/swc/options.js';
import type { ExperimentalConfig } from 'next/dist/server/config-shared.js';

import { getEmotionOptions, getStyledComponentsOptions } from './styles';

const requirePackage = require || createRequire(import.meta.url);

const regeneratorRuntimePath = requirePackage.resolve('next/dist/compiled/regenerator-runtime');

export function getBaseSWCOptions({
  filename,
  development,
  hasReactRefresh,
  globalWindow,
  esm,
  modularizeImports,
  swcPlugins,
  compiler,
  resolvedBaseUrl,
  jsConfig,
  swcCacheDir,
}: {
  filename: string;
  development: boolean;
  hasReactRefresh: boolean;
  globalWindow: boolean;
  esm: boolean;
  modularizeImports?: NextConfig['modularizeImports'];
  compiler: NextConfig['compiler'];
  swcPlugins: ExperimentalConfig['swcPlugins'];
  resolvedBaseUrl?: ResolvedBaseUrl;
  jsConfig: JsConfig;
  swcCacheDir?: string;
}) {
  const parserConfig = getParserOptions({ filename, jsConfig });
  const paths = jsConfig?.compilerOptions?.paths;
  const enableDecorators = Boolean(jsConfig?.compilerOptions?.experimentalDecorators);
  const emitDecoratorMetadata = Boolean(jsConfig?.compilerOptions?.emitDecoratorMetadata);
  const useDefineForClassFields = Boolean(jsConfig?.compilerOptions?.useDefineForClassFields);
  const plugins = (swcPlugins ?? [])
    .filter(Array.isArray)
    .map(([name, options]) => [requirePackage.resolve(name), options]);

  return {
    jsc: {
      ...(resolvedBaseUrl && paths
        ? {
            baseUrl: resolvedBaseUrl.baseUrl,
            paths,
          }
        : {}),
      externalHelpers: false,
      parser: parserConfig,
      experimental: {
        keepImportAttributes: true,
        emitAssertForImportAttributes: true,
        plugins,
        cacheRoot: swcCacheDir,
      },
      transform: {
        legacyDecorator: enableDecorators,
        decoratorMetadata: emitDecoratorMetadata,
        useDefineForClassFields: useDefineForClassFields,
        react: {
          importSource:
            jsConfig?.compilerOptions?.jsxImportSource ??
            (compiler?.emotion ? '@emotion/react' : 'react'),
          runtime: 'automatic',
          pragmaFrag: 'React.Fragment',
          throwIfNamespace: true,
          development: !!development,
          useBuiltins: true,
          refresh: !!hasReactRefresh,
        },
        optimizer: {
          simplify: false,
          // TODO: Figuring out for what globals are exactly used for
          globals: {
            typeofs: {
              window: globalWindow ? 'object' : 'undefined',
            },
            envs: {
              NODE_ENV: development ? '"development"' : '"production"',
            },
          },
        },
        regenerator: {
          importPath: regeneratorRuntimePath,
        },
      },
    },
    sourceMaps: true,
    removeConsole: compiler?.removeConsole,
    reactRemoveProperties: false,
    // Map the k-v map to an array of pairs.
    modularizeImports: modularizeImports
      ? Object.fromEntries(
          Object.entries(modularizeImports).map(([mod, config]) => [
            mod,
            {
              ...config,
              transform:
                typeof config.transform === 'string'
                  ? config.transform
                  : Object.entries(config.transform).map(([key, value]) => [key, value]),
            },
          ])
        )
      : undefined,
    relay: compiler?.relay,
    // Always transform styled-jsx and error when `client-only` condition is triggered
    styledJsx: {},
    // Disable css-in-js libs (without client-only integration) transform on server layer for server components
    emotion: getEmotionOptions(compiler?.emotion, development),

    styledComponents: getStyledComponentsOptions(compiler?.styledComponents, development),
    serverComponents: undefined,
    serverActions: undefined,
    // For app router we prefer to bundle ESM,
    // On server side of pages router we prefer CJS.
    preferEsm: esm,
  };
}
