import { logger } from '@storybook/core/node-logger';

import { notify } from './notify';
import { sanitizeError } from './sanitize';
import { getStorybookMetadata } from './storybook-metadata';
import { sendTelemetry } from './telemetry';
import type { EventType, Options, Payload, TelemetryData } from './types';

export { oneWayHash } from './one-way-hash';

export * from './storybook-metadata';

export * from './types';

export { getPrecedingUpgrade } from './event-cache';

export { addToGlobalContext } from './telemetry';

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
