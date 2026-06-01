/**
 * Server-side registration for the example background-color service.
 *
 * Registers the service and subscribes to log every color change to the terminal,
 * including the previous and next value.
 *
 * To receive updates from the manager or preview, wire up the channel bridge after
 * calling this function:
 *
 * ```ts
 * import { connectServiceToChannel, setServiceChannel } from '...open-service/server';
 *
 * const disconnect = connectServiceToChannel(backgroundServiceDef.id, serverChannel);
 * ```
 *
 * Without the channel bridge the subscription only fires for server-local state changes.
 */

import { registerService } from '../../core/src/shared/open-service/server.ts';
import { backgroundServiceDef } from './definition.ts';

export function registerBackgroundService() {
  const service = registerService(backgroundServiceDef);

  let prevColor: string | undefined;

  service.queries.getColor.subscribe(undefined, (color) => {
    if (prevColor === undefined) {
      console.log(`[background-service] initial color: ${color}`);
    } else if (color !== prevColor) {
      console.log(`[background-service] color changed: ${prevColor} → ${color}`);
    }
    prevColor = color;
  });

  return service;
}
