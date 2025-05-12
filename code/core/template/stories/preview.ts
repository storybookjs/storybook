import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

import type { ReactRenderer } from '@storybook/react';

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

const testProjectDecorator = (storyFn: PartialStoryFn<ReactRenderer>, context: StoryContext) => {
  if (context.parameters.useProjectDecorator) {
    return storyFn({ args: { ...context.args, text: `project ${context.args.text}` } });
  }
  return storyFn();
};

export const decorators = [testProjectDecorator];

export const initialGlobals = {
  foo: 'fooValue',
  bar: 'barValue',
  baz: 'bazValue',

  sb_theme: 'light',
  locale: 'en',
};

export const globalTypes = {
  sb_theme: {
    name: 'Theme',
    description: 'Global theme for components',
    toolbar: {
      icon: 'circlehollow',
      title: 'Theme',
      items: [
        { value: 'light', icon: 'sun', title: 'light' },
        { value: 'dark', icon: 'moon', title: 'dark' },
        { value: 'side-by-side', icon: 'sidebyside', title: 'side by side' },
        { value: 'stacked', icon: 'stacked', title: 'stacked' },
      ],
    },
  },
  locale: {
    name: 'Locale',
    description: 'Internationalization locale',
    toolbar: {
      icon: 'globe',
      shortcuts: {
        next: {
          label: 'Go to next language',
          keys: ['L'],
        },
        previous: {
          label: 'Go to previous language',
          keys: ['K'],
        },
        reset: {
          label: 'Reset language',
          keys: ['meta', 'shift', 'L'],
        },
      },
      items: [
        { title: 'Reset locale', type: 'reset' },
        { value: 'en', right: '🇺🇸', title: 'English' },
        { value: 'es', right: '🇪🇸', title: 'Español' },
        { value: 'zh', right: '🇨🇳', title: '中文' },
        { value: 'kr', right: '🇰🇷', title: '한국어' },
      ],
    },
  },
};
