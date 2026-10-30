import { INSTANCE_QUERY_PARAM } from './constants.ts';

/**
 * Read the story-instance id from an iframe search string.
 */
export function instanceIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const instanceId = params.get(INSTANCE_QUERY_PARAM);
  return instanceId || null;
}

/**
 * True when an event is addressed to this iframe and not to another instance.
 */
export function isEventForInstance(instanceId: string, event: { instanceId?: string }): boolean {
  return event.instanceId === instanceId;
}

/**
 * Query string for a story iframe that participates as one instance.
 */
export function storyFrameQuery(storyId: string, instanceId: string): string {
  return new URLSearchParams({
    id: storyId,
    viewMode: 'story',
    [INSTANCE_QUERY_PARAM]: instanceId,
  }).toString();
}
