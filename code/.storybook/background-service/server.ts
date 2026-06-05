/**
 * Server-side registration for the example background-color service.
 *
 * Registers the service and subscribes to log every color change to the terminal,
 * including the previous and next value.
 *
 * `registerService` joins the cross-peer sync protocol automatically as a relay hub when the dev
 * server has installed the channel (the `services` preset does this on a real websocket transport),
 * so updates from the manager or preview flow in with no extra wiring. Without a channel — static
 * builds — the subscription only fires for server-local state changes.
 */

import { registerService } from 'storybook/internal/common';
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
