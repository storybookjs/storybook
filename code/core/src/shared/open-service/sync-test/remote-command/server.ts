import { registerService } from 'storybook/internal/common';
import { remoteCommandSyncServiceDef } from './definition.ts';

export function registerRemoteCommandSyncService() {
  const service = registerService(remoteCommandSyncServiceDef, {
    commands: {
      setValue: {
        handler: async (input, ctx) => {
          ctx.self.setState((state) => {
            state.value = input.value;
          });
        },
      },
    },
  });

  let previousValue: string | undefined;

  service.queries.getValue.subscribe(undefined, ({ data }) => {
    const value = data ?? '';
    if (previousValue === undefined) {
      console.log(
        `[open-service-remote-command-sync-demo] initial value: ${JSON.stringify(value)}`
      );
    } else if (value !== previousValue) {
      console.log(
        `[open-service-remote-command-sync-demo] value changed: ${JSON.stringify(previousValue)} -> ${JSON.stringify(value)}`
      );
    }
    previousValue = value;
  });

  return service;
}
