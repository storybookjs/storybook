/**
 * Shared definition for the local-command open-service sync demo.
 *
 * The `setValue` handler lives in this definition, so every runtime that registers the service can
 * execute the command locally and broadcast the resulting state.
 */

import * as v from 'valibot';

import { defineService } from 'storybook/open-service';

type LocalCommandState = {
  value: string;
};

export const localCommandSyncServiceDef = defineService({
  id: 'storybook/internal/open-service-local-command-sync-demo',
  description: 'Internal demo service for validating local command execution and state sync.',
  initialState: { value: '' } satisfies LocalCommandState,
  queries: {
    value: {
      description: 'Returns the current synchronized text value.',
      input: v.void(),
      output: v.string(),
      handler: (_input, ctx) => ctx.self.state.value,
    },
  },
  commands: {
    setValue: {
      description: 'Sets the synchronized text value locally in each registered runtime.',
      input: v.object({ value: v.string() }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.value = input.value;
        });
      },
    },
  },
});
