import type { LoaderFunction } from 'storybook/internal/types';

import { onMockCall } from 'storybook/test';

import { action } from './runtime';

let subscribed = false;

const logActionsWhenMockCalled: LoaderFunction = (context) => {
  const { parameters } = context;

  if (parameters?.actions?.disable) {
    return;
  }

  if (!subscribed) {
    onMockCall((mock, args) => {
      const name = mock.getMockName();

      // Default name provided by vi.fn(), which we don't want to log.
      // TODO: Can be removed as soon as we drop Vitest 3 support
      // https://main.vitest.dev/guide/migration.html#changes-to-mocking
      if (name === 'spy') {
        return;
      }

      // Escape hatch allowing users to disable logging for specific spies.
      // This is what Vitest sets when you pass `mockName('')` to a spy.
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
