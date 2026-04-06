import type * as React from 'react';

import type { Addon_DecoratorFunction, LoaderFunction } from 'storybook/internal/types';

import type { ReactRenderer } from '@storybook/react';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { createNavigation } from '@storybook/nextjs-vite/navigation.mock';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { createRouter } from '@storybook/nextjs-vite/router.mock';

import { setupNextErrorPatching, parameters } from '@storybook/nextjs/preview-shared';

import { HeadManagerDecorator } from './head-manager/decorator.tsx';
import { ImageDecorator } from './images/decorator.tsx';
import { RouterDecorator } from './routing/decorator.tsx';
import { StyledJsxDecorator } from './styledJsx/decorator.tsx';

setupNextErrorPatching();

// Type assertion to handle the decorator type mismatch
const asDecorator = (decorator: (Story: React.FC, context?: any) => React.ReactNode) =>
  decorator as unknown as Addon_DecoratorFunction<ReactRenderer>;

export const decorators: Addon_DecoratorFunction<ReactRenderer>[] = [
  asDecorator(StyledJsxDecorator),
  asDecorator(ImageDecorator),
  asDecorator(RouterDecorator),
  asDecorator(HeadManagerDecorator),
];

export const loaders: LoaderFunction<ReactRenderer> = async ({ globals, parameters }) => {
  const { router, appDirectory } = parameters.nextjs ?? {};
  if (appDirectory) {
    createNavigation(router);
  } else {
    createRouter({
      locale: globals.locale,
      ...(router as Record<string, unknown>),
    });
  }
};

export { parameters };
