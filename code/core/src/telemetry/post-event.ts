import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import type { TelemetryEvent } from './types.ts';

export type PendingEvent = {
  body: TelemetryEvent;
  retryDelay?: number;
};

export type PostOptions = {
  // Whether the request and its retry back-off may keep the process alive until the response
  // arrives. The detached child and `immediate` sends do; everything else is handed to the
  // child on exit instead.
  keepProcessAlive: boolean;
  signal?: AbortSignal;
};

const TELEMETRY_URL = process.env.STORYBOOK_TELEMETRY_URL || 'https://storybook.js.org/event-log';

const TIMEOUT = 30_000;
const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUSES = new Set([503, 504]);

export async function postEvent(
  { body, retryDelay = 1000 }: PendingEvent,
  { keepProcessAlive, signal = AbortSignal.timeout(TIMEOUT) }: PostOptions
): Promise<void> {
  const payload = JSON.stringify(body);
  for (let attempt = 0; ; attempt += 1) {
    const lastAttempt = attempt === MAX_ATTEMPTS - 1;
    try {
      const status = await post(payload, signal, keepProcessAlive);
      if (!RETRYABLE_STATUSES.has(status) || lastAttempt) {
        return;
      }
    } catch (error) {
      if (signal.aborted || lastAttempt) {
        throw error;
      }
    }
    await sleep(2 ** attempt * retryDelay, signal, keepProcessAlive);
  }
}

function post(payload: string, signal: AbortSignal, keepProcessAlive: boolean): Promise<number> {
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

function sleep(ms: number, signal: AbortSignal, keepProcessAlive: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (!keepProcessAlive) {
      timer.unref();
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
