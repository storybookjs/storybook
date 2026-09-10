/**
 * Shared definition for the concurrent-writes open-service sync demo.
 *
 * `setSlot` and `clearSlots` live in this definition so every runtime runs them locally. Each writer
 * owns its own slot key so two sequential writes both remain visible.
 */

import * as v from 'valibot';

import { defineService } from 'storybook/open-service';

type ConcurrentWritesState = {
  slots: Record<string, string>;
};

export const concurrentWritesSyncServiceDef = defineService({
  id: 'storybook/internal/open-service-concurrent-writes-sync-demo',
  description: 'Internal demo service for sequential and concurrent writes to distinct keys.',
  initialState: { slots: {} as Record<string, string> } satisfies ConcurrentWritesState,
  queries: {
    slots: {
      description: 'Returns the raw slots map.',
      input: v.void(),
      output: v.record(v.string(), v.string()),
      handler: (_input, ctx) => ({ ...ctx.self.state.slots }),
    },
  },
  commands: {
    setSlot: {
      description: 'Writes one slot key. One invocation is one sync entry.',
      input: v.object({ slot: v.string(), value: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.slots[input.slot] = input.value;
        });
      },
    },
    clearSlots: {
      description: 'Removes every slot key.',
      input: v.void(),
      output: v.void(),
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          state.slots = {};
        });
      },
    },
  },
});
