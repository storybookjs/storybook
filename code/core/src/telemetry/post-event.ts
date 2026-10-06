import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { setTimeout as sleep } from 'node:timers/promises';

import type { TelemetryEvent } from './types.ts';

export type PendingEvent = {
  body: TelemetryEvent;
  retryDelay?: number;
};

export type PostOptions = {
  // Only the detached child may hold the process open for a response.
  keepProcessAlive: boolean;
  signal?: AbortSignal;
};

const TELEMETRY_URL = process.env.STORYBOOK_TELEMETRY_URL || 'https://storybook.js.org/event-log';
const request = TELEMETRY_URL.startsWith('https:') ? httpsRequest : httpRequest;

const TIMEOUT = 30_000;
const CONNECT_TIMEOUT = 500;
const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUSES = new Set([503, 504]);

// Thrown without a retry: the event is left for the detached process, which may wait longer.
export class ConnectTimeoutError extends Error {}

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
      if (signal.aborted || lastAttempt || error instanceof ConnectTimeoutError) {
        throw error;
      }
    }
    await sleep(2 ** attempt * retryDelay, undefined, { signal, ref: keepProcessAlive });
  }
}

function post(payload: string, signal: AbortSignal, keepProcessAlive: boolean): Promise<number> {
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
      outgoing.on('socket', (socket) => {
        socket.unref();
        if (socket.connecting) {
          // Unlike a pending response, a pending connect holds the process open even on an
          // unref'd socket.
          const deadline = setTimeout(
            () => outgoing.destroy(new ConnectTimeoutError()),
            CONNECT_TIMEOUT
          ).unref();
          socket.once('connect', () => clearTimeout(deadline));
        }
      });
    }
    outgoing.on('error', reject);
    outgoing.end(payload);
  });
}
