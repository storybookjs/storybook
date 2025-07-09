import { NextjsRouterMocksNotAvailable } from 'storybook/internal/preview-errors';

import * as actual from 'next/dist/client/components/navigation.react-server.js';
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
export * from 'next/dist/client/components/navigation.react-server.js';

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

export const notFound = fn(actual.notFound).mockName('next/navigation::notFound');
