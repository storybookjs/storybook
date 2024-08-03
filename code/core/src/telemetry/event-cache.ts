import { cache } from '@storybook/core/common';
import type { EventType } from './types';

interface UpgradeSummary {
  timestamp: number;
  eventType?: EventType;
  eventId?: string;
  sessionId?: string;
}

let operation: Promise<any> = Promise.resolve();

const setHelper = async (eventType: EventType, body: any) => {
  const lastEvents = (await cache.get('lastEvents')) || {};
  lastEvents[eventType] = { body, timestamp: Date.now() };
  await cache.set('lastEvents', lastEvents);
};

export const set = async (eventType: EventType, body: any) => {
  await operation;
  operation = setHelper(eventType, body);
  return operation;
};

export const get = async (eventType: EventType) => {
  const lastEvents = await cache.get('lastEvents');
  return lastEvents?.[eventType];
};

const upgradeFields = (event: any): UpgradeSummary => {
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

  if (!lastUpgradeEvent) return undefined;

  return !lastRunEvent?.timestamp || lastUpgradeEvent.timestamp > lastRunEvent.timestamp
    ? upgradeFields(lastUpgradeEvent)
    : undefined;
};
