import { logger } from 'storybook/internal/node-logger';

import { notify } from './notify.ts';
import { sanitizeError } from './sanitize.ts';
import { getStorybookMetadata } from './storybook-metadata.ts';
import { sendTelemetry } from './telemetry.ts';
import type { EventType, Options, Payload, TelemetryData } from './types.ts';

export { oneWayHash } from './one-way-hash.ts';

export * from './storybook-metadata.ts';

export * from './types.ts';

export * from './sanitize.ts';

export * from './error-collector.ts';

export * from './ai-setup-utils.ts';

export {
  getPrecedingUpgrade,
  getLastEvents,
  type CacheEntry,
  getAiSetupPending,
  type AiSetupPendingRecord,
} from './event-cache.ts';

export { getSessionId, SESSION_TIMEOUT } from './session-id.ts';

export { addToGlobalContext } from './telemetry.ts';

export { detectAgent, type AgentInfo } from './detect-agent.ts';

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
};
