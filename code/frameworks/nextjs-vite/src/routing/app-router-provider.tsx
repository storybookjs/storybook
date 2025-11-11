import React, { useMemo } from 'react';

// We need this import to be a singleton, and because it's used in multiple entrypoints
// both in ESM and CJS, importing it via the package name instead of having a local import
// is the only way to achieve it actually being a singleton
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { getRouter } from '@storybook/nextjs-vite/navigation.mock';

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

import type { RouteParams } from './types';

// Using an inline type so we can support Next 14 and lower
// from https://github.com/vercel/next.js/blob/v15.0.3/packages/next/src/server/request/params.ts#L25
type Params = Record<string, string | Array<string> | undefined>;

type AppRouterProviderProps = {
  routeParams: RouteParams;
};

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
    const params: Params = {};
    const currentSegments = routeParams.segments;

    if (currentSegments) {
      if (Array.isArray(currentSegments)) {
        for (const segmentEntry of currentSegments) {
          if (
            Array.isArray(segmentEntry) &&
            segmentEntry.length === 2 &&
            typeof segmentEntry[0] === 'string'
          ) {
            const key: string = segmentEntry[0];
            const value = segmentEntry[1] as string | string[] | undefined;
            params[key] = value;
          }
        }
      } else if (typeof currentSegments === 'object' && !Array.isArray(currentSegments)) {
        const segmentObject = currentSegments as Record<string, string | string[] | undefined>;
        for (const key in segmentObject) {
          if (Object.prototype.hasOwnProperty.call(segmentObject, key)) {
            params[key] = segmentObject[key];
          }
        }
      }
    }
    return params;
  }, [routeParams.segments]);

  const newLazyCacheNode = {
    lazyData: null,
    rsc: null,
    prefetchRsc: null,
    head: null,
    prefetchHead: null,
    parallelRoutes: new Map(),
    loading: null,
  };

  // https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/app-router.tsx#L436
  return (
    <PathParamsContext.Provider value={pathParams}>
      <PathnameContext.Provider value={pathname}>
        <SearchParamsContext.Provider value={new URLSearchParams(query)}>
          <GlobalLayoutRouterContext.Provider
            value={{
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore (Only available in Next.js >= v15.1.1)
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
                  // TODO Remove when dropping Next.js < v15.1.1
                  childNodes: new Map(),
                  tree,
                  // TODO END

                  // START Next.js v15.2 support
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore Only available in Next.js >= v15.1.1
                  parentTree: tree,
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore Only available in Next.js >= v15.1.1
                  parentCacheNode: newLazyCacheNode,
                  // END
                  url: pathname,
                  loading: null,
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
