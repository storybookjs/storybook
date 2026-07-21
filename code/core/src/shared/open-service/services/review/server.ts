import type { StoryIndex } from 'storybook/internal/types';

import { OpenServiceUnknownStoryIdsError } from '../../../../server-errors.ts';
import { REVIEW_EVENTS } from '../../../review/events.ts';
import { registerService } from '../../server.ts';
import { reviewServiceDef } from './definition.ts';

export type RegisterReviewServiceOptions = {
  channel: { emit: (event: string, payload: unknown) => void };
  getIndex: () => Promise<StoryIndex>;
  getOrigin: () => string;
};

/**
 * Collects story ids from review collections in order, deduplicating so each id appears once.
 */
function collectUniqueStoryIds(
  collections: ReadonlyArray<{ readonly storyIds: ReadonlyArray<string> }>
): string[] {
  const seen = new Set<string>();
  const inOrder: string[] = [];
  for (const collection of collections) {
    for (const id of collection.storyIds) {
      if (!seen.has(id)) {
        seen.add(id);
        inOrder.push(id);
      }
    }
  }
  return inOrder;
}

/**
 * Registers the `core/review` open service with `review.create` validation + channel publish.
 */
export function registerReviewService(options: RegisterReviewServiceOptions) {
  const { channel, getIndex, getOrigin } = options;

  return registerService(reviewServiceDef, {
    commands: {
      create: {
        handler: async (input) => {
          const storyIds = collectUniqueStoryIds(input.collections);
          const index = await getIndex();
          const unknownIds = storyIds.filter((id) => !index.entries[id]);

          if (unknownIds.length > 0) {
            throw new OpenServiceUnknownStoryIdsError({ unknownIds });
          }

          channel.emit(REVIEW_EVENTS.PUSH_REVIEW, input);

          const origin = getOrigin().replace(/\/$/, '');
          return { reviewUrl: `${origin}/?path=/review/` };
        },
      },
    },
  });
}
