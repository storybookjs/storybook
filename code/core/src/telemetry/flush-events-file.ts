import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';

import { type PendingEvent, postEvent } from './post-event.ts';

const HAND_OVER_FILE = /^storybook-telemetry-[\w-]+\.json$/;

export async function flushEventsFile(file: string): Promise<void> {
  // The file is deleted unread, so this must never be handed anything but a hand-over file.
  if (dirname(file) !== tmpdir() || !HAND_OVER_FILE.test(basename(file))) {
    return;
  }
  const contents = await readFile(file, 'utf8');
  await rm(file, { force: true });
  const events: PendingEvent[] = JSON.parse(contents);
  await Promise.all(
    events.map((event) => postEvent(event, { keepProcessAlive: true }).catch(() => {}))
  );
}
