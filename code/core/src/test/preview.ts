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

let patchedFocus = false;

export const enhanceContext: LoaderFunction = async (context) => {
  if (globalThis.HTMLElement && context.canvasElement instanceof globalThis.HTMLElement) {
    context.canvas = within(context.canvasElement);
  }

  try {
    // userEvent.setup() cannot be called in non browser environment and will attempt to access window.navigator.clipboard
    // which will throw an error in react native for example.
    const clipboard = globalThis.window?.navigator?.clipboard;
    if (clipboard) {
      context.userEvent = instrument(
        { userEvent: uninstrumentedUserEvent.setup() },
        {
          intercept: true,
          getKeys: (obj) => Object.keys(obj).filter((key) => key !== 'eventWrapper'),
        }
      ).userEvent;

      // Restore original clipboard, which was replaced with a stub by userEvent.setup()
      Object.defineProperty(globalThis.window.navigator, 'clipboard', {
        get: () => clipboard,
        configurable: true,
      });

      if (!patchedFocus) {
        const originalFocus = HTMLElement.prototype.focus;
        let currentFocus = HTMLElement.prototype.focus;
        const noopFocus = () => {};
        const focusingElements = new Set<HTMLElement>();

        Object.defineProperties(HTMLElement.prototype, {
          focus: {
            configurable: true,
            set: (newFocus: () => void) => {
              currentFocus = newFocus;
            },
            get() {
              /*
               * Focus libraries (react-aria, Zag) read `HTMLElement.prototype.focus` to capture
               * and wrap it. That invokes this getter with the prototype as `this`, so DOM
               * brand-checked properties must not be read until the receiver is validated.
               *
               * Nodes in a removed iframe have no browsing context; the instrumented focus would
               * throw during React commit, so those get a no-op instead.
               *
               * During reentrancy, return the native method to break loops from wrappers that
               * call back into focus on the same element synchronously. The marker is cleared on
               * the next task so it covers the full synchronous call chain.
               */
              if (this === HTMLElement.prototype) {
                return currentFocus;
              }

              let browsingContext;
              try {
                browsingContext = this.ownerDocument?.defaultView;
              } catch {
                return currentFocus;
              }
              if (!browsingContext) {
                return noopFocus;
              }

              if (focusingElements.has(this)) {
                return originalFocus;
              }

              focusingElements.add(this);
              setTimeout(() => focusingElements.delete(this), 0);

              return currentFocus;
            },
          },
        });

        patchedFocus = true;
      }
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
