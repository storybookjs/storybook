export const ADDON_ID = 'storybook/highlight';

export const HIGHLIGHT = `${ADDON_ID}/add`;
export const REMOVE_HIGHLIGHT = `${ADDON_ID}/remove`;
export const RESET_HIGHLIGHT = `${ADDON_ID}/reset`;
export const SCROLL_INTO_VIEW = `${ADDON_ID}/scroll-into-view`;

/**
 * Internal event (preview → manager) to render or update the interactive highlight menu. The menu
 * is rendered by the manager so it cannot be triggered by embedding the preview on another site.
 */
export const HIGHLIGHT_MENU = `${ADDON_ID}/menu`;

/** Internal event (manager → preview) for highlight menu interactions (select/focus target). */
export const HIGHLIGHT_MENU_INTERACTION = `${ADDON_ID}/menu-interaction`;

export const MAX_Z_INDEX = 2147483647;
export const MIN_TOUCH_AREA_SIZE = 28;
