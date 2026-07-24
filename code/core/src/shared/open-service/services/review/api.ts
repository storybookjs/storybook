import * as v from 'valibot';

import { OpenServiceMissingOriginError } from '../../../../server-errors.ts';
import { defineApi } from '../../../public-api/index.ts';

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

export const reviewApi = defineApi({
  id: 'review',
  description: 'Create a curated Storybook review.',
  methods: {
    create: {
      schema: reviewCreateInputSchema,
      description: 'Validates story ids, publishes review state, and returns the review page URL.',
      handler: async ({ json, ...review }, ctx) => {
        if (!ctx.origin) {
          throw new OpenServiceMissingOriginError({
            serviceId: 'review',
            operationName: 'create',
          });
        }

        await ctx.getService('core/review').commands.setReview(review);

        const reviewUrl = `${ctx.origin.replace(/\/$/, '')}/?path=/review/`;
        if (json) {
          return { reviewUrl };
        }

        const markdown = `Review created: ${reviewUrl}`;
        return ctx.consumer === 'mcp'
          ? `${markdown}\n\nShow this review URL to the user in your final response.`
          : markdown;
      },
    },
  },
});

export type ReviewApi = typeof reviewApi;
