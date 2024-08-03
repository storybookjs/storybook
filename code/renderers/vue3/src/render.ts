/* eslint-disable local-rules/no-uncategorized-errors,no-underscore-dangle */

import type { App } from 'vue';
import { createApp, h, isReactive, isVNode, reactive } from 'vue';
import type { ArgsStoryFn, RenderContext, StoryContext, Args } from 'storybook/internal/types';
import type { PreviewWeb } from 'storybook/internal/preview-api';
import type { StoryFnVueReturnType, StoryID, VueRenderer } from './types';

export const render: ArgsStoryFn<VueRenderer> = (props, context) => {
  const { id, component: Component } = context;
  if (!Component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }

  return () => h(Component, props, getSlots(props, context));
};

export const setup = (fn: (app: App, storyContext?: StoryContext<VueRenderer>) => unknown) => {
  globalThis.PLUGINS_SETUP_FUNCTIONS ??= new Set();
  globalThis.PLUGINS_SETUP_FUNCTIONS.add(fn);
};

const runSetupFunctions = async (
  app: App,
  storyContext: StoryContext<VueRenderer>
): Promise<void> => {
  if (globalThis && globalThis.PLUGINS_SETUP_FUNCTIONS)
    await Promise.all([...globalThis.PLUGINS_SETUP_FUNCTIONS].map((fn) => fn(app, storyContext)));
};

const map = new Map<
  VueRenderer['canvasElement'] | StoryID,
  {
    vueApp: ReturnType<typeof createApp>;
    reactiveArgs: Args;
  }
>();

export async function renderToCanvas(
  { storyFn, forceRemount, showMain, showException, storyContext, id }: RenderContext<VueRenderer>,
  canvasElement: VueRenderer['canvasElement']
) {
  const existingApp = map.get(canvasElement);

  // if the story is already rendered and we are not forcing a remount, we just update the reactive args
  if (existingApp && !forceRemount) {
    // normally storyFn should be call once only in setup function,but because the nature of react and how storybook rendering the decorators
    // we need to call here to run the decorators again
    // i may wrap each decorator in memoized function to avoid calling it if the args are not changed
    const element = storyFn(); // call the story function to get the root element with all the decorators
    const args = getArgs(element, storyContext); // get args in case they are altered by decorators otherwise use the args from the context

    updateArgs(existingApp.reactiveArgs, args);
    return () => {
      teardown(existingApp.vueApp, canvasElement);
    };
  }
  if (existingApp && forceRemount) teardown(existingApp.vueApp, canvasElement);

  // create vue app for the story
  const vueApp = createApp({
    setup() {
      storyContext.args = reactive(storyContext.args);
      const rootElement = storyFn(); // call the story function to get the root element with all the decorators
      const args = getArgs(rootElement, storyContext); // get args in case they are altered by decorators otherwise use the args from the context
      const appState = {
        vueApp,
        reactiveArgs: reactive(args),
      };
      map.set(canvasElement, appState);

      return () => {
        // not passing args here as props
        // treat the rootElement as a component without props
        return h(rootElement);
      };
    },
  });

  vueApp.config.errorHandler = (e: unknown, instance, info) => {
    const preview = (window as Record<string, any>)
      .__STORYBOOK_PREVIEW__ as PreviewWeb<VueRenderer>;
    const isPlaying = preview?.storyRenders.some(
      (renderer) => renderer.id === id && renderer.phase === 'playing'
    );
    // Errors thrown during playing need be shown in the interactions panel.
    if (isPlaying) {
      // Make sure that Vue won't swallow this error, by stacking it as a different event.
      setTimeout(() => {
        throw e;
      }, 0);
    } else {
      showException(e as Error);
    }
  };
  await runSetupFunctions(vueApp, storyContext);
  vueApp.mount(canvasElement);

  showMain();
  return () => {
    teardown(vueApp, canvasElement);
  };
}

/**
 * generate slots for default story without render function template
 */
function getSlots(props: Args, context: StoryContext<VueRenderer, Args>) {
  const { argTypes } = context;
  const slots = Object.entries(props)
    .filter(([key]) => argTypes[key]?.table?.category === 'slots')
    .map(([key, value]) => [key, typeof value === 'function' ? value : () => value]);

  return Object.fromEntries(slots);
}

/**
 * get the args from the root element props if it is a vnode otherwise from the context
 * @param element is the root element of the story
 * @param storyContext is the story context
 */

function getArgs(element: StoryFnVueReturnType, storyContext: StoryContext<VueRenderer, Args>) {
  return element.props && isVNode(element) ? element.props : storyContext.args;
}

/**
 *  update the reactive args
 * @param reactiveArgs
 * @param nextArgs
 * @returns
 */
export function updateArgs(reactiveArgs: Args, nextArgs: Args) {
  if (Object.keys(nextArgs).length === 0) return;
  const currentArgs = isReactive(reactiveArgs) ? reactiveArgs : reactive(reactiveArgs);
  // delete all args in currentArgs that are not in nextArgs
  Object.keys(currentArgs).forEach((key) => {
    if (!(key in nextArgs)) {
      delete currentArgs[key];
    }
  });
  // update currentArgs with nextArgs
  Object.assign(currentArgs, nextArgs);
}

/**
 * unmount the vue app
 * @param storybookApp
 * @param canvasElement
 * @returns void
 * @private
 * */

function teardown(
  storybookApp: ReturnType<typeof createApp>,
  canvasElement: VueRenderer['canvasElement']
) {
  storybookApp?.unmount();
  if (map.has(canvasElement)) map.delete(canvasElement);
}
