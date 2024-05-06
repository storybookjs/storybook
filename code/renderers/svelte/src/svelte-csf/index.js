export { default as Story } from './components/Story.svelte';
export { default as Template } from './components/Template.svelte';

if (module?.hot?.decline) {
  module.hot.decline();
}
