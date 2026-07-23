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
      description: 'Replaces the current review and assigns its server creation time.',
      input: reviewStateSchema,
      output: v.void(),
      handler: async (input, ctx) => {
        const { stale: _stale, createdAt: _createdAt, ...review } = input;
        ctx.self.setState((state) => {
          state.current = { ...review, createdAt: Date.now() };
        });
      },
    },
    markStale: {
      description: 'Marks the current review stale after the source-change grace period.',
      input: v.undefined(),
      output: v.void(),
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          const current = state.current;
          if (
            current?.createdAt !== undefined &&
            !current.stale &&
            Date.now() >= current.createdAt + 10_000
          ) {
            current.stale = true;
          }
        });
      },
    },
    dismissReview: {
      description: 'Clears the current review.',
      input: v.undefined(),
      output: v.void(),
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          state.current = null;
        });
      },
    },
  },
});

export type ReviewService = ServiceInstanceOf<typeof reviewServiceDef>;
