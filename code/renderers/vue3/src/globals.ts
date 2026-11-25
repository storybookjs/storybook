import type { App } from 'vue';

import type { StoryContext } from './public-types.ts';

globalThis.STORYBOOK_ENV = 'vue3';
globalThis.PLUGINS_SETUP_FUNCTIONS ||= new Set<(app: App<any>, context: StoryContext) => unknown>();
