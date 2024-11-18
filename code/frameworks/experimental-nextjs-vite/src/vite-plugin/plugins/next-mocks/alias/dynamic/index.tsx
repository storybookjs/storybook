// The MIT License (MIT)
// Copyright (c) 2024 Vercel, Inc.
// https://github.com/vercel/next.js/blob/main/packages/next/src/shared/lib/dynamic.tsx
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
import React from 'react';
import type { JSX } from 'react';

import Loadable from 'next/dist/shared/lib/loadable.shared-runtime.js';

type ComponentModule<P = Record<string, unknown>> = {
  default: React.ComponentType<P>;
};

export declare type LoaderComponent<P = Record<string, unknown>> = Promise<
  React.ComponentType<P> | ComponentModule<P>
>;

declare type Loader<P = Record<string, unknown>> = (() => LoaderComponent<P>) | LoaderComponent<P>;

type LoaderMap = { [module: string]: () => Loader<unknown> };

type LoadableGeneratedOptions = {
  webpack?(): unknown;
  modules?(): LoaderMap;
};

type DynamicOptionsLoadingProps = {
  error?: Error | null;
  isLoading?: boolean;
  pastDelay?: boolean;
  retry?: () => void;
  timedOut?: boolean;
};

// Normalize loader to return the module as form { default: Component } for `React.lazy`.
// Also for backward compatible since next/dynamic allows to resolve a component directly with loader
// Client component reference proxy need to be converted to a module.
function convertModule<P>(mod: React.ComponentType<P> | ComponentModule<P>) {
  return { default: (mod as ComponentModule<P>)?.default || mod };
}

type DynamicOptions<P = Record<string, unknown>> = LoadableGeneratedOptions & {
  loading?: (loadingProps: DynamicOptionsLoadingProps) => JSX.Element | null;
  loader?: Loader<P> | LoaderMap;
  loadableGenerated?: LoadableGeneratedOptions;
  ssr?: boolean;
};

type LoadableOptions<P = Record<string, unknown>> = DynamicOptions<P>;

type LoadableFn<P = Record<string, unknown>> = (opts: LoadableOptions<P>) => React.ComponentType<P>;

export function noSSR<P = Record<string, unknown>>(): React.ComponentType<P> {
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  throw new Error('noSSR is not implemented in Storybook');
}

/**
 * This function lets you dynamically import a component. It uses
 * [React.lazy()](https://react.dev/reference/react/lazy) with
 * [Suspense](https://react.dev/reference/react/Suspense) under the hood.
 *
 * Read more: [Next.js Docs:
 * `next/dynamic`](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading#nextdynamic)
 */
export default function dynamic<P = Record<string, unknown>>(
  dynamicOptions: DynamicOptions<P> | Loader<P>,
  options?: DynamicOptions<P>
): React.ComponentType<P> {
  const loadableFn = Loadable as LoadableFn<P>;
  if (options?.ssr === false) {
    delete options.ssr;
  }

  let loadableOptions: LoadableOptions<P> = {
    // A loading component is not required, so we default it
    loading: ({ error, isLoading, pastDelay }) => {
      if (!pastDelay) {
        return null;
      }
      if (process.env.NODE_ENV !== 'production') {
        if (isLoading) {
          return null;
        }
        if (error) {
          return (
            <p>
              {error.message}
              <br />
              {error.stack}
            </p>
          );
        }
      }
      return null;
    },
  };

  // Support for direct import(), eg: dynamic(import('../hello-world'))
  // Note that this is only kept for the edge case where someone is passing in a promise as first argument
  // The react-loadable babel plugin will turn dynamic(import('../hello-world')) into dynamic(() => import('../hello-world'))
  // To make sure we don't execute the import without rendering first
  if (dynamicOptions instanceof Promise) {
    loadableOptions.loader = () => dynamicOptions;
    // Support for having import as a function, eg: dynamic(() => import('../hello-world'))
  } else if (typeof dynamicOptions === 'function') {
    loadableOptions.loader = dynamicOptions;
    // Support for having first argument being options, eg: dynamic({loader: import('../hello-world')})
  } else if (typeof dynamicOptions === 'object') {
    loadableOptions = { ...loadableOptions, ...dynamicOptions };
  }

  // Support for passing options, eg: dynamic(import('../hello-world'), {loading: () => <p>Loading something</p>})
  loadableOptions = { ...loadableOptions, ...options };

  const loaderFn = loadableOptions.loader as () => LoaderComponent<P>;
  const loader = () =>
    loaderFn != null ? loaderFn().then(convertModule) : Promise.resolve(convertModule(() => null));

  // coming from build/babel/plugins/react-loadable-plugin.js
  if (loadableOptions.loadableGenerated) {
    loadableOptions = {
      ...loadableOptions,
      ...loadableOptions.loadableGenerated,
    };
    delete loadableOptions.loadableGenerated;
  }

  return loadableFn({ ...loadableOptions, loader: loader as Loader<P> });
}
