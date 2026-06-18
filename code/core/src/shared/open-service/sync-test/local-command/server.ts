import { registerService } from 'storybook/internal/common';
import { localCommandSyncServiceDef } from './definition.ts';

export function registerLocalCommandSyncService() {
  const service = registerService(localCommandSyncServiceDef);

  let previousValue: string | undefined;

  service.queries.getValue.subscribe(undefined, ({ data }) => {
    const value = data ?? '';
    if (previousValue === undefined) {
      console.log(`[open-service-local-command-sync-demo] initial value: ${JSON.stringify(value)}`);
    } else if (value !== previousValue) {
      console.log(
        `[open-service-local-command-sync-demo] value changed: ${JSON.stringify(previousValue)} -> ${JSON.stringify(value)}`
      );
    }
    previousValue = value;
  });

  return service;
}
