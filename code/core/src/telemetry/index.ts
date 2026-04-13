import { logger } from 'storybook/internal/node-logger';

import { notify } from './notify.ts';
import { sanitizeError } from './sanitize.ts';
import { getStorybookMetadata } from './storybook-metadata.ts';
import { sendTelemetry } from './telemetry.ts';
import type {
  EventType,
  Options,
  Payload,
  PayloadFactory,
  PayloadInput,
  TelemetryData,
} from './types.ts';

export { oneWayHash } from './one-way-hash.ts';

export * from './storybook-metadata.ts';

export * from './types.ts';

export * from './sanitize.ts';

export * from './error-collector.ts';

export { getPrecedingUpgrade, getLastEvents, type CacheEntry } from './event-cache.ts';

export { getSessionId } from './session-id.ts';

export { addToGlobalContext } from './telemetry.ts';

/** Is this story part of the CLI generated examples, including user-created stories in those files */
export const isExampleStoryId = (storyId: string) =>
  storyId.startsWith('example-button--') ||
  storyId.startsWith('example-header--') ||
  storyId.startsWith('example-page--');

// --- State machine ---

type TelemetryState = undefined | 'enabled' | 'disabled';

globalThis.SB_TELEMETRY_STATE = undefined as TelemetryState; // Start in uninitialized state until we know whether telemetry is enabled or disabled based on presets and CLI options. In the meantime, events are queued.

type QueuedEvent = {
  eventType: EventType;
  payload: PayloadInput;
  options: Partial<Options>;
  timestamp: number;
};

let _queue: QueuedEvent[] = [];

const isPayloadFactory = (payload: PayloadInput): payload is PayloadFactory =>
  typeof payload === 'function';

const resolvePayload = async (payload: PayloadInput): Promise<Payload> =>
  isPayloadFactory(payload) ? await payload() : payload;

/**
 * Resolve telemetry state. When enabled, flushes the queue. When disabled, clears it.
 * This should be called once presets have been evaluated and the disableTelemetry config is known.
 */
export async function setTelemetryEnabled(enabled: boolean) {
  const previousState = globalThis.SB_TELEMETRY_STATE;
  globalThis.SB_TELEMETRY_STATE = enabled ? 'enabled' : 'disabled';

  if (enabled && previousState === undefined) {
    // Flush the queue
    const pending = _queue;
    _queue = [];
    for (const event of pending) {
      await _processAndSend(event.eventType, event.payload, {
        ...event.options,
        timestamp: event.timestamp,
      });
    }
  } else {
    // Clear the queue (disabled, or already resolved)
    _queue = [];
  }
}

/** Check whether telemetry is currently enabled. */
export function isTelemetryModuleEnabled() {
  return globalThis.SB_TELEMETRY_STATE === 'enabled';
}

/** Check whether the telemetry state has been resolved (is no longer uninitialized). */
export function isTelemetryStateResolved() {
  return globalThis.SB_TELEMETRY_STATE !== undefined;
}

// --- Internal send logic ---

async function _processAndSend(
  eventType: EventType,
  payloadInput: PayloadInput,
  options: Partial<Options> = {}
) {
  const payload = await resolvePayload(payloadInput);

  // Don't notify on boot since it can lead to double notification in `sb init`.
  // The notification will happen when the actual command runs.
  if (eventType !== 'boot' && options.notify !== false) {
    await notify();
  }

  const telemetryData: TelemetryData = {
    eventType,
    payload,
  };

  try {
    if (!options?.stripMetadata) {
      telemetryData.metadata = await getStorybookMetadata(options?.configDir);
    }
  } catch (error: any) {
    payload.metadataErrorMessage = sanitizeError(error).message;

    if (options?.enableCrashReports) {
      payload.metadataError = sanitizeError(error);
    }
  } finally {
    const { error } = payload;

    // make sure to anonymise possible paths from error messages
    if (error) {
      payload.error = sanitizeError(error);
    }

    if (!payload.error || options?.enableCrashReports) {
      if (process.env?.STORYBOOK_TELEMETRY_DEBUG) {
        logger.info('[telemetry]');
        logger.info(JSON.stringify(telemetryData, null, 2));
      }
      await sendTelemetry(telemetryData, options);
    }
  }
}

// --- Public API ---

export const telemetry = async (
  eventType: EventType,
  payload: PayloadInput = {},
  options: Partial<Options> = {}
) => {
  // force:true bypasses the disabled state (used for error telemetry with enableCrashReports)
  if (globalThis.SB_TELEMETRY_STATE === 'disabled' && !options.force) {
    return;
  }

  if (globalThis.SB_TELEMETRY_STATE === undefined && !options.force) {
    _queue.push({ eventType, payload, options, timestamp: Date.now() });
    return;
  }

  await _processAndSend(eventType, payload, options);
};
