/**
 * Shared definition for the static-load open-service sync demo.
 *
 * `getEntry` participates in static builds via `staticPath` + `staticInputs`; its `load` calls the
 * server-only `computeEntry` command. `getUnbacked` has a `load` but no `staticPath`, so static
 * builds exercise the no-ack remote-command path.
 */

import * as v from 'valibot';

import { defineService } from 'storybook/open-service';

const entryInputSchema = v.object({ id: v.string() });

export type StaticLoadDemoState = {
  entries: Record<string, string>;
  unbacked: string | null;
};

const initialState: StaticLoadDemoState = { entries: {}, unbacked: null };

export const staticLoadSyncServiceDef = defineService({
  id: 'storybook/internal/open-service-static-load-demo',
  description:
    'Internal demo service for validating static JSON loading and unhandled remote commands.',
  initialState,
  queries: {
    getEntry: {
      description: 'Returns one preloaded entry by id.',
      input: entryInputSchema,
      output: v.optional(v.string()),
      handler: (input, ctx) => ctx.self.state.entries[input.id],
      load: async (input, ctx) => {
        await ctx.self.commands.computeEntry(input);
      },
      staticPath: (input) => `${input.id}.json`,
      staticInputs: async () => [{ id: 'alpha' }, { id: 'beta' }],
    },
    getUnbacked: {
      description:
        'Returns the unbacked entry populated by a server-only command (no static snapshot).',
      input: v.void(),
      output: v.nullable(v.string()),
      handler: (_input, ctx) => ctx.self.state.unbacked,
      load: async (_input, ctx) => {
        await ctx.self.commands.computeUnbacked(undefined);
      },
    },
  },
  commands: {
    computeEntry: {
      description: 'Populates one static-load entry. Implemented at server registration.',
      input: entryInputSchema,
      output: v.void(),
    },
    computeUnbacked: {
      description: 'Populates the unbacked entry. Implemented at server registration.',
      input: v.undefined(),
      output: v.void(),
    },
  },
});
