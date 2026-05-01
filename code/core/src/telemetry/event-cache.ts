import { cache } from 'storybook/internal/common';

import type { EventType, TelemetryEvent } from './types.ts';

interface UpgradeSummary {
  timestamp: number;
  eventType?: EventType;
  eventId?: string;
  sessionId?: string;
}

export interface CacheEntry {
  timestamp: number;
  body: TelemetryEvent;
}

let processingPromise: Promise<void> = Promise.resolve();

const setHelper = async (eventType: EventType, body: TelemetryEvent) => {
  const lastEvents = (await cache.get('lastEvents')) || {};
  lastEvents[eventType] = { body, timestamp: Date.now() };
  await cache.set('lastEvents', lastEvents);
};

export const set = (eventType: EventType, body: TelemetryEvent): Promise<void> => {
  const run = processingPromise.then(async () => {
    await setHelper(eventType, body);
  });

  // Keep the chain alive even if this operation rejects, so later callers still queue
  processingPromise = run.catch(() => {});

  return run;
};

export const get = async (eventType: EventType): Promise<CacheEntry | undefined> => {
  const lastEvents = await getLastEvents();
  return lastEvents[eventType];
};

export const getLastEvents = async (): Promise<Record<EventType, CacheEntry>> => {
  // Wait for any pending set operations to complete before reading
  await processingPromise;
  return (await cache.get('lastEvents')) || {};
};

const upgradeFields = (event: CacheEntry): UpgradeSummary => {
  const { body, timestamp } = event;
  return {
    timestamp,
    eventType: body?.eventType,
    eventId: body?.eventId,
    sessionId: body?.sessionId,
  };
};

const UPGRADE_EVENTS: EventType[] = ['init', 'upgrade'];
const RUN_EVENTS: EventType[] = ['build', 'dev', 'error'];

const lastEvent = (lastEvents: Partial<Record<EventType, CacheEntry>>, eventTypes: EventType[]) => {
  const descendingEvents = eventTypes
    .map((eventType) => lastEvents?.[eventType])
    .filter((event): event is CacheEntry => Boolean(event))
    .sort((a, b) => b.timestamp - a.timestamp);
  return descendingEvents.length > 0 ? descendingEvents[0] : undefined;
};

export const getPrecedingUpgrade = async (
  events: Partial<Record<EventType, CacheEntry>> | undefined = undefined
) => {
  const lastEvents =
    events || ((await cache.get('lastEvents')) as Partial<Record<EventType, CacheEntry>>) || {};
  const lastUpgradeEvent = lastEvent(lastEvents, UPGRADE_EVENTS);
  const lastRunEvent = lastEvent(lastEvents, RUN_EVENTS);

  if (!lastUpgradeEvent) {
    return undefined;
  }

  return !lastRunEvent?.timestamp || lastUpgradeEvent.timestamp > lastRunEvent.timestamp
    ? upgradeFields(lastUpgradeEvent)
    : undefined;
};
/**
 * Record cached at ai-setup time.
 * Read by subsequent CLI entry points for evidence collection.
 * Canonical definition — imported by event-cache.ts and prepare-requirements.ts.
 */
export interface AiSetupPendingRecord {
  timestamp: number;
  sessionId: string;
  configDir: string;
  previewPath: string | null;
  previewHash: string | null;
}

export const getAiSetupPending = async (): Promise<AiSetupPendingRecord | undefined> => {
  // Wait for any pending set operations to complete before reading
  await processingPromise;
  return (await cache.get('ai-setup-pending')) ?? undefined;
};

export const flushAiSetupPending = async (): Promise<undefined> => {
  // Wait for any pending set operations to complete before removing
  await processingPromise;
  await cache.remove('ai-setup-pending');
  return undefined;
};

/**
 * Returns true when the current session falls within the 2-hour window opened by the most recent
 * occurrence of one of the given event types
 *
 * Used to gate telemetry that should only be captured during a single session window of a given event (e.g. init)
 */
export async function isWithinInitialSession(events: EventType | EventType[]): Promise<boolean> {
  try {
    const eventTypes = Array.isArray(events) ? events : [events];
    const lastEvents = await getLastEvents();

    const lastRelevantEvent = lastEvent(lastEvents, eventTypes);

    if (!lastRelevantEvent) {
      return false;
    }

    const { getSessionId } = await import('./session-id.ts');
    const sessionId = await getSessionId();

    // If the stored event carries a sessionId that differs from the current one the 2h window
    // has expired and a new session was started.
    if (lastRelevantEvent.body?.sessionId && lastRelevantEvent.body.sessionId !== sessionId) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
