// Import the core-owned ingest contract from its source module (a relative path,
// not the `storybook/internal/types` self-package barrel) so the manager bundle
// gets a live binding and avoids a circular self-import. Re-aliased here so the
// manager and the external `@storybook/addon-mcp` producer agree on the names.
import { REVIEW_EVENTS, REVIEW_NAMESPACE } from '../../../shared/review/index.ts';

export { REVIEW_NAMESPACE as ADDON_ID, REVIEW_EVENTS as EVENTS };

export const PAGE_ID = `${REVIEW_NAMESPACE}/page`;
export const REVIEW_CHANGES_URL = '/review/';

// sessionStorage key for the canvas search to return to when leaving review
// mode (both summary back-to-Storybook and dismiss). Captured while browsing
// stories/docs outside review mode, so it points at the pre-review canvas.
export const PRE_REVIEW_RETURN_KEY = `${REVIEW_NAMESPACE}/pre-review-return`;

// sessionStorage marker deduplicating the one-time auto-enter on first landing
// on the review summary. Reset on dismiss and when a new review payload arrives.
export const AUTO_ENTERED_SESSION_KEY = `${REVIEW_NAMESPACE}/auto-entered`;

// sessionStorage guard while navigateOutOfReview is in flight. Prevents the
// summary auto-enter effect from re-arming review mode before navigation away.
export const REVIEW_EXITING_SESSION_KEY = `${REVIEW_NAMESPACE}/exiting`;

// sessionStorage marker for the server `createdAt` of the review the user has
// opened. Non-review routes only surface a new-review notification while this
// differs from the active review's `createdAt`.
export const VISITED_REVIEW_CREATED_AT_KEY = `${REVIEW_NAMESPACE}/visited-created-at`;

// sessionStorage marker for the `createdAt` of the review currently shown in
// the sidebar notification. Cleared on accept or dismiss.
export const NOTIFIED_REVIEW_CREATED_AT_KEY = `${REVIEW_NAMESPACE}/notified-created-at`;

export const REVIEW_AVAILABLE_NOTIFICATION_ID = `${REVIEW_NAMESPACE}/review-available`;

export const reviewAvailableNotificationId = (createdAt: number): string =>
  `${REVIEW_AVAILABLE_NOTIFICATION_ID}/${createdAt}`;
