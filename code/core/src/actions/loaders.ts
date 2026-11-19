import type { LoaderFunction } from 'storybook/internal/types';

import { onMockCall } from 'storybook/test';

import { action } from './runtime/index.ts';

let subscribed = false;

const logActionsWhenMockCalled: LoaderFunction = (context) => {
  const { parameters } = context;

  if (parameters?.actions?.disable) {
    return;
  }

  if (!subscribed) {
    onMockCall((mock, args) => {
      const name = mock.getMockName();

      // The default name of an unnamed `fn()`, which we don't want to log. This is also the
      // escape hatch to disable logging for specific spies: `mockName('')` falls back to it.
      if (name === 'vi.fn()') {
        return;
      }

      // TODO: Make this a configurable API in 8.2
      if (
        !/^next\/.*::/.test(name) ||
        [
          'next/router::useRouter()',
          'next/navigation::useRouter()',
          'next/navigation::redirect',
          'next/link::Link',
          'next/cache::',
          'next/headers::cookies().set',
          'next/headers::cookies().delete',
          'next/headers::headers().set',
          'next/headers::headers().delete',
        ].some((prefix) => name.startsWith(prefix))
      ) {
        action(name)(args);
      }
    });
    subscribed = true;
  }
};

export const loaders: LoaderFunction[] = [logActionsWhenMockCalled];
