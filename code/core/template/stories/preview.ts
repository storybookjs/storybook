/* eslint-disable no-underscore-dangle */
import type { PartialStoryFn, StoryContext } from '@storybook/core/types';

declare global {
  interface Window {
    __STORYBOOK_BEFORE_ALL_CALLS__: number;
    __STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__: number;
  }
}

// This is used to test the hooks in our E2E tests (look for storybook-hooks.spec.ts)
globalThis.parent.__STORYBOOK_BEFORE_ALL_CALLS__ = 0;
globalThis.parent.__STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__ = 0;

export const beforeAll = async () => {
  globalThis.parent.__STORYBOOK_BEFORE_ALL_CALLS__ += 1;
  return () => {
    globalThis.parent.__STORYBOOK_BEFORE_ALL_CLEANUP_CALLS__ += 1;
  };
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

export const decorators = [
  (storyFn: PartialStoryFn, context: StoryContext) => {
    if (context.parameters.useProjectDecorator) {
      return storyFn({ args: { ...context.args, text: `project ${context.args.text}` } });
    }
    return storyFn();
  },
];

export const initialGlobals = {
  foo: 'fooValue',
  baz: 'bazValue',
};

export const globalTypes = {
  foo: { defaultValue: 'fooDefaultValue' },
  bar: { defaultValue: 'barDefaultValue' },
};
