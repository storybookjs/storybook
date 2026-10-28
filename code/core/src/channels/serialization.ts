import { isJSON, parse, stringify } from 'telejson';

/** Decode a socket frame into a channel event; non-JSON payloads pass through unchanged. */
export function parseChannelMessage(data: unknown): any {
  return typeof data === 'string' && isJSON(data) ? parse(data, {}) : data;
}

/** Encode a channel event into a socket frame. */
export function stringifyChannelMessage(event: unknown): string {
  return stringify(event, { maxDepth: 15 });
}
