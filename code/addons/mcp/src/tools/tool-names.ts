import { toMcpToolName } from 'storybook/open-service';

/**
 * Tool names used in this addon's own prose and resource URIs.
 *
 * Toolset-backed names follow the generic toolset/method convention. The instructions tool is the
 * exception: it has no toolset method, so its name lives here.
 */
export const PREVIEW_STORIES_TOOL_NAME = toMcpToolName('stories.preview');
export const GET_CHANGED_STORIES_TOOL_NAME = toMcpToolName('stories.changed');
export const GET_STORIES_BY_COMPONENT_TOOL_NAME = toMcpToolName('stories.findByComponent');
export const RUN_STORY_TESTS_TOOL_NAME = toMcpToolName('test.run');
export const DISPLAY_REVIEW_TOOL_NAME = toMcpToolName('review.create');

export const GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME = 'get-storybook-story-instructions';
