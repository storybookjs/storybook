import retry from 'fetch-retry';

import type { TelemetryEvent } from './types.ts';

const URL = process.env.STORYBOOK_TELEMETRY_URL || 'https://storybook.js.org/event-log';

export function postEvent(event: TelemetryEvent) {
  const signal = AbortSignal.timeout(30_000);
  return retry(fetch)(URL, {
    method: 'post',
    body: JSON.stringify(event),
    headers: { 'Content-Type': 'application/json' },
    signal,
    retryDelay: (attempt) => 2 ** attempt * 1000,
    // A request can fail after the server stored the event; the eventId lets it drop the retry.
    retryOn: (attempt, error, response) =>
      !signal.aborted &&
      attempt < 3 &&
      (Boolean(error) || response?.status === 503 || response?.status === 504),
  });
}
