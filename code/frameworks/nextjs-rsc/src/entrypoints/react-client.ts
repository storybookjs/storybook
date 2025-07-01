import { fn } from 'storybook/test';

export { createRoot } from 'react-dom/client';
// @ts-expect-error no types
export { createFromReadableStream } from 'react-server-dom-webpack/client';
export { use } from 'react';

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

  // globalize so that it can be used both in rsc and client bundle
  globalThis.navigationAPI = navigationActions;

  return globalThis.navigationAPI;
};
