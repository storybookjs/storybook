/* eslint-disable no-var,@typescript-eslint/ban-ts-comment */
import React from 'react';
import type { JSX, Usable } from 'react';
import type { Root } from 'react-dom/client';

import type { Addon_DecoratorFunction, Addon_LoaderFunction } from 'storybook/internal/types';
import type { DecoratorFunction, LegacyStoryFn, RenderContext } from 'storybook/internal/types';

// @ts-ignore (this only errors during compilation for production)
import { ClientWrapper } from '@storybook/nextjs/dist/client';
// We need this import to be a singleton, and because it's used in multiple entrypoints
// both in ESM and CJS, importing it via the package name instead of having a local import
// is the only way to achieve it actually being a singleton
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { createNavigation } from '@storybook/nextjs/navigation.mock';
import { type Preview, type ReactRenderer } from '@storybook/react';

import {
  createFromReadableStream,
  createRoot,
  use, // @ts-ignore (this only errors during compilation for production)
} from '@storybook/nextjs/dist/react-client-entrypoint';

// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { isNextRouterError } from 'next/dist/client/components/is-next-router-error';
// @ts-expect-error no types
import { renderToReadableStream } from 'react-server-dom-webpack/server.browser';
import { defaultDecorateStory } from 'storybook/preview-api';

import './config/preview';

function addNextHeadCount() {
  const meta = document.createElement('meta');
  meta.name = 'next-head-count';
  meta.content = '0';
  document.head.appendChild(meta);
}

addNextHeadCount();

// Copying Next patch of console.error:
// https://github.com/vercel/next.js/blob/a74deb63e310df473583ab6f7c1783bc609ca236/packages/next/src/client/app-index.tsx#L15
const origConsoleError = globalThis.console.error;
globalThis.console.error = (...args: unknown[]) => {
  const error = args[0];
  if (isNextRouterError(error)) {
    return;
  }
  origConsoleError.apply(globalThis.console, args);
};

globalThis.addEventListener('error', (ev: WindowEventMap['error']): void => {
  if (isNextRouterError(ev.error)) {
    ev.preventDefault();
    return;
  }
});

export const decorators: Addon_DecoratorFunction<any>[] = [
  (Story, context) => (
    <ClientWrapper nextjs={context.parameters.nextjs}>
      <Story />
    </ClientWrapper>
  ),
];

export const loaders: Addon_LoaderFunction = async ({ globals, parameters }) => {
  createNavigation(parameters.nextjs.router);
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

function Use({ value }: { value: Usable<JSX.Element> }) {
  return use(value);
}

const nodes = new Map<Element, Root>();

const getReactRoot = (el: Element): Root => {
  if (!nodes.get(el)) {
    nodes.set(el, createRoot(el));
  }
  return nodes.get(el)!;
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
    const manifest = await fetch('/react-client-manifest.json').then((it) => it.json());

    const root = getReactRoot(canvasElement);
    const Story = unboundStoryFn;

    const stream = renderToReadableStream(<Story {...storyContext} />, manifest);
    root.render(
      <Use
        value={createFromReadableStream(stream, {
          callServer: async (id: string, args: unknown[]) => {
            console.log(`action called with`, { id, args });

            // for example: file:///Users/kasperpeulen/code/rsc-webpack-browser5/src/components/actions.ts#saveToDb
            const [filepath, name] = id!.split('#');

            // TODO probably too hacky, but not sure how else
            const module = Object.keys(__webpack_modules__).find((id) =>
              filepath?.endsWith(id.replace('(rsc)/./', ''))
            );
            if (module) {
              const action = __webpack_require__(module)[name!];
              // setTimeout(renderStory, 0);
              return action?.(...args);
            }
          },
        })}
      />
    );

    showMain();
  },
};

export const { render, applyDecorators, renderToCanvas } = preview;

declare global {
  var __webpack_modules__: Record<string, unknown>;
  var __webpack_require__: (id: string) => Record<string, (...args: any[]) => any>;
}
