'use client';

import React, { type ReactNode, useMemo } from 'react';

import {
  type AppRouterActionQueue,
  publicAppRouterInstance,
} from 'next/dist/client/components/app-router-instance';
import { RedirectBoundary } from 'next/dist/client/components/redirect-boundary';
import { getSelectedParams } from 'next/dist/client/components/router-reducer/compute-changed-path';
import { createInitialRouterState } from 'next/dist/client/components/router-reducer/create-initial-router-state';
import { useActionQueue } from 'next/dist/client/components/use-action-queue';
import {
  type CacheNodeSeedData,
  type FlightDataPath,
  type FlightRouterState,
} from 'next/dist/server/app-render/types';
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

import { buildFlightRouterState } from './flight-router-state';

export const NextRouter = ({
  children,
  url = '/',
  route,
}: {
  children: ReactNode;
  route?: string;
  url?: string;
}) => {
  route ??= url;
  const location = new URL(url, 'http://localhost');

  const actionQueue: AppRouterActionQueue = {
    state: createInitialRouterState({
      navigatedAt: Date.now(),
      initialFlightData: createFlightData({
        initialTree: buildFlightRouterState(route, location.pathname, location.search),
        seedData: ['', children, {}, null, false],
        initialHead: null,
        isPossiblyPartialHead: false,
      }),
      initialCanonicalUrlParts: location.pathname.split('/'),
      initialParallelRoutes: new Map(),
      location: location as unknown as Location,
      couldBeIntercepted: false,
      postponed: false,
      prerendered: false,
    }),
    dispatch: (payload, setState) => {
      if (payload.type === 'navigate') {
        (globalThis as any).onNavigate(payload.url);
      }
    },
    action: async (state, action) => {
      throw new Error('action not implemented');
    },
    pending: null,
    last: null,
    onRouterTransitionStart: null,
  };
  return <AppRouter actionQueue={actionQueue}>{children}</AppRouter>;
};

function createFlightData(props: {
  initialTree: FlightRouterState;
  seedData: CacheNodeSeedData;
  initialHead: ReactNode | null;
  isPossiblyPartialHead: boolean;
}): FlightDataPath {
  return [[props.initialTree, props.seedData, props.initialHead, props.isPossiblyPartialHead]];
}

export function AppRouter({
  actionQueue,
  children,
}: {
  actionQueue: AppRouterActionQueue;
  children?: ReactNode;
}) {
  const { canonicalUrl, cache, tree, nextUrl, focusAndScrollRef } = useActionQueue(actionQueue);

  const { searchParams, pathname } = useMemo(() => {
    const url = new URL(canonicalUrl, 'http://localhost');
    return {
      searchParams: url.searchParams,
      pathname: url.pathname,
    };
  }, [canonicalUrl]);

  // Add memoized pathParams for useParams.
  const pathParams = useMemo(() => {
    return getSelectedParams(tree);
  }, [tree]);

  return (
    <>
      <PathParamsContext.Provider value={pathParams}>
        <PathnameContext.Provider value={pathname}>
          <SearchParamsContext.Provider value={searchParams}>
            <GlobalLayoutRouterContext.Provider value={{ tree, focusAndScrollRef, nextUrl }}>
              <AppRouterContext.Provider value={publicAppRouterInstance}>
                <LayoutRouterContext.Provider
                  value={{
                    parentTree: tree,
                    parentCacheNode: cache,
                    url: canonicalUrl,
                    parentSegmentPath: null,
                  }}
                >
                  {/*<RedirectBoundary>{cache.rsc}</RedirectBoundary>*/}
                  <RedirectBoundary>{children}</RedirectBoundary>
                </LayoutRouterContext.Provider>
              </AppRouterContext.Provider>
            </GlobalLayoutRouterContext.Provider>
          </SearchParamsContext.Provider>
        </PathnameContext.Provider>
      </PathParamsContext.Provider>
    </>
  );
}
