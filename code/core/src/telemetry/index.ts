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

export * from './ai-setup-utils.ts';

export {
  getPrecedingUpgrade,
  getLastEvents,
  isWithinInitialSession,
  type CacheEntry,
} from './event-cache.ts';

export { getSessionId, SESSION_TIMEOUT } from './session-id.ts';

export { addToGlobalContext } from './telemetry.ts';

export { detectAgent, type AgentInfo } from './detect-agent.ts';

/** Is this story part of the CLI generated examples, including user-created stories in those files */
export const isExampleStoryId = (storyId: string) =>
  storyId.startsWith('example-button--') ||
  storyId.startsWith('example-header--') ||
  storyId.startsWith('example-page--');

// --- State machine ---

type TelemetryState = undefined | 'enabled' | 'disabled';

export type QueuedEvent = {
  eventType: EventType;
  payload: PayloadInput;
  options: Partial<Options>;
  timestamp: number;
};

// State and queue live on globalThis and are only initialized when absent, because this module
// can load more than once in the same process (e.g. an addon resolving its own copy of the
// storybook package, or dual CJS/ESM loading). An unconditional assignment would reset
// already-resolved state back to uninitialized, silently queueing all subsequent events forever.
if (!('SB_TELEMETRY_STATE' in globalThis)) {
  // Start in uninitialized state until we know whether telemetry is enabled or disabled based on
  // presets and CLI options. In the meantime, events are queued.
  globalThis.SB_TELEMETRY_STATE = undefined as TelemetryState;
}

if (!('SB_TELEMETRY_QUEUE' in globalThis)) {
  globalThis.SB_TELEMETRY_QUEUE = [];
}

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
    const pending = globalThis.SB_TELEMETRY_QUEUE;
    globalThis.SB_TELEMETRY_QUEUE = [];
    for (const event of pending) {
      try {
        await _processAndSend(event.eventType, event.payload, {
          ...event.options,
          timestamp: event.timestamp,
        });
      } catch (error) {
        logger.warn('Failed to flush queued telemetry event');
        logger.debug(error);
      }
    }
  } else {
    // Clear the queue (disabled, or already resolved)
    globalThis.SB_TELEMETRY_QUEUE = [];
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

// --- Payload error handler ---

/**
 * Callback invoked when a payload factory throws or returns { error }.
 * Registered by withTelemetry() to delegate to sendTelemetryError with full context
 * (presets, cache, error levels, sub-errors).
 */
type PayloadErrorHandler = (error: Error, eventType: EventType) => Promise<void>;

// Guarded for the same reason as SB_TELEMETRY_STATE above: a second load of this module must not
// clear a handler registered through the first one.
if (!('PAYLOAD_ERROR_HANDLER' in globalThis)) {
  globalThis.PAYLOAD_ERROR_HANDLER = undefined as PayloadErrorHandler | undefined;
}

/**
 * Register a handler for payload factory errors. When a telemetry payload factory
 * throws or returns { error }, this handler is called instead of sending the normal event.
 * Pass undefined to clear the handler.
 *
 * This is used by withTelemetry() to wire up sendTelemetryError with full context
 * (cliOptions, presetOptions, error levels, sub-errors) so all commands benefit
 * from automatic error telemetry.
 */
export function onPayloadError(handler: PayloadErrorHandler | undefined) {
  globalThis.PAYLOAD_ERROR_HANDLER = handler;
}

// --- Internal send logic ---

async function _processAndSend(
  eventType: EventType,
  payloadInput: PayloadInput,
  options: Partial<Options> = {}
) {
  let payload: Payload;

  try {
    payload = await resolvePayload(payloadInput);
  } catch (err) {
    // If the payload factory throws, delegate to the registered error handler
    if (eventType !== 'error' && globalThis.PAYLOAD_ERROR_HANDLER) {
      const error = err instanceof Error ? err : new Error(String(err));
      await globalThis.PAYLOAD_ERROR_HANDLER(error, eventType);
    }
    return;
  }

  // When a payload factory returns { error }, delegate to the registered error handler
  if (payload.error && eventType !== 'error' && globalThis.PAYLOAD_ERROR_HANDLER) {
    const error = payload.error instanceof Error ? payload.error : new Error(String(payload.error));
    await globalThis.PAYLOAD_ERROR_HANDLER(error, eventType);
    return;
  }

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
    globalThis.SB_TELEMETRY_QUEUE.push({ eventType, payload, options, timestamp: Date.now() });
    return;
  }

  await _processAndSend(eventType, payload, options);
};
