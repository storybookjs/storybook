import * as v from 'valibot';

import { OpenServiceMissingOriginError } from '../../../../server-errors.ts';
import { defineToolset } from '../../toolset-definition.ts';
import { reviewStateSchema, type ReviewService } from '../../services/review/definition.ts';

const reviewCreateInputSchema = v.object({
  ...v.omit(reviewStateSchema, ['createdAt', 'stale', 'changedFiles']).entries,
  changedFiles: v.pipe(
    v.array(v.string()),
    v.description(
      'Changed file paths, most central first. Pass an empty array when nothing changed.'
    )
  ),
});

export const reviewToolset = defineToolset({
  id: 'review',
  description: 'Create a curated Storybook review.',
  methods: {
    create: {
      schema: reviewCreateInputSchema,
      description: 'Validates story ids, publishes review state, and returns the review page URL.',
      handler: async (review, ctx) => {
        if (!ctx.origin) {
          throw new OpenServiceMissingOriginError({
            toolsetId: 'review',
            methodName: 'create',
          });
        }

        await ctx
          .getService<ReviewService>('core/review', { internal: true })
          .commands.setReview(review);

        const reviewUrl = `${ctx.origin.replace(/\/$/, '')}/?path=/review/`;
        if (ctx.format === 'json') {
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

export type ReviewToolset = typeof reviewToolset;
