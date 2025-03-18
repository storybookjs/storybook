import { within } from '@testing-library/dom';
import { userEvent } from '@testing-library/user-event';

import type { LoaderFunction } from 'storybook/internal/csf';
import { instrument } from 'storybook/internal/instrumenter';

import { definePreview } from 'storybook/preview-api';

import { clearAllMocks, fn, isMockFunction, resetAllMocks, restoreAllMocks } from './spy';

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

const enhanceContext: LoaderFunction = async (context) => {
  if (globalThis.HTMLElement && context.canvasElement instanceof globalThis.HTMLElement) {
    context.canvas = within(context.canvasElement);
  }

  if (globalThis.window && globalThis.HTMLElement) {
    context.userEvent = instrument({ userEvent: userEvent.setup() }, { intercept: true }).userEvent;
  }
};

export default () =>
  definePreview({
    loaders: [resetAllMocksLoader, nameSpiesAndWrapActionsInSpies, enhanceContext],
  });
