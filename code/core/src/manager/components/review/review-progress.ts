// Reviewed-progress tracking: which stories the user has visited within the
// active review. A story counts as reviewed the moment its review story screen
// becomes active (mark-on-arrival, see ReviewProvider). Progress is per unique
// storyId and persisted in sessionStorage keyed by the review's `createdAt`, so
// it survives reload but resets when a new review is displayed or accepted.
import { REVIEW_PROGRESS_KEY_PREFIX } from './constants.ts';
import type { ReviewNavEntry } from './review-navigation.ts';
import { sessionStore } from './session-store.ts';

const progressKey = (createdAt: number): string => `${REVIEW_PROGRESS_KEY_PREFIX}/${createdAt}`;

/**
 * Read persisted reviewed story ids for a review. Reviews without a `createdAt`
 * cannot be keyed, so they start empty and live in memory for the session.
 */
export const readReviewProgress = (createdAt: number | undefined): Set<string> => {
  if (createdAt === undefined) {
    return new Set();
  }
  const raw = sessionStore.read(progressKey(createdAt));
  if (!raw) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id): id is string => typeof id === 'string'));
    }
  } catch {
    // Corrupt value — start fresh.
  }
  return new Set();
};

export const writeReviewProgress = (
  createdAt: number | undefined,
  reviewedStoryIds: Set<string>
): void => {
  if (createdAt === undefined) {
    return;
  }
  sessionStore.write(progressKey(createdAt), JSON.stringify([...reviewedStoryIds]));
};

export const clearReviewProgress = (createdAt: number | undefined): void => {
  if (createdAt === undefined) {
    return;
  }
  sessionStore.remove(progressKey(createdAt));
};

/** Count reviewed stories that belong to the current review (intersection). */
export const countReviewed = (
  reviewedStoryIds: Set<string>,
  reviewStoryIds: Set<string>
): number => {
  let count = 0;
  for (const storyId of reviewStoryIds) {
    if (reviewedStoryIds.has(storyId)) {
      count += 1;
    }
  }
  return count;
};

/** First flattened slot whose story has not been reviewed, in collection order. */
export const findFirstUnreviewedEntry = (
  entries: readonly ReviewNavEntry[],
  reviewedStoryIds: Set<string>
): ReviewNavEntry | null => entries.find((entry) => !reviewedStoryIds.has(entry.storyId)) ?? null;

/** Stable key identifying a flattened nav slot (story occurrence). */
export const reviewEntryKey = (entry: ReviewNavEntry): string =>
  `${entry.collectionIndex}:${entry.storyId}`;
