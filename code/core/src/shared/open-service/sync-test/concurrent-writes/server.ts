import { registerService } from 'storybook/internal/common';
import { concurrentWritesSyncServiceDef } from './definition.ts';

export function registerConcurrentWritesSyncService() {
  const service = registerService(concurrentWritesSyncServiceDef);

  let previousSlots: string | undefined;

  service.queries.slots.subscribe(undefined, ({ data }) => {
    const serialized = JSON.stringify(data ?? {});
    if (previousSlots === undefined) {
      console.log(`[open-service-concurrent-writes-sync-demo] initial slots: ${serialized}`);
    } else if (serialized !== previousSlots) {
      console.log(
        `[open-service-concurrent-writes-sync-demo] slots changed: ${previousSlots} -> ${serialized}`
      );
    }
    previousSlots = serialized;
  });

  return service;
}
