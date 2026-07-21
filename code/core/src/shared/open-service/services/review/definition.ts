import * as v from 'valibot';

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

const reviewCreateInputSchema = v.object({
  title: v.pipe(v.string(), v.description('Terse review title. Plain text.')),
  description: v.pipe(
    v.string(),
    v.description(
      'Review scope and what to look for. Limited markdown: bold, italic, and inline code.'
    )
  ),
  collections: v.array(reviewCollectionSchema),
  changedFiles: v.pipe(
    v.array(v.string()),
    v.description(
      'Changed file paths, most central first. Pass an empty array when nothing changed.'
    )
  ),
});

const reviewCreateOutputSchema = v.object({
  reviewUrl: v.pipe(v.string(), v.description('URL of the Storybook review page.')),
});

export type ReviewServiceState = Record<string, never>;

/**
 * Review publication (`review.create`).
 *
 * Creates review state and returns a URL. Browser-opening instructions and Markdown remain
 * adapter concerns.
 */
export const reviewServiceDef = defineService({
  id: 'core/review',
  description: 'Create a curated Storybook review and return its URL.',
  initialState: {} as ReviewServiceState,
  queries: {},
  commands: {
    create: {
      description: 'Validates story ids, publishes review state, and returns the review page URL.',
      input: reviewCreateInputSchema,
      output: reviewCreateOutputSchema,
    },
  },
});

export type ReviewService = ServiceInstanceOf<typeof reviewServiceDef>;
