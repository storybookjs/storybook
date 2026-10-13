import { STORY_FILE_TEST_REGEXP } from 'storybook/internal/common';

export const SVELTE_STORY_FILE_TEST_REGEXP = /\.stories\.svelte$/;
export const SVELTE_DOCGEN_STORY_FILE_TEST_REGEXP = new RegExp(
  `${SVELTE_STORY_FILE_TEST_REGEXP.source}|${STORY_FILE_TEST_REGEXP.source}`
);

export const isSvelteStoryFile = (path: string) => SVELTE_DOCGEN_STORY_FILE_TEST_REGEXP.test(path);
