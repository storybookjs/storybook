import type { StoryIndex } from 'storybook/internal/types';

import * as v from 'valibot';

import {
  OpenServiceMissingOriginError,
  OpenServiceUnknownStoryIdsError,
} from '../../../../server-errors.ts';
import { defineApi, registerPublicApi } from '../../../public-api/index.ts';
import { getService } from '../../server.ts';

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
  json: v.optional(
    v.pipe(v.boolean(), v.description('When true, return structured JSON instead of Markdown.')),
    false
  ),
});

export type CreateReviewApiOptions = {
  getIndex: () => Promise<StoryIndex>;
  getOrigin: () => string;
};

function collectUniqueStoryIds(
  collections: ReadonlyArray<{ readonly storyIds: ReadonlyArray<string> }>
): string[] {
  const seen = new Set<string>();
  return collections.flatMap(({ storyIds }) =>
    storyIds.filter((storyId) => {
      if (seen.has(storyId)) {
        return false;
      }
      seen.add(storyId);
      return true;
    })
  );
}

/** Creates the public one-shot review API around the stateful review service. */
export function createReviewApi({ getIndex, getOrigin }: CreateReviewApiOptions) {
  return defineApi({
    id: 'review',
    description: 'Create a curated Storybook review.',
    methods: {
      create: {
        schema: reviewCreateInputSchema,
        description:
          'Validates story ids, publishes review state, and returns the review page URL.',
        handler: async ({ json, ...review }, context) => {
          const origin = getOrigin();
          if (!origin) {
            throw new OpenServiceMissingOriginError({
              serviceId: 'review',
              operationName: 'create',
            });
          }

          const index = await getIndex();
          const unknownIds = collectUniqueStoryIds(review.collections).filter(
            (storyId) => !index.entries[storyId]
          );
          if (unknownIds.length > 0) {
            throw new OpenServiceUnknownStoryIdsError({ unknownIds });
          }

          await getService('core/review').commands.setReview(review);

          const reviewUrl = `${origin.replace(/\/$/, '')}/?path=/review/`;
          if (json) {
            return { reviewUrl };
          }

          const markdown = `Review created: ${reviewUrl}`;
          return context.consumer === 'mcp'
            ? `${markdown}\n\nShow this review URL to the user in your final response.`
            : markdown;
        },
      },
    },
  });
}

/** Registers the public review API with its runtime dependencies. */
export function registerReviewApi(options: CreateReviewApiOptions) {
  const reviewApi = createReviewApi(options);
  registerPublicApi([reviewApi]);
  return reviewApi;
}

export type ReviewApi = ReturnType<typeof createReviewApi>;
