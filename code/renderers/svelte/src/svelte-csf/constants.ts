export const SVELTE_CSF_TAG_PREFIX = 'svelte-csf';
export const SVELTE_CSF_V4_TAG = `${SVELTE_CSF_TAG_PREFIX}-v4`;
export const SVELTE_CSF_V5_TAG = `${SVELTE_CSF_TAG_PREFIX}-v5`;
export const STORYBOOK_INTERNAL_PREFIX = '$__';
export const STORYBOOK_META_IDENTIFIER = `${STORYBOOK_INTERNAL_PREFIX}meta`;
export const RUNTIME_STORIES_IDENTIFIER = `${STORYBOOK_INTERNAL_PREFIX}stories`;
// Users import `defineMeta` from their framework. The frameworks re-export the renderer.
export const SVELTE_CSF_FRAMEWORK_IMPORT_SOURCES = [
  '@storybook/svelte-vite',
  '@storybook/sveltekit',
] as const;
// Storybook's own stories import `defineMeta` from the renderer.
export const SVELTE_CSF_RENDERER_IMPORT_SOURCE = '@storybook/svelte';
export const SVELTE_CSF_IMPORT_SOURCES = [
  ...SVELTE_CSF_FRAMEWORK_IMPORT_SOURCES,
  SVELTE_CSF_RENDERER_IMPORT_SOURCE,
] as const;
// TODO: Remove with the legacy syntax.
export const SVELTE_CSF_LEGACY_IMPORT_SOURCE = '@storybook/svelte/csf';
// The module that compiled stories files import `createRuntimeStories` from.
export const SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE =
  '@storybook/svelte/internal/svelte-csf/create-runtime-stories';
