/// <reference path="../typings.d.ts" />
import { global } from '@storybook/global';

import { isJSON, parse } from 'telejson';

/**
 * Deserialize a raw channel message using telejson. Returns the parsed object when the message is
 * a JSON string, otherwise returns it as-is. Uses `global.CHANNEL_OPTIONS` for parse options so
 * all transports apply the same settings.
 */
export function parseEvent(data: unknown): any {
  return typeof data === 'string' && isJSON(data)
    ? parse(data, global.CHANNEL_OPTIONS || {})
    : data;
}
