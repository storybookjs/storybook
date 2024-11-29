import React, { useMemo } from 'react';

// We need this import to be a singleton, and because it's used in multiple entrypoints
// both in ESM and CJS, importing it via the package name instead of having a local import
// is the only way to achieve it actually being a singleton
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { getRouter } from '@storybook/experimental-nextjs-vite/navigation.mock';

import type { FlightRouterState } from 'next/dist/server/app-render/types';
import {
  AppRouterContext,
  GlobalLayoutRouterContext,
  LayoutRouterContext,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  PathParamsContext,
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { PAGE_SEGMENT_KEY } from 'next/dist/shared/lib/segment';

import type { RouteParams } from './types';

// Using an inline type so we can support Next 14 and lower
// from https://github.com/vercel/next.js/blob/v15.0.3/packages/next/src/server/request/params.ts#L25
type Params = Record<string, string | Array<string> | undefined>;

type AppRouterProviderProps = {
  routeParams: RouteParams;
};

// Since Next 14.2.x
// https://github.com/vercel/next.js/pull/60708/files#diff-7b6239af735eba0c401e1a0db1a04dd4575c19a031934f02d128cf3ac813757bR106
function getSelectedParams(currentTree: FlightRouterState, params: Params = {}): Params {
  const parallelRoutes = currentTree[1];

  for (const parallelRoute of Object.values(parallelRoutes)) {
    const segment = parallelRoute[0];
    const isDynamicParameter = Array.isArray(segment);
    const segmentValue = isDynamicParameter ? segment[1] : segment;

    if (!segmentValue || segmentValue.startsWith(PAGE_SEGMENT_KEY)) {
      continue;
    }

    // Ensure catchAll and optional catchall are turned into an array

    // Ensure catchAll and optional catchall are turned into an array
    const isCatchAll = isDynamicParameter && (segment[2] === 'c' || segment[2] === 'oc');

    if (isCatchAll) {
      params[segment[0]] = segment[1].split('/');
    } else if (isDynamicParameter) {
      params[segment[0]] = segment[1];
    }

    params = getSelectedParams(parallelRoute, params);
  }

  return params;
}

const getParallelRoutes = (segmentsList: Array<string>): FlightRouterState => {
  const segment = segmentsList.shift();

  if (segment) {
    return [segment, { children: getParallelRoutes(segmentsList) }];
  }

  return [] as any;
};

export const AppRouterProvider: React.FC<React.PropsWithChildren<AppRouterProviderProps>> = ({
  children,
  routeParams,
}) => {
  const { pathname, query, segments = [] } = routeParams;

  const tree: FlightRouterState = [pathname, { children: getParallelRoutes([...segments]) }];
  const pathParams = useMemo(() => {
    return getSelectedParams(tree);
  }, [tree]);

  // https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/app-router.tsx#L436
  return (
    <PathParamsContext.Provider value={pathParams}>
      <PathnameContext.Provider value={pathname}>
        <SearchParamsContext.Provider value={new URLSearchParams(query)}>
          <GlobalLayoutRouterContext.Provider
            value={{
              changeByServerResponse() {
                // NOOP
              },
              buildId: 'storybook',
              tree,
              focusAndScrollRef: {
                apply: false,
                hashFragment: null,
                segmentPaths: [tree],
                onlyHashChange: false,
              },
              nextUrl: pathname,
            }}
          >
            <AppRouterContext.Provider value={getRouter()}>
              <LayoutRouterContext.Provider
                value={{
                  childNodes: new Map(),
                  loading: null,
                  tree,
                  url: pathname,
                }}
              >
                {children}
              </LayoutRouterContext.Provider>
            </AppRouterContext.Provider>
          </GlobalLayoutRouterContext.Provider>
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </PathParamsContext.Provider>
  );
};
