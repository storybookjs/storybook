/* eslint-disable no-underscore-dangle */
import type { PartialStoryFn, StoryContext } from '@storybook/core/types';
import type { ReactRenderer } from '@storybook/react';

declare global {
  interface Window {
    __STORYBOOK_BEFORE_ALL_CALLS__: number;
    __STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__: number;
  }
}

try {
  // This is used to test the hooks in our E2E tests (look for storybook-hooks.spec.ts)

  /**
   * Wrapped in a try-catch, because accessing properties on globalThis.parent may throw if the
   * parent is cross-origin.
   */
  globalThis.parent.__STORYBOOK_BEFORE_ALL_CALLS__ = 0;
  globalThis.parent.__STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__ = 0;
} catch {
  // ignore
}

export const beforeAll = async () => {
  let cleanup: () => void = () => {};
  try {
    globalThis.parent.__STORYBOOK_BEFORE_ALL_CALLS__ += 1;
    cleanup = () => {
      globalThis.parent.__STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__ += 1;
    };
  } catch {
    // ignore
  }
  return cleanup;
};

export const parameters = {
  projectParameter: 'projectParameter',
  storyObject: {
    a: 'project',
    b: 'project',
    c: 'project',
  },
};

export const loaders = [async () => ({ projectValue: 2 })];

const testProjectDecorator = (storyFn: PartialStoryFn<ReactRenderer>, context: StoryContext) => {
  if (context.parameters.useProjectDecorator) {
    return storyFn({ args: { ...context.args, text: `project ${context.args.text}` } });
  }
  return storyFn();
};

export const decorators = [testProjectDecorator];

export const initialGlobals = {
  foo: 'fooValue',
  baz: 'bazValue',
};

export const globalTypes = {
  foo: { defaultValue: 'fooDefaultValue' },
  bar: { defaultValue: 'barDefaultValue' },
};
