import { global } from '@storybook/global';

import type { App } from 'vue';

import type { StoryContext } from './public-types';

const { window: globalWindow } = global;

globalWindow.STORYBOOK_ENV = 'vue3';
globalWindow.PLUGINS_SETUP_FUNCTIONS ||= new Set<
  (app: App<any>, context: StoryContext) => unknown
>();
