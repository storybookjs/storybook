export const SVELTE_CSF_TAG_PREFIX = 'svelte-csf';
export const SVELTE_CSF_V4_TAG = `${SVELTE_CSF_TAG_PREFIX}-v4`;
export const SVELTE_CSF_V5_TAG = `${SVELTE_CSF_TAG_PREFIX}-v5`;
export const STORYBOOK_INTERNAL_PREFIX = '$__';
export const STORYBOOK_META_IDENTIFIER = `${STORYBOOK_INTERNAL_PREFIX}meta`;
export const RUNTIME_STORIES_IDENTIFIER = `${STORYBOOK_INTERNAL_PREFIX}stories`;
// The module that users import `defineMeta` from. The parser and compiler match imports against it.
export const SVELTE_CSF_IMPORT_SOURCE = '@storybook/svelte';
// TODO: Remove with the legacy syntax.
// The module that legacy stories files import the `Meta`, `Story` and `Template` components from.
export const SVELTE_CSF_LEGACY_IMPORT_SOURCE = '@storybook/svelte/csf';
// The module that compiled stories files import `createRuntimeStories` from.
export const SVELTE_CSF_RUNTIME_STORIES_IMPORT_SOURCE =
  '@storybook/svelte/internal/svelte-csf/create-runtime-stories';
