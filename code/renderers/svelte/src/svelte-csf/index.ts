/// <reference types="webpack-env" />

import Story from './components/Story.svelte';
import Template from './components/Template.svelte';

// FIXME: We don't use webpack anymore(?)
if (module?.hot?.decline) {
  module.hot.decline();
}

export { Template, Story };
