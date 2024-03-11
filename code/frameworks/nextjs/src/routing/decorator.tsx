import * as React from 'react';
import type { Addon_StoryContext } from '@storybook/types';
import { action } from '@storybook/addon-actions';
// @ts-expect-error Using absolute path import to 1) avoid prebundling and 2) being able to substitute the module for Next.js < 13
// eslint-disable-next-line import/no-extraneous-dependencies
import { AppRouterProvider } from '@storybook/nextjs/dist/routing/app-router-provider';
import { PageRouterProvider } from './page-router-provider';
import type { RouteParams, NextAppDirectory } from './types';

const defaultRouterParams: RouteParams = {
  pathname: '/',
  query: {},
};

export const RouterDecorator = (
  Story: React.FC,
  { globals, parameters }: Addon_StoryContext
): React.ReactNode => {
  const nextAppDirectory =
    (parameters.nextjs?.appDirectory as NextAppDirectory | undefined) ?? false;

  if (nextAppDirectory) {
    if (!AppRouterProvider) {
      return null;
    }
    return (
      <AppRouterProvider
        action={action}
        routeParams={{
          ...defaultRouterParams,
          ...parameters.nextjs?.navigation,
        }}
      >
        <Story />
      </AppRouterProvider>
    );
  }

  return (
    <PageRouterProvider
      action={action}
      globals={globals}
      routeParams={{
        ...defaultRouterParams,
        ...parameters.nextjs?.router,
      }}
    >
      <Story />
    </PageRouterProvider>
  );
};
