import { cache } from 'storybook/internal/common';

import type { EventType, TelemetryEvent } from './types';

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

type QueueItem = {
  eventType: EventType;
  body: TelemetryEvent;
  resolve: () => void;
  reject: (error: Error) => void;
};

const queue: QueueItem[] = [];
let isProcessing = false;
let currentOperation: Promise<void> = Promise.resolve();

const setHelper = async (eventType: EventType, body: TelemetryEvent) => {
  const lastEvents = (await cache.get('lastEvents')) || {};
  lastEvents[eventType] = { body, timestamp: Date.now() };
  await cache.set('lastEvents', lastEvents);
};

const processQueue = async () => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) {
      continue;
    }

    try {
      await setHelper(item.eventType, item.body);
      item.resolve();
    } catch (error) {
      item.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  isProcessing = false;
};

export const set = async (eventType: EventType, body: any): Promise<void> => {
  // Wait for current operation to complete before queuing new one
  // Catch errors from previous operations so they don't prevent new operations
  try {
    await currentOperation;
  } catch {
    // Previous operation failed, but we can still queue new operations
  }

  // Create a new promise for this operation
  let resolveOperation: () => void;
  let rejectOperation: (error: Error) => void;
  const operationPromise = new Promise<void>((resolve, reject) => {
    resolveOperation = resolve;
    rejectOperation = reject;
  });

  // Add to queue
  queue.push({
    eventType,
    body,
    resolve: resolveOperation!,
    reject: rejectOperation!,
  });

  // Update current operation to track this one (so getLastEvents waits for it)
  currentOperation = operationPromise;

  // Start processing if not already processing
  processQueue();

  return operationPromise;
};

export const get = async (eventType: EventType): Promise<CacheEntry | undefined> => {
  const lastEvents = await getLastEvents();
  return lastEvents[eventType];
};

export const getLastEvents = async (): Promise<Record<EventType, CacheEntry>> => {
  // Wait for any pending set operations to complete before reading
  // This prevents race conditions where getLastEvents() reads stale data
  // while a set() operation is still in progress
  await currentOperation;
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

const lastEvent = (lastEvents: Record<EventType, any>, eventTypes: EventType[]) => {
  const descendingEvents = eventTypes
    .map((eventType) => lastEvents?.[eventType])
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp);
  return descendingEvents.length > 0 ? descendingEvents[0] : undefined;
};

export const getPrecedingUpgrade = async (events: any = undefined) => {
  const lastEvents = events || (await cache.get('lastEvents')) || {};
  const lastUpgradeEvent = lastEvent(lastEvents, UPGRADE_EVENTS);
  const lastRunEvent = lastEvent(lastEvents, RUN_EVENTS);

  if (!lastUpgradeEvent) {
    return undefined;
  }

  return !lastRunEvent?.timestamp || lastUpgradeEvent.timestamp > lastRunEvent.timestamp
    ? upgradeFields(lastUpgradeEvent)
    : undefined;
};
