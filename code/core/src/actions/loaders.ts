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

      // Default name provided by vi.fn() under storybook/test's pinned @vitest/spy@3.2.4,
      // which we don't want to log. Vitest 4's own spy defaults to 'vi.fn()' instead.
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
