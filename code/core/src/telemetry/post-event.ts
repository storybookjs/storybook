import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import type { TelemetryEvent } from './types.ts';

export type PendingEvent = {
  body: TelemetryEvent;
  retryDelay?: number;
};

export type PostOptions = {
  signal: AbortSignal;
  /**
   * Whether the request may keep the process alive until its response arrives. A process that
   * exits with unfinished requests hands them to a detached child, so only that child, and an
   * `immediate` send, hold on to it.
   */
  keepProcessAlive: boolean;
};

const TELEMETRY_URL = process.env.STORYBOOK_TELEMETRY_URL || 'https://storybook.js.org/event-log';

const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUSES = new Set([503, 504]);

export async function postEvent(
  { body, retryDelay = 1000 }: PendingEvent,
  options: PostOptions
): Promise<void> {
  const payload = JSON.stringify(body);
  for (let attempt = 0; ; attempt += 1) {
    const lastAttempt = attempt === MAX_ATTEMPTS - 1;
    try {
      const status = await post(payload, options);
      if (!RETRYABLE_STATUSES.has(status) || lastAttempt) {
        return;
      }
    } catch (error) {
      if (options.signal.aborted || lastAttempt) {
        throw error;
      }
    }
    await sleep(2 ** attempt * retryDelay, options.signal);
  }
}

function post(payload: string, { signal, keepProcessAlive }: PostOptions): Promise<number> {
  const request = TELEMETRY_URL.startsWith('https:') ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const outgoing = request(
      TELEMETRY_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        signal,
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode ?? 0));
        response.on('error', reject);
      }
    );
    if (!keepProcessAlive) {
      outgoing.on('socket', (socket) => socket.unref());
    }
    outgoing.on('error', reject);
    outgoing.end(payload);
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}
