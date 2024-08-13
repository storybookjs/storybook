import { logger } from '@storybook/core/node-logger';
import type { EventType, Payload, Options, TelemetryData } from './types';
import { getStorybookMetadata } from './storybook-metadata';
import { sendTelemetry } from './telemetry';
import { notify } from './notify';
import { sanitizeError } from './sanitize';

export { oneWayHash } from './one-way-hash';

export * from './storybook-metadata';

export * from './types';

export { getPrecedingUpgrade } from './event-cache';

export { addToGlobalContext } from './telemetry';

/**
 * Is this story part of the CLI generated examples,
 * including user-created stories in those files
 */
export const isExampleStoryId = (storyId: string) =>
  storyId.startsWith('example-button--') ||
  storyId.startsWith('example-header--') ||
  storyId.startsWith('example-page--');

export const telemetry = async (
  eventType: EventType,
  payload: Payload = {},
  options: Partial<Options> = {}
) => {
  // Don't notify on boot since it can lead to double notification in `sb init`.
  // The notification will happen when the actual command runs.
  if (eventType !== 'boot') {
    await notify();
  }
  const telemetryData: TelemetryData = {
    eventType,
    payload,
  };
  try {
    if (!options?.stripMetadata)
      telemetryData.metadata = await getStorybookMetadata(options?.configDir);
  } catch (error: any) {
    telemetryData.payload.metadataErrorMessage = sanitizeError(error).message;
    if (options?.enableCrashReports) telemetryData.payload.metadataError = sanitizeError(error);
  } finally {
    const { error } = telemetryData.payload;
    // make sure to anonymise possible paths from error messages
    if (error) telemetryData.payload.error = sanitizeError(error);

    if (!telemetryData.payload.error || options?.enableCrashReports) {
      if (process.env?.STORYBOOK_TELEMETRY_DEBUG) {
        logger.info('\n[telemetry]');
        logger.info(JSON.stringify(telemetryData, null, 2));
      }
      await sendTelemetry(telemetryData, options);
    }
  }
};
