import { readFile, rm } from 'node:fs/promises';

import { type PendingEvent, postEvent } from './post-event.ts';

export async function flushEventsFile(file: string): Promise<void> {
  const events: PendingEvent[] = JSON.parse(await readFile(file, 'utf8'));
  await rm(file, { force: true });
  await Promise.all(
    events.map((event) =>
      postEvent(event, { signal: AbortSignal.timeout(30_000), keepProcessAlive: true }).catch(
        () => {}
      )
    )
  );
}
