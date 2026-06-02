/**
 * Server-side registration for the example background-color service.
 *
 * Registers the service and subscribes to log every color change to the terminal,
 * including the previous and next value.
 *
 * Cross-peer sync needs no wiring here: the dev server's `services` preset installs the channel
 * (via `setServiceChannel`) before services register, so `registerService` joins the sync protocol
 * automatically — exactly as the manager and preview do. The subscription below then fires for
 * updates authored anywhere (manager, preview, or this server). In a static build no channel is
 * installed, so the runtime stays local-only and the subscription only sees server-local changes.
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
