/**
 * Shared definition for the remote-command open-service sync demo.
 *
 * Manager and preview share this contract but do not implement `setValue`; the server supplies the
 * handler at registration time. Typing in either UI invokes the server remotely, then syncs the
 * updated state back to every runtime.
 */

import * as v from 'valibot';

import { defineService } from 'storybook/open-service';

type RemoteCommandState = {
  value: string;
};

export const remoteCommandSyncServiceDef = defineService({
  id: 'storybook/internal/open-service-remote-command-sync-demo',
  description: 'Internal demo service for validating remote command execution and state sync.',
  initialState: { value: '' } satisfies RemoteCommandState,
  queries: {
    getValue: {
      description: 'Returns the current synchronized text value.',
      input: v.void(),
      output: v.string(),
      handler: (_input, ctx) => ctx.self.state.value,
    },
  },
  commands: {
    setValue: {
      description: 'Sets the synchronized text value. Implemented at server registration.',
      input: v.object({ value: v.string() }),
      output: v.void(),
    },
  },
});
