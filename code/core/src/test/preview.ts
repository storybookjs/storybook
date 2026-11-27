import type { LoaderFunction } from 'storybook/internal/csf';
import { definePreviewAddon } from 'storybook/internal/csf';
import { instrument } from 'storybook/internal/instrumenter';

import {
  clearAllMocks,
  fn,
  isMockFunction,
  resetAllMocks,
  restoreAllMocks,
  uninstrumentedUserEvent,
  within,
} from 'storybook/test';

const resetAllMocksLoader: LoaderFunction = ({ parameters }) => {
  if (parameters?.test?.mockReset === true) {
    resetAllMocks();
  } else if (parameters?.test?.clearMocks === true) {
    clearAllMocks();
  } else if (parameters?.test?.restoreMocks !== false) {
    // Note: restoreAllMocks() now only affects manual spies (vi.spyOn) in Vitest,
    // automocks are no longer affected since Vitest 4. This could lead to test pollution if
    // automock state persists between stories.
    restoreAllMocks();
  }
};

export const traverseArgs = (value: unknown, depth = 0, key?: string): unknown => {
  // Make sure to not get in infinite loops with self referencing args
  if (depth > 5) {
    return value;
  }

  if (value == null) {
    return value;
  }
  if (isMockFunction(value)) {
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
    // we loop instead of map to prevent this lit issue:
    // https://github.com/storybookjs/storybook/issues/25651
    for (let i = 0; i < value.length; i++) {
      if (Object.getOwnPropertyDescriptor(value, i)?.writable) {
        value[i] = traverseArgs(value[i], depth);
      }
    }
    return value;
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

let focusGuarded = false;

// userEvent.setup() replaces HTMLElement.prototype.focus for the whole page, so every story runs
// on user-event's focus instead of the browser's. Any change here must keep two goals:
// 1. Focus-management libraries (react-aria, Zag, Fluent's keyborg, web components) behave as they
//    do outside Storybook. They read, wrap and reassign `focus` on the prototype and on single
//    elements, so it stays a plain writable data property. focus.stories.ts tests this.
// 2. Focusing a node whose iframe was removed does not throw. user-event's focus throws "Could not
//    determine window of node" there, and inside React's commit phase that freezes the UI (the
//    Review UI hit this, #35398). Focus means nothing without a window, so it does nothing.
const guardFocusWithoutBrowsingContext = () => {
  if (focusGuarded) {
    return;
  }
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    if (!this.ownerDocument?.defaultView) {
      return;
    }
    return focus.call(this, options);
  };
  focusGuarded = true;
};

export const enhanceContext: LoaderFunction = async (context) => {
  if (globalThis.HTMLElement && context.canvasElement instanceof globalThis.HTMLElement) {
    context.canvas = within(context.canvasElement);
  }

  try {
    // userEvent.setup() needs a DOM, so skip it where there is none, such as React Native.
    // `navigator.clipboard` does not tell: browsers expose it only in secure contexts.
    if (globalThis.document && globalThis.HTMLElement) {
      const { navigator } = globalThis.window;
      const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

      context.userEvent = instrument(
        { userEvent: uninstrumentedUserEvent.setup() },
        {
          intercept: true,
          getKeys: (obj) => Object.keys(obj).filter((key) => key !== 'eventWrapper'),
        }
      ).userEvent;

      // userEvent.setup() replaces `navigator.clipboard` with a stub. Put back what was there,
      // so stories keep the browser clipboard, or keep no clipboard in an insecure context.
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
      } else {
        Reflect.deleteProperty(navigator, 'clipboard');
      }

      guardFocusWithoutBrowsingContext();
    }
  } catch {}
};

interface TestParameters {
  test?: {
    /** Ignore unhandled errors during test execution */
    dangerouslyIgnoreUnhandledErrors?: boolean;

    /** Whether to throw exceptions coming from the play function */
    throwPlayFunctionExceptions?: boolean;
  };
}

export interface TestTypes {
  parameters: TestParameters;
}

export default () =>
  definePreviewAddon<TestTypes>({
    loaders: [resetAllMocksLoader, nameSpiesAndWrapActionsInSpies, enhanceContext],
  });
