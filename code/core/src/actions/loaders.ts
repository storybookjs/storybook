import type { LoaderFunction } from 'storybook/internal/types';

import { onMockCall } from 'storybook/test/spy';

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

      if (name === 'spy') {
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
