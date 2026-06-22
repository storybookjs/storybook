// The channel events are the core-owned ingest contract; re-export the single
// source so the manager and the external `@storybook/addon-mcp` producer agree.
export { REVIEW_EVENTS as EVENTS, REVIEW_NAMESPACE as ADDON_ID } from 'storybook/internal/types';

import { REVIEW_NAMESPACE } from 'storybook/internal/types';

export const PAGE_ID = `${REVIEW_NAMESPACE}/page`;
export const REVIEW_CHANGES_URL = '/review/';

// sessionStorage key for the canvas search to return to when leaving review
// mode (both summary back-to-Storybook and dismiss). Captured while browsing
// stories/docs outside review mode, so it points at the pre-review canvas.
export const PRE_REVIEW_RETURN_KEY = `${REVIEW_NAMESPACE}/pre-review-return`;

// sessionStorage marker deduplicating the one-time auto-enter on first landing
// on the review summary. Reset on dismiss and when a new review payload arrives.
export const AUTO_ENTERED_SESSION_KEY = `${REVIEW_NAMESPACE}/auto-entered`;
