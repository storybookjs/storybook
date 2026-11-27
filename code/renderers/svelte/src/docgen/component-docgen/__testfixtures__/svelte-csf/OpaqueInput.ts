import Select from './Select.svelte';

function themeComponents() {
  return { Select };
}

export const Input = { Select, ...themeComponents() };
