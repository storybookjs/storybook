/* eslint-disable no-underscore-dangle */
import type { LoaderFunction } from 'storybook/internal/types';

import { global } from '@storybook/global';
import type { onMockCall as onMockCallType } from '@storybook/test';

import { action } from './runtime';

let subscribed = false;

const logActionsWhenMockCalled: LoaderFunction = (context) => {
  const {
    parameters: { actions },
  } = context;
  if (actions?.disable) return;

  if (
    !subscribed &&
    '__STORYBOOK_TEST_ON_MOCK_CALL__' in global &&
    typeof global.__STORYBOOK_TEST_ON_MOCK_CALL__ === 'function'
  ) {
    const onMockCall = global.__STORYBOOK_TEST_ON_MOCK_CALL__ as typeof onMockCallType;
    onMockCall((mock, args) => {
      const name = mock.getMockName();
      if (name === 'spy') return;

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
