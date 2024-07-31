import { global as globalThis } from '@storybook/global';
import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

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
    (storyFn: PartialStoryFn, { globals }: StoryContext) => {
      const object = {
        ...globals,
        caption: `Locale is '${globals.locale}', so I say: ${greetingForLocale(globals.locale)}`,
      };
      return storyFn({ args: { object } });
    },
  ],
};

export const Basic = {};
