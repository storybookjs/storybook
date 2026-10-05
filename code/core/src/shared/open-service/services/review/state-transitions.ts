import type { ReviewState } from '../../../review/review-state.ts';
import type { ReviewServiceState } from './definition.ts';

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
 * Marks the current and pending reviews stale when `revision` is newer than the module-graph
 * revision each was published at. Replaces a marked review with a plain deep copy: a fresh
 * reference keeps same-realm query subscribers reactive, and the deep copy avoids leaving proxied
 * nested arrays behind (which `structuredClone` cannot snapshot).
 */
export function applyMarkStale(state: ReviewServiceState, revision: number): void {
  const isOutdated = (review: ReviewState | null): review is ReviewState =>
    review?.revision !== undefined && !review.stale && revision > review.revision;

  if (isOutdated(state.current)) {
    state.current = { ...toPlainReview(state.current), stale: true };
  }
  if (isOutdated(state.pending)) {
    state.pending = { ...toPlainReview(state.pending), stale: true };
  }
}

/** Clears the current review and any deferred update. */
export function applyDismiss(state: ReviewServiceState): void {
  state.current = null;
  state.pending = null;
}
