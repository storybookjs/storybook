import { NextjsRouterMocksNotAvailable } from 'storybook/internal/preview-errors';

import type { Mock } from '@storybook/test';
import { fn } from '@storybook/test';

import singletonRouter, * as originalRouter from 'next/dist/client/router';
import type { NextRouter, SingletonRouter } from 'next/router';

const defaultRouterState = {
  route: '/',
  asPath: '/',
  basePath: '/',
  pathname: '/',
  query: {},
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
};

let routerAPI: {
  push: Mock;
  replace: Mock;
  reload: Mock;
  back: Mock;
  forward: Mock;
  prefetch: Mock;
  beforePopState: Mock;
  events: {
    on: Mock;
    off: Mock;
    emit: Mock;
  };
} & typeof defaultRouterState;

/**
 * Creates a next/router router API mock. Used internally.
 * @ignore
 * @internal
 * */
export const createRouter = (overrides: Partial<NextRouter>) => {
  const routerActions: Partial<NextRouter> = {
    push: fn((..._args: any[]) => {
      return Promise.resolve(true);
    }).mockName('next/router::useRouter().push'),
    replace: fn((..._args: any[]) => {
      return Promise.resolve(true);
    }).mockName('next/router::useRouter().replace'),
    reload: fn((..._args: any[]) => {}).mockName('next/router::useRouter().reload'),
    back: fn((..._args: any[]) => {}).mockName('next/router::useRouter().back'),
    forward: fn(() => {}).mockName('next/router::useRouter().forward'),
    prefetch: fn((..._args: any[]) => {
      return Promise.resolve();
    }).mockName('next/router::useRouter().prefetch'),
    beforePopState: fn((..._args: any[]) => {}).mockName('next/router::useRouter().beforePopState'),
  };

  const routerEvents: NextRouter['events'] = {
    on: fn((..._args: any[]) => {}).mockName('next/router::useRouter().events.on'),
    off: fn((..._args: any[]) => {}).mockName('next/router::useRouter().events.off'),
    emit: fn((..._args: any[]) => {}).mockName('next/router::useRouter().events.emit'),
  };

  if (overrides) {
    Object.keys(routerActions).forEach((key) => {
      if (key in overrides) {
        (routerActions as any)[key] = fn((...args: any[]) => {
          return (overrides as any)[key](...args);
        }).mockName(`useRouter().${key}`);
      }
    });
  }

  if (overrides?.events) {
    Object.keys(routerEvents).forEach((key) => {
      if (key in routerEvents) {
        (routerEvents as any)[key] = fn((...args: any[]) => {
          return (overrides.events as any)[key](...args);
        }).mockName(`useRouter().events.${key}`);
      }
    });
  }

  routerAPI = {
    ...defaultRouterState,
    ...overrides,
    ...routerActions,
    // @ts-expect-error TODO improve typings
    events: routerEvents,
  };

  // overwrite the singleton router from next/router
  (singletonRouter as unknown as SingletonRouter).router = routerAPI as any;
  (singletonRouter as unknown as SingletonRouter).readyCallbacks.forEach((cb) => cb());
  (singletonRouter as unknown as SingletonRouter).readyCallbacks = [];

  return routerAPI as unknown as NextRouter;
};

export const getRouter = () => {
  if (!routerAPI) {
    throw new NextjsRouterMocksNotAvailable({
      importType: 'next/router',
    });
  }

  return routerAPI;
};

// re-exports of the actual module
export * from 'next/dist/client/router';
export default singletonRouter;

// mock utilities/overrides (as of Next v14.2.0)
// passthrough mocks - keep original implementation but allow for spying
export const useRouter = fn(originalRouter.useRouter).mockName('next/router::useRouter');
export const withRouter = fn(originalRouter.withRouter).mockName('next/router::withRouter');
