/// <reference types="webpack-env" />

import Story from './components/Story.svelte';

import { setTemplate } from './components/context.svelte.js';

// FIXME: We don't use webpack anymore(?)
if (module?.hot?.decline) {
  module.hot.decline();
}

export { Story, setTemplate };
