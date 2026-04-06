import type { Addon_DecoratorFunction, Addon_LoaderFunction } from 'storybook/internal/types';

// We need this import to be a singleton, and because it's used in multiple entrypoints
// both in ESM and CJS, importing it via the package name instead of having a local import
// is the only way to achieve it actually being a singleton
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { createNavigation } from '@storybook/nextjs/navigation.mock';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { createRouter } from '@storybook/nextjs/router.mock';

import { HeadManagerDecorator } from './head-manager/decorator.tsx';
import { ImageDecorator } from './images/decorator.tsx';
import { setupNextErrorPatching, parameters } from './preview-shared.ts';
import { RouterDecorator } from './routing/decorator.tsx';
import { StyledJsxDecorator } from './styledJsx/decorator.tsx';

setupNextErrorPatching();

export const decorators: Addon_DecoratorFunction<any>[] = [
  StyledJsxDecorator,
  ImageDecorator,
  RouterDecorator,
  HeadManagerDecorator,
];

export const loaders: Addon_LoaderFunction = async ({ globals, parameters }) => {
  const { router, appDirectory } = parameters.nextjs ?? {};
  if (appDirectory) {
    createNavigation(router);
  } else {
    createRouter({
      locale: globals.locale,
      ...router,
    });
  }
};

export { parameters };
