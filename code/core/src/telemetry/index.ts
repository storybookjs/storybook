import { logger } from 'storybook/internal/node-logger';

import { notify } from './notify';
import { sanitizeError } from './sanitize';
import { getStorybookMetadata } from './storybook-metadata';
import { sendTelemetry } from './telemetry';
import type { EventType, Options, Payload, TelemetryData } from './types';

export { oneWayHash } from './one-way-hash';

export * from './storybook-metadata';

export * from './types';

export * from './sanitize';

export * from './error-collector';

export { getPrecedingUpgrade, getLastEvents, type CacheEntry } from './event-cache';

export { getSessionId } from './session-id';

export { addToGlobalContext } from './telemetry';

/** Is this story part of the CLI generated examples, including user-created stories in those files */
export const isExampleStoryId = (storyId: string) =>
  storyId.startsWith('example-button--') ||
  storyId.startsWith('example-header--') ||
  storyId.startsWith('example-page--');

export const telemetry = async (
  eventType: EventType,
  payload: Payload = {},
  options: Partial<Options> = {}
) => {
  // TODO: DO NOT MERGE WITH THIS! IT'S FOR DEBUGGING PURPOSES ONLY!
  console.log('telemetry ', { eventType, payload, options });
  return;
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
};
