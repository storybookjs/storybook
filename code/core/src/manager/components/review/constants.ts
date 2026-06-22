// Import the core-owned ingest contract from its source module (a relative path,
// not the `storybook/internal/types` self-package barrel) so the manager bundle
// gets a live binding and avoids a circular self-import. Re-aliased here so the
// manager and the external `@storybook/addon-mcp` producer agree on the names.
import { REVIEW_EVENTS, REVIEW_NAMESPACE } from '../../../shared/review/index.ts';

export { REVIEW_EVENTS as EVENTS, REVIEW_NAMESPACE as ADDON_ID };

export const PAGE_ID = `${REVIEW_NAMESPACE}/page`;
export const REVIEW_CHANGES_URL = '/review/';

// sessionStorage key for the canvas search to return to when leaving review
// mode (both summary back-to-Storybook and dismiss). Captured while browsing
// stories/docs outside review mode, so it points at the pre-review canvas.
export const PRE_REVIEW_RETURN_KEY = `${REVIEW_NAMESPACE}/pre-review-return`;

// sessionStorage marker deduplicating the one-time auto-enter on first landing
// on the review summary. Reset on dismiss and when a new review payload arrives.
export const AUTO_ENTERED_SESSION_KEY = `${REVIEW_NAMESPACE}/auto-entered`;

// sessionStorage key prefix for per-review reviewed-progress (the set of visited
// story ids). Suffixed with the review's server-stamped `createdAt` so each
// review tracks its own progress and a new review starts fresh, while reloads of
// the same review keep it. Cleared on full dismiss.
export const REVIEW_PROGRESS_KEY_PREFIX = `${REVIEW_NAMESPACE}/progress`;
