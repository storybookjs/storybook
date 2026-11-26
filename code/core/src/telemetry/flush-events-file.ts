import { readFile, rm } from 'node:fs/promises';

import retry from 'fetch-retry';

import type { TelemetryEvent } from './types.ts';

const TELEMETRY_URL = process.env.STORYBOOK_TELEMETRY_URL || 'https://storybook.js.org/event-log';

export async function flushEventsFile(file: string): Promise<void> {
  const contents = await readFile(file, 'utf8');
  // Removed before anything can fail, so a file is never left behind or read twice.
  await rm(file, { force: true });
  const events: TelemetryEvent[] = JSON.parse(contents);
  await Promise.all(events.map((event) => postEvent(event).catch(() => {})));
}

function postEvent(event: TelemetryEvent) {
  const signal = AbortSignal.timeout(30_000);
  return retry(fetch)(TELEMETRY_URL, {
    method: 'post',
    body: JSON.stringify(event),
    headers: { 'Content-Type': 'application/json' },
    signal,
    retryDelay: (attempt) => 2 ** attempt * 1000,
    // A request can fail after the server stored the event; it drops the retry by its eventId.
    retryOn: (attempt, error, response) =>
      !signal.aborted &&
      attempt < 3 &&
      (Boolean(error) || response?.status === 503 || response?.status === 504),
  });
}
