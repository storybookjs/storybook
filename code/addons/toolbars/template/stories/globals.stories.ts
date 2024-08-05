import { global as globalThis } from '@storybook/global';
import type { DecoratorFunction } from 'storybook/internal/types';

const greetingForLocale = (locale: string) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'fr':
      return 'Bonjour !';
    case 'zh':
      return '你好!';
    case 'kr':
      return '안녕하세요!';
    case 'en':
    default:
      return 'Hello';
  }
};

export default {
  component: globalThis.Components.Pre,
  decorators: [
    (storyFn, { globals }) => {
      const object = {
        ...globals,
        caption: `Locale is '${globals.locale}', so I say: ${greetingForLocale(globals.locale)}`,
      };
      return storyFn({ args: { object } });
    },
  ] satisfies DecoratorFunction[],
};

export const Basic = {};

export const OverrideLocale = {
  globals: {
    locale: 'kr',
  },
};

export const OverrideTheme = {
  globals: {
    sb_theme: 'dark',
  },
};

export const OverrideBoth = {
  globals: {
    locale: 'kr',
    sb_theme: 'dark',
  },
};
