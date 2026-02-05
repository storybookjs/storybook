/**
 * Tool name constants extracted to avoid circular dependencies.
 *
 * The cycle was:
 * - types.ts → get-storybook-story-instructions.ts (for GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME)
 * - get-storybook-story-instructions.ts → run-story-tests.ts (for RUN_STORY_TESTS_TOOL_NAME)
 * - run-story-tests.ts → types.ts (for StoryInputArray)
 */

export const PREVIEW_STORIES_TOOL_NAME = 'preview-stories';
export const GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME = 'get-storybook-story-instructions';
export const RUN_STORY_TESTS_TOOL_NAME = 'run-story-tests';
