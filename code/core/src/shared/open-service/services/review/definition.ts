import * as v from 'valibot';

import type { ReviewState } from '../../../review/review-state.ts';
import { defineService } from '../../service-definition.ts';
import type { ServiceInstanceOf } from '../../types.ts';

const reviewCollectionSchema = v.object({
  title: v.pipe(v.string(), v.description('Collection title shown on the review page.')),
  rationale: v.pipe(
    v.string(),
    v.description('Why this collection is relevant. Plain text, one or two sentences.')
  ),
  storyIds: v.pipe(v.array(v.string()), v.description('Story ids included in this collection.')),
});

export const reviewStateSchema = v.object({
  title: v.pipe(v.string(), v.description('Terse review title. Plain text.')),
  description: v.pipe(
    v.string(),
    v.description(
      'Review scope and what to look for. Limited markdown: bold, italic, and inline code.'
    )
  ),
  collections: v.array(reviewCollectionSchema),
  changedFiles: v.optional(
    v.pipe(
      v.array(v.string()),
      v.description(
        'Changed file paths, most central first. Pass an empty array when nothing changed.'
      )
    )
  ),
  createdAt: v.optional(v.number()),
  stale: v.optional(v.boolean()),
});

const reviewNavEntrySchema = v.object({
  storyId: v.pipe(v.string(), v.description('Story id of this navigation slot.')),
  collectionIndex: v.pipe(
    v.number(),
    v.description('Index of the collection this slot belongs to.')
  ),
});

export type ReviewServiceState = {
  current: ReviewState | null;
  /** An updated review held back until a reviewer accepts it, so in-progress reviews aren't yanked. */
  pending: ReviewState | null;
};

export const REVIEW_STALE_GRACE_MS = 10_000;

/**
 * Stateful review coordination shared by the server and manager realms.
 */
export const reviewServiceDef = defineService({
  id: 'core/review',
  internal: true,
  description: 'Owns the current curated Storybook review, its deferred update, and its staleness.',
  initialState: { current: null, pending: null } as ReviewServiceState,
  queries: {
    current: {
      description: 'Returns the current review, or null when no review is active.',
      input: v.undefined(),
      output: v.nullable(reviewStateSchema),
      handler: (_input, ctx) => ctx.self.state.current,
    },
    pending: {
      description: 'Returns the deferred review update, or null when none is held.',
      input: v.undefined(),
      output: v.nullable(reviewStateSchema),
      handler: (_input, ctx) => ctx.self.state.pending,
    },
    flattenedEntries: {
      description:
        'Returns the current review flattened into navigable story slots, walking collections in order (a story repeats when curated into several collections). Empty when no review is active.',
      input: v.undefined(),
      output: v.array(reviewNavEntrySchema),
      handler: (_input, ctx) =>
        (ctx.self.state.current?.collections ?? []).flatMap((collection, collectionIndex) =>
          collection.storyIds.map((storyId) => ({ storyId, collectionIndex }))
        ),
    },
    bannerKind: {
      description:
        'Returns which attention banner review surfaces should show: pending-update outranks stale (accepting the update supersedes the warning); null when neither applies.',
      input: v.undefined(),
      output: v.nullable(v.picklist(['pending-update', 'stale'])),
      handler: (_input, ctx) =>
        ctx.self.state.pending !== null
          ? 'pending-update'
          : ctx.self.state.current?.stale
            ? 'stale'
            : null,
    },
  },
  commands: {
    setReview: {
      description:
        'Publishes a review and assigns its server creation time. Defers to pending while any review is current. Implemented by the server.',
      input: reviewStateSchema,
      output: v.void(),
    },
    acceptPending: {
      description: 'Promotes the deferred review update to current. Implemented by the server.',
      input: v.undefined(),
      output: v.void(),
    },
    markStale: {
      description: 'Marks the current review stale. Implemented by the server.',
      input: v.undefined(),
      output: v.void(),
    },
    dismissReview: {
      description: 'Clears the current review and any deferred update. Implemented by the server.',
      input: v.undefined(),
      output: v.void(),
    },
  },
});

export type ReviewService = ServiceInstanceOf<typeof reviewServiceDef>;
