export const BREAKPOINT = 600;
export const MEDIA_DESKTOP_BREAKPOINT = `@media (min-width: ${BREAKPOINT}px)`;
export const MOBILE_TRANSITION_DURATION = 300;

/** Minimum width in pixels for the main content area in the layout grid. */
export const MINIMUM_CONTENT_WIDTH_PX = 100;

/**
 * Upper bound on the minimum width that browsers will enforce for the addon panel in its horizontal
 * layout. Use it to compute the max width of other items (e.g. sidebar).
 */
export const MINIMUM_HORIZONTAL_PANEL_WIDTH_PX = 360;

/**
 * Height in pixels of the toolbar in the main content area. Used to compute the maximum height of
 * the bottom panel so it does not push the toolbar out of view.
 */
export const TOOLBAR_HEIGHT_PX = 40;
