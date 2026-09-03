import * as v from 'valibot';

import { defineService } from 'storybook/open-service';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import type { ServiceInstanceOf } from '../../types.ts';

type StoryIndexServiceState = {
  index: StoryIndex | undefined;
};

// Shape-checked only: the full `IndexEntry` union is typed, and validating thousands of entries on
// every read would cost more than reading the index.
const storyIndexSchema = v.custom<StoryIndex>(
  (value) => typeof value === 'object' && value !== null && 'entries' in value
);

/**
 * Definition for the `core/story-index` open service.
 *
 * The dev server owns the index through its `StoryIndexGenerator`; this service carries that index
 * as state so other runtimes read it synced instead of indexing the project themselves. The load is
 * a no-op while an index is stored: `_invalidate` drops it when the generator invalidates, so a
 * stored index is always the generator's current one.
 */
export const storyIndexServiceDef = defineService({
  id: 'core/story-index',
  internal: true,
  description: 'The story index of the running Storybook, as its dev server computed it.',
  initialState: { index: undefined } as StoryIndexServiceState,
  queries: {
    index: {
      description: 'Returns the current story index, or undefined when none has been loaded.',
      input: v.void(),
      output: v.optional(storyIndexSchema),
      handler: (_input, ctx) => ctx.self.state.index,
      load: async (_input, ctx) => {
        if (ctx.self.state.index !== undefined) {
          return;
        }
        await ctx.self.commands._refresh(undefined);
      },
    },
  },
  commands: {
    _refresh: {
      internal: true,
      description:
        'Reads the index from the generator and stores it. Handler supplied at server registration.',
      input: v.undefined(),
      output: v.void(),
    },
    _invalidate: {
      internal: true,
      description:
        'Drops the stored index after the generator invalidated it, so the next load reads a fresh one.',
      input: v.undefined(),
      output: v.void(),
    },
  },
});

export type StoryIndexService = ServiceInstanceOf<typeof storyIndexServiceDef>;
