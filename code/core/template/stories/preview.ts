import {
  CircleHollowIcon,
  GlobeIcon,
  MoonIcon,
  SideBySideIcon,
  StackedIcon,
  SunIcon,
} from '@storybook/icons';
import type { GlobalTypes, PartialStoryFn, StoryContext } from 'storybook/internal/types';

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

const testProjectDecorator = (storyFn: PartialStoryFn, context: StoryContext) => {
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
      icon: CircleHollowIcon,
      title: 'Theme',
      items: [
        { value: 'light', icon: SunIcon, title: 'light' },
        { value: 'dark', icon: MoonIcon, title: 'dark' },
        { value: 'side-by-side', icon: SideBySideIcon, title: 'side by side' },
        { value: 'stacked', icon: StackedIcon, title: 'stacked' },
      ],
    },
  },
  locale: {
    name: 'Locale',
    description: 'Internationalization locale',
    toolbar: {
      icon: GlobeIcon,
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
} satisfies GlobalTypes;
