import { STORY_FILE_TEST_REGEXP } from 'storybook/internal/common';

export const SVELTE_STORY_FILE_TEST_REGEXP = new RegExp(
  `\\.svelte$|${STORY_FILE_TEST_REGEXP.source}`
);
