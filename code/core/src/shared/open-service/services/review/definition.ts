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

export type ReviewServiceState = {
  current: ReviewState | null;
};

export const REVIEW_STALE_GRACE_MS = 10_000;

/**
 * Stateful review coordination shared by the server and manager realms.
 */
export const reviewServiceDef = defineService({
  id: 'core/review',
  internal: true,
  description: 'Owns the current curated Storybook review and its staleness.',
  initialState: { current: null } as ReviewServiceState,
  queries: {
    current: {
      description: 'Returns the current review, or null when no review is active.',
      input: v.undefined(),
      output: v.nullable(reviewStateSchema),
      handler: (_input, ctx) => ctx.self.state.current,
    },
  },
  commands: {
    setReview: {
      description:
        'Replaces the current review and assigns its server creation time. Implemented by the server.',
      input: reviewStateSchema,
      output: v.void(),
    },
    markStale: {
      description: 'Marks the current review stale. Implemented by the server.',
      input: v.undefined(),
      output: v.void(),
    },
    dismissReview: {
      description: 'Clears the current review. Implemented by the server.',
      input: v.undefined(),
      output: v.void(),
    },
  },
});

export type ReviewService = ServiceInstanceOf<typeof reviewServiceDef>;
