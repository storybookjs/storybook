import type { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

import type { RenderResult } from '@ember/-internals/glimmer/lib/renderer';
import type Application from '@ember/application';

import type { EmberRenderer } from './types';

type Args = Record<string, unknown>;

export const render: ArgsStoryFn<EmberRenderer> = (args, context) => {
  const { id, component: Component } = context;

  if (typeof Component === 'function') {
    return { Component, args };
  } else if (typeof Component === 'object') {
    return { Component, args };
  }

  throw new Error(
    `Unable to render story ${id} as the component annotation is missing from the default export`
  );
};

const contexts = new Map<
  EmberRenderer['canvasElement'],
  {
    application: Application | undefined;
    renderer: RenderResult;
    args: Args;
  }
>();

export async function renderToCanvas(
  { storyFn, showMain, storyContext, forceRemount }: RenderContext<EmberRenderer>,
  canvasElement: EmberRenderer['canvasElement']
) {
  const { trackedObject } = await import('@ember/reactive/collections');
  const { renderComponent } = await import('@ember/renderer');
  const { destroy } = await import('@ember/destroyable');

  const { Component, args } = storyFn();

  function unmount(element: EmberRenderer['canvasElement']) {
    const context = contexts.get(element);
    if (!context) {
      return;
    }
    contexts.delete(element);
    context.renderer.destroy();
    if (context.application) {
      destroy(context.application);
    }
  }

  const context = contexts.get(canvasElement);
  if (context && !forceRemount) {
    updateArgs(context.args, args);
    return () => {
      unmount(canvasElement);
    };
  } else if (context) {
    unmount(canvasElement);
  }

  const application: Application | undefined = storyContext.parameters['owner']
    ? storyContext.parameters['owner'].create({
        autoboot: false,
        rootElement: 'body',
      })
    : undefined;

  const trackedArgs = trackedObject({ ...args });
  const result = renderComponent(Component, {
    args: trackedArgs,
    into: canvasElement,
    owner: application ? application.buildInstance() : undefined,
  });

  contexts.set(canvasElement, { application, renderer: result, args: trackedArgs });

  showMain();

  return () => {
    unmount(canvasElement);
  };
}

function updateArgs(currentArgs: Args, nextArgs: Args) {
  for (const key of Object.keys(currentArgs)) {
    if (!(key in nextArgs)) {
      delete currentArgs[key];
    }
  }
  Object.assign(currentArgs, nextArgs);
}
