import { MCP_TOOL_NAMES } from 'storybook/open-service';

/**
 * Tool names used in this addon's own prose and resource URIs.
 *
 * Derived from core's frozen map so there is one source of truth for the public MCP contract. The
 * instructions tool is the exception: it has no toolset method, so its name lives here.
 */
export const PREVIEW_STORIES_TOOL_NAME = MCP_TOOL_NAMES['stories.preview'];
export const GET_CHANGED_STORIES_TOOL_NAME = MCP_TOOL_NAMES['stories.changed'];
export const GET_STORIES_BY_COMPONENT_TOOL_NAME = MCP_TOOL_NAMES['stories.findByComponent'];
export const RUN_STORY_TESTS_TOOL_NAME = MCP_TOOL_NAMES['test.run'];
export const DISPLAY_REVIEW_TOOL_NAME = MCP_TOOL_NAMES['review.create'];

export const GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME = 'get-storybook-story-instructions';
