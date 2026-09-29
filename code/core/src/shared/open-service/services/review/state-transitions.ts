import type { ReviewState } from '../../../review/review-state.ts';
import { REVIEW_STALE_GRACE_MS, type ReviewServiceState } from './definition.ts';

/**
 * Pure state transitions for the `core/review` service, shared by the server registration and the
 * story-only manager double so the two cannot drift.
 *
 * Values are deep-copied through {@link toPlainReview} where they move between state slots:
 * commands read state through a deepSignal proxy, and assigning proxied values back into state
 * would leave wrappers that `structuredClone` cannot snapshot.
 */
export function toPlainReview(review: ReviewState): ReviewState {
  return {
    ...review,
    collections: review.collections.map((collection) => ({
      ...collection,
      storyIds: [...collection.storyIds],
    })),
    ...(review.changedFiles ? { changedFiles: [...review.changedFiles] } : {}),
  };
}

/**
 * Publishes a review: while one is current the update is deferred to `pending` so an in-progress
 * review isn't yanked; the latest update wins over any previously held one.
 */
export function applyPublishedReview(state: ReviewServiceState, review: ReviewState): void {
  if (state.current === null) {
    state.current = review;
    state.pending = null;
  } else {
    state.pending = review;
  }
}

/** Promotes the deferred update to current. No-op when nothing is pending. */
export function applyAcceptPending(state: ReviewServiceState): void {
  if (state.pending !== null) {
    state.current = toPlainReview(state.pending);
    state.pending = null;
  }
}

/**
 * Marks the current review stale once the grace window has passed. Replaces `current` with a plain
 * deep copy: a fresh reference keeps same-realm query subscribers reactive, and the deep copy
 * avoids leaving proxied nested arrays behind (which `structuredClone` cannot snapshot).
 */
export function applyMarkStale(state: ReviewServiceState, now: number): void {
  const current = state.current;
  if (
    current?.createdAt !== undefined &&
    !current.stale &&
    now >= current.createdAt + REVIEW_STALE_GRACE_MS
  ) {
    state.current = { ...toPlainReview(current), stale: true };
  }
}

/** Clears the current review and any deferred update. */
export function applyDismiss(state: ReviewServiceState): void {
  state.current = null;
  state.pending = null;
}
