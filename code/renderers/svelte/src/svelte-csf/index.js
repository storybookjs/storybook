export { default as Meta } from './components/Meta.svelte';
export { default as Story } from './components/Story.svelte';
export { default as Template } from './components/Template.svelte';

if (module && module.hot && module.hot.decline) {
  module.hot.decline();
}

// make it work with --isolatedModules
export default {};
