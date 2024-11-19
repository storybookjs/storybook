import type { BoundFunctions } from '@testing-library/dom';

import type { LoaderFunction } from '@storybook/csf';
import { global } from '@storybook/global';
import { instrument } from '@storybook/instrumenter';

import * as chai from 'chai';

import { projectCursorAt } from './demo-mode';
import { expect as rawExpect } from './expect';
import {
  clearAllMocks,
  fn,
  isMockFunction,
  onMockCall,
  resetAllMocks,
  restoreAllMocks,
} from './spy';
import { type queries, userEvent, within } from './testing-library';

export * from './spy';

type Queries = BoundFunctions<typeof queries>;

declare module '@storybook/csf' {
  interface Canvas extends Queries {}
  interface StoryContext {
    userEvent: ReturnType<typeof userEvent.setup>;
  }
}

export const { expect } = instrument(
  { expect: rawExpect },
  {
    getKeys: (obj: Record<string, unknown>, depth) => {
      const privateApi = ['assert', '__methods', '__flags', '_obj'];
      if (obj.constructor === chai.Assertion) {
        const keys = Object.keys(Object.getPrototypeOf(obj)).filter(
          (it) => !privateApi.includes(it)
        );
        return depth > 2 ? keys : [...keys, 'not'];
      }
      return Object.keys(obj);
    },
    intercept: (method) => method !== 'expect',
  }
);

export * from './testing-library';

const resetAllMocksLoader: LoaderFunction = ({ parameters }) => {
  if (parameters?.test?.mockReset === true) {
    resetAllMocks();
  } else if (parameters?.test?.clearMocks === true) {
    clearAllMocks();
  } else if (parameters?.test?.restoreMocks !== false) {
    restoreAllMocks();
  }
};

export const traverseArgs = (value: unknown, depth = 0, key?: string): unknown => {
  // Make sure to not get in infinite loops with self referencing args

  // Make sure to not get in infinite loops with self referencing args
  if (depth > 5) {
    return value;
  }

  if (value == null) {
    return value;
  }
  if (isMockFunction(value)) {
    // Makes sure we get the arg name in the interactions panel

    // Makes sure we get the arg name in the interactions panel
    if (key) {
      value.mockName(key);
    }
    return value;
  }

  // wrap explicit actions in a spy
  if (
    typeof value === 'function' &&
    'isAction' in value &&
    value.isAction &&
    !('implicit' in value && value.implicit)
  ) {
    const mock = fn(value as any);

    if (key) {
      mock.mockName(key);
    }
    return mock;
  }

  if (Array.isArray(value)) {
    depth++;
    return value.map((item) => traverseArgs(item, depth));
  }

  if (typeof value === 'object' && value.constructor === Object) {
    depth++;
    for (const [k, v] of Object.entries(value)) {
      if (Object.getOwnPropertyDescriptor(value, k)?.writable) {
        // We have to mutate the original object for this to survive HMR.
        (value as Record<string, unknown>)[k] = traverseArgs(v, depth, k);
      }
    }
    return value;
  }
  return value;
};

const nameSpiesAndWrapActionsInSpies: LoaderFunction = ({ initialArgs }) => {
  traverseArgs(initialArgs);
};

const enhanceContext: LoaderFunction = (context) => {
  if (globalThis.HTMLElement && context.canvasElement instanceof globalThis.HTMLElement) {
    context.canvas = within(context.canvasElement);
    if (context.globals.interactionsDemoMode) {
      const user = userEvent.setup();
      const demoModeOptions = {
        cursorStyle: context.parameters.test?.cursorStyle,
        delay: context.parameters.test?.demoModeDelay,
      };

      context.userEvent = {
        ...user,
        type: async (...args) => {
          const [target, text, options] = args;
          const userSession = userEvent.setup({
            // make the typing take .5 seconds
            delay: Math.floor(Math.max(500 / text.length, 0)),
          });
          // QUESTION: Should we project the cursor on type?
          // If users to userEvent.click + userEvent.type then it's too much
          // await projectCursorAt(target, demoModeOptions);
          return userSession.type(target, text, options);
        },
        click: async (target) => {
          await projectCursorAt(target, demoModeOptions);
          return user.click(target);
        },
        pointer: async (options) => {
          // For pointer events it's really tricky because the API is super flexible
          // so we try to guess the target in the safest way possible
          if (typeof options === 'object') {
            let target;
            if ('target' in options) {
              target = options.target;
            } else if (Array.isArray(options)) {
              target =
                options.find(
                  (option): option is { target: any } =>
                    typeof option === 'object' && 'target' in option
                )?.target ?? null;
            }

            if (target) {
              await projectCursorAt(target, demoModeOptions);
            }
          }
          return user.pointer(options);
        },
      };
    } else {
      context.userEvent = userEvent.setup();
    }
  }
};

// We are using this as a default Storybook loader, when the test package is used. This avoids the need for optional peer dependency workarounds.
// eslint-disable-next-line no-underscore-dangle
(global as any).__STORYBOOK_TEST_LOADERS__ = [
  resetAllMocksLoader,
  nameSpiesAndWrapActionsInSpies,
  enhanceContext,
];
// eslint-disable-next-line no-underscore-dangle
(global as any).__STORYBOOK_TEST_ON_MOCK_CALL__ = onMockCall;
