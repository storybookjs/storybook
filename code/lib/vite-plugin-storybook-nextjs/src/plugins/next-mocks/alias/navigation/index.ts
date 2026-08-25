import * as actual from 'next/dist/client/components/navigation.js';
import { RedirectStatusCode } from 'next/dist/client/components/redirect-status-code.js';
import { getRedirectError } from 'next/dist/client/components/redirect.js';
import { NextjsRouterMocksNotAvailable } from 'storybook/internal/preview-errors';
import { type Mock, fn } from 'storybook/test';

let navigationAPI: {
  push: Mock;
  replace: Mock;
  forward: Mock;
  back: Mock;
  prefetch: Mock;
  refresh: Mock;
};

/**
 * Creates a next/navigation router API mock. Used internally.
 * @ignore
 * @internal
 * */

type NavigationActions = typeof navigationAPI & Record<string, unknown>;
type RedirectType = Parameters<typeof getRedirectError>[1];

export const createNavigation = (overrides?: Record<string, (...params: unknown[]) => unknown>) => {
  const navigationActions: NavigationActions = {
    push: fn().mockName('next/navigation::useRouter().push'),
    replace: fn().mockName('next/navigation::useRouter().replace'),
    forward: fn().mockName('next/navigation::useRouter().forward'),
    back: fn().mockName('next/navigation::useRouter().back'),
    prefetch: fn().mockName('next/navigation::useRouter().prefetch'),
    refresh: fn().mockName('next/navigation::useRouter().refresh'),
  };

  if (overrides) {
    for (const key of Object.keys(navigationActions)) {
      if (key in overrides) {
        navigationActions[key] = fn((...args: unknown[]) => {
          return overrides[key](...args);
        }).mockName(`useRouter().${key}`);
      }
    }
  }

  navigationAPI = navigationActions;

  return navigationAPI;
};

export const getRouter = () => {
  if (!navigationAPI) {
    throw new NextjsRouterMocksNotAvailable({
      importType: 'next/navigation',
    });
  }

  return navigationAPI;
};

// re-exports of the actual module
export * from 'next/dist/client/components/navigation.js';

// That module is CommonJS, so the `export *` above only exists at runtime and is invisible
// to static ESM analysis. In dev Vite serves this mock as native ESM, where the browser
// rejects named imports it cannot see, hence the explicit re-exports.
// See https://github.com/storybookjs/storybook/issues/34688.
export {
  ReadonlyURLSearchParams,
  RedirectType,
  ServerInsertedHTMLContext,
} from 'next/dist/client/components/navigation.js';

// Newer than our minimum supported Next.js, hence via the namespace: that keeps the export
// statically declared but resolves to `undefined` on older releases instead of breaking
// resolution of the whole module.
export const forbidden: typeof actual.forbidden = actual.forbidden; // Next 15.1
export const unauthorized: typeof actual.unauthorized = actual.unauthorized; // Next 15.1
export const unstable_isUnrecognizedActionError: typeof actual.unstable_isUnrecognizedActionError =
  actual.unstable_isUnrecognizedActionError; // Next 15.5

// mock utilities/overrides (as of Next v14.2.0)
export const redirect = fn((url: string, type: RedirectType = 'push' as RedirectType): never => {
  throw getRedirectError(url, type, RedirectStatusCode.SeeOther);
}).mockName('next/navigation::redirect');

export const permanentRedirect = fn(
  (url: string, type: RedirectType = 'push' as RedirectType): never => {
    throw getRedirectError(url, type, RedirectStatusCode.SeeOther);
  }
).mockName('next/navigation::permanentRedirect');

// passthrough mocks - keep original implementation but allow for spying
export const useSearchParams = fn(actual.useSearchParams).mockName(
  'next/navigation::useSearchParams'
);
export const usePathname = fn(actual.usePathname).mockName('next/navigation::usePathname');
export const useSelectedLayoutSegment = fn(actual.useSelectedLayoutSegment).mockName(
  'next/navigation::useSelectedLayoutSegment'
);
export const useSelectedLayoutSegments = fn(actual.useSelectedLayoutSegments).mockName(
  'next/navigation::useSelectedLayoutSegments'
);
export const useRouter = fn(actual.useRouter).mockName('next/navigation::useRouter');
export const useServerInsertedHTML = fn(actual.useServerInsertedHTML).mockName(
  'next/navigation::useServerInsertedHTML'
);
export const notFound = fn(actual.notFound).mockName('next/navigation::notFound');
export const unstable_rethrow = fn(actual.unstable_rethrow).mockName(
  'next/navigation::unstable_rethrow'
);

// Params, not exported by Next.js, is manually declared to avoid inference issues.
interface Params {
  [key: string]: string | string[];
}
export const useParams = fn<() => Params>(actual.useParams).mockName('next/navigation::useParams');
