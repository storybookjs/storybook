import { NextjsRouterMocksNotAvailable } from 'storybook/internal/preview-errors';

import type { Mock } from '@storybook/test';
import { fn } from '@storybook/test';

import * as actual from 'next/dist/client/components/navigation';
import { getRedirectError } from 'next/dist/client/components/redirect';
import { RedirectStatusCode } from 'next/dist/client/components/redirect-status-code';

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
 *
 * @ignore
 * @internal
 */
export const createNavigation = (overrides: any) => {
  const navigationActions = {
    push: fn().mockName('next/navigation::useRouter().push'),
    replace: fn().mockName('next/navigation::useRouter().replace'),
    forward: fn().mockName('next/navigation::useRouter().forward'),
    back: fn().mockName('next/navigation::useRouter().back'),
    prefetch: fn().mockName('next/navigation::useRouter().prefetch'),
    refresh: fn().mockName('next/navigation::useRouter().refresh'),
  };

  if (overrides) {
    Object.keys(navigationActions).forEach((key) => {
      if (key in overrides) {
        (navigationActions as any)[key] = fn((...args: any[]) => {
          return (overrides as any)[key](...args);
        }).mockName(`useRouter().${key}`);
      }
    });
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
export * from 'next/dist/client/components/navigation';

// mock utilities/overrides (as of Next v14.2.0)
export const redirect = fn(
  (url: string, type: actual.RedirectType = actual.RedirectType.push): never => {
    throw getRedirectError(url, type, RedirectStatusCode.SeeOther);
  }
).mockName('next/navigation::redirect');

export const permanentRedirect = fn(
  (url: string, type: actual.RedirectType = actual.RedirectType.push): never => {
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

// Params, not exported by Next.js, is manually declared to avoid inference issues.
interface Params {
  [key: string]: string | string[];
}
export const useParams = fn<[], Params>(actual.useParams).mockName('next/navigation::useParams');
