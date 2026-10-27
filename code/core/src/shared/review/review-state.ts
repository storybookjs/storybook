/**
 * The review payload an agent publishes via the `review.create` toolset method.
 *
 * Flow: `review.create` calls the `core/review` service's `setReview` command; manager tabs
 * subscribe to the service's current-review query.
 *
 * This mirrors the canonical valibot schema in the review toolset definition. The manager only
 * renders the data — it does not validate — so it needs the type, not the validator. Keep `title` /
 * `description` / `collections` in sync with that schema.
 */

export interface ReviewCollection {
  title: string;
  rationale: string;
  storyIds: string[];
}

export interface ReviewState {
  title: string;
  description: string;
  collections: ReviewCollection[];
  changedFiles?: string[];
  /**
   * Server-side creation timestamp (unix ms) assigned when the review is
   * received; used for live "Created x minutes ago" UI in the summary.
   */
  createdAt?: number;
  /**
   * Set server-side once a watched source file changes after `createdAt`.
   * Drives the "this review may be stale" banner and synchronizes through the review service.
   */
  stale?: boolean;
}
