/* eslint-disable local-rules/no-uncategorized-errors */
import type { Args, ArgsStoryFn, RenderContext, StoryContext } from 'storybook/internal/types';

import type { PreviewWeb } from 'storybook/preview-api';
import type { App } from 'vue';
import { createApp, h, isReactive, isVNode, reactive } from 'vue';

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
  if (globalThis && globalThis.PLUGINS_SETUP_FUNCTIONS) {
    await Promise.all([...globalThis.PLUGINS_SETUP_FUNCTIONS].map((fn) => fn(app, storyContext)));
  }
};

const map = new Map<
  VueRenderer['canvasElement'] | StoryID,
  {
    vueApp: ReturnType<typeof createApp>;
    reactiveArgs: Args;
    storyFn: () => StoryFnVueReturnType;
  }
>();

export async function renderToCanvas(
  { storyFn, forceRemount, showMain, showException, storyContext, id }: RenderContext<VueRenderer>,
  canvasElement: VueRenderer['canvasElement']
) {
  const existingApp = map.get(canvasElement);

  // if the story is already rendered and we are not forcing a remount, we just update the reactive args
  if (existingApp && !forceRemount) {
    // Update the story function reference
    existingApp.storyFn = storyFn;

    // Update reactive args with the new storyContext.args
    // This will trigger Vue's reactivity and re-render the component
    updateArgs(existingApp.reactiveArgs, storyContext.args);

    return () => {
      teardown(existingApp.vueApp, canvasElement);
    };
  }

  if (existingApp && forceRemount) {
    teardown(existingApp.vueApp, canvasElement);
  }

  // create vue app for the story
  const vueApp = createApp({
    setup() {
      // Make storyContext.args reactive BEFORE calling storyFn
      // This ensures the story function gets reactive args from the start
      const reactiveArgs = reactive(storyContext.args);
      storyContext.args = reactiveArgs;

      // Store the storyFn in a reactive ref so it can be updated
      let currentStoryFn = storyFn;

      const appState = {
        vueApp,
        reactiveArgs,
        get storyFn() {
          return currentStoryFn;
        },
        set storyFn(fn: () => StoryFnVueReturnType) {
          currentStoryFn = fn;
        },
      };
      map.set(canvasElement, appState);

      return () => {
        // Call the story function each time to get fresh element with current args
        const rootElement = appState.storyFn();

        // Get args after calling storyFn in case decorators modified them
        const finalArgs = getArgs(rootElement, storyContext);

        // Update reactive args if they differ from what decorators provided
        if (finalArgs !== storyContext.args) {
          updateArgs(reactiveArgs, finalArgs);
        }

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

/** Generate slots for default story without render function template */
function getSlots(props: Args, context: StoryContext<VueRenderer, Args>) {
  const { argTypes } = context;
  const slots = Object.entries(props)
    .filter(([key]) => argTypes[key]?.table?.category === 'slots')
    .map(([key, value]) => [key, typeof value === 'function' ? value : () => value]);

  return Object.fromEntries(slots);
}

/**
 * Get the args from the root element props if it is a vnode otherwise from the context
 *
 * @param element Is the root element of the story
 * @param storyContext Is the story context
 */

function getArgs(element: StoryFnVueReturnType, storyContext: StoryContext<VueRenderer, Args>) {
  return element.props && isVNode(element) ? element.props : storyContext.args;
}

/**
 * Update the reactive args
 *
 * @param reactiveArgs
 * @param nextArgs
 * @returns
 */
export function updateArgs(reactiveArgs: Args, nextArgs: Args) {
  if (Object.keys(nextArgs).length === 0) {
    return;
  }
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
 * Unmount the vue app
 *
 * @private
 * @param storybookApp
 * @param canvasElement
 * @returns Void
 */

function teardown(
  storybookApp: ReturnType<typeof createApp>,
  canvasElement: VueRenderer['canvasElement']
) {
  storybookApp?.unmount();

  if (map.has(canvasElement)) {
    map.delete(canvasElement);
  }
}
