import { readFile, rm } from 'node:fs/promises';

import { type PendingEvent, postEvent } from './post-event.ts';

export async function flushEventsFile(file: string): Promise<void> {
  const contents = await readFile(file, 'utf8');
  await rm(file, { force: true });
  const events: PendingEvent[] = JSON.parse(contents);
  await Promise.all(
    events.map((event) => postEvent(event, { keepProcessAlive: true }).catch(() => {}))
  );
}
