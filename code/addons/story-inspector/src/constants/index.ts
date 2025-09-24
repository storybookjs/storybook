export const ADDON_ID = 'storybook/story-inspector' as const;
export const TOOL_ID = `${ADDON_ID}/tool` as const;
export const PARAM_KEY = 'storyInspector' as const;

// Data attribute for component file paths
export const COMPONENT_PATH_ATTRIBUTE = 'data-sb-component-path' as const;

// Highlight IDs
export const HIGHLIGHT_ID_WITH_STORIES = `${ADDON_ID}/with-stories` as const;
export const HIGHLIGHT_ID_WITHOUT_STORIES = `${ADDON_ID}/without-stories` as const;

// Events
export const EVENTS = {
  TOGGLE_INSPECTOR: `${ADDON_ID}/toggle-inspector`,
  CREATE_STORY_FOR_COMPONENT: `${ADDON_ID}/create-story-for-component`,
} as const;
