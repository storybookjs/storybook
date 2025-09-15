import * as React from 'react';

import type { DecoratorFunction, LegacyStoryFn, LoaderFunction } from 'storybook/internal/types';
import { type RenderContext } from 'storybook/internal/types';

import type { Decorator, Preview, ReactRenderer } from '@storybook/react';

import { NextRouter } from '@storybook/nextjs-vite-rsc/rsc/client';

import { isNextRouterError } from 'next/dist/client/components/is-next-router-error';
import { defaultDecorateStory } from 'storybook/preview-api';

import { initialize, renderServer } from './testing-library';

// TODO renable
// import './config/preview';
// import { HeadManagerDecorator } from './head-manager/decorator';
// import { ImageDecorator } from './images/decorator';
// import { StyledJsxDecorator } from './styledJsx/decorator';

function addNextHeadCount() {
  const meta = document.createElement('meta');
  meta.name = 'next-head-count';
  meta.content = '0';
  document.head.appendChild(meta);
}

function isAsyncClientComponentError(error: unknown) {
  return (
    typeof error === 'string' &&
    (error.includes('Only Server Components can be async at the moment.') ||
      error.includes('A component was suspended by an uncached promise.') ||
      error.includes('async/await is not yet supported in Client Components'))
  );
}
addNextHeadCount();

// Copying Next patch of console.error:
// https://github.com/vercel/next.js/blob/a74deb63e310df473583ab6f7c1783bc609ca236/packages/next/src/client/app-index.tsx#L15
const origConsoleError = globalThis.console.error;
globalThis.console.error = (...args: unknown[]) => {
  const error = args[0];
  if (isNextRouterError(error) || isAsyncClientComponentError(error)) {
    return;
  }
  origConsoleError.apply(globalThis.console, args);
};

globalThis.addEventListener('error', (ev: WindowEventMap['error']): void => {
  if (isNextRouterError(ev.error) || isAsyncClientComponentError(ev.error)) {
    ev.preventDefault();
    return;
  }
});

export const decorators: Decorator[] = [
  (Story, context) => (
    <NextRouter>
      <Story />
    </NextRouter>
  ),
  // TODO
  // StyledJsxDecorator,
  // ImageDecorator,
  // HeadManagerDecorator,
];

export const loaders: LoaderFunction<ReactRenderer> = async ({ globals, parameters }) => {
  initialize({ rootOptions: parameters.react?.rootOptions });
};

export const parameters = {
  docs: {
    source: {
      excludeDecorators: true,
    },
  },
  react: {
    rootOptions: {
      onCaughtError(error: unknown) {
        if (isNextRouterError(error)) {
          return;
        }
        console.error(error);
      },
    },
  },
};

const preview: Preview = {
  render: (args, context) => {
    const { id, component: Component } = context;
    if (!Component) {
      throw new Error(
        `Unable to render story ${id} as the component annotation is missing from the default export`
      );
    }
    return <Component {...args} />;
  },

  applyDecorators: (
    storyFn: LegacyStoryFn<ReactRenderer>,
    decorators: DecoratorFunction<ReactRenderer>[]
  ): LegacyStoryFn<ReactRenderer> => {
    return defaultDecorateStory((context) => React.createElement(storyFn, context), decorators);
  },

  renderToCanvas: async function (
    { storyContext, unboundStoryFn, showMain }: RenderContext<ReactRenderer>,
    canvasElement: ReactRenderer['canvasElement']
  ) {
    const Story = unboundStoryFn;

    const { unmount } = await renderServer(<Story {...storyContext} />, {
      container: canvasElement,
    });

    showMain();

    return async () => {
      await unmount();
    };
  },
};

export const { render, applyDecorators, renderToCanvas } = preview;
