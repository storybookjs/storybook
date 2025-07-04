import { NextjsRouterMocksNotAvailable } from 'storybook/internal/preview-errors';

import * as actual from 'next/dist/client/components/navigation.js';
import { getRedirectError } from 'next/dist/client/components/redirect';
import { RedirectStatusCode } from 'next/dist/client/components/redirect-status-code';
import type { Mock } from 'storybook/test';
import { fn } from 'storybook/test';

declare global {
  // eslint-disable-next-line no-var
  var navigationAPI: {
    push: Mock;
    replace: Mock;
    forward: Mock;
    back: Mock;
    prefetch: Mock;
    refresh: Mock;
  };
}

export const getRouter = () => {
  if (!globalThis.navigationAPI) {
    throw new NextjsRouterMocksNotAvailable({
      importType: 'next/navigation',
    });
  }

  return globalThis.navigationAPI;
};

// re-exports of the actual module
export * from 'next/dist/client/components/navigation.js';

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
export const useParams = fn<() => Params>(actual.useParams).mockName('next/navigation::useParams');
