/**
 * Server-side registration for the example background-color service.
 *
 * This runtime is the sole implementer of the `setColor` command: the shared definition declares it
 * without a handler, and the handler is supplied here at registration. When the manager toolbar calls
 * `setColor`, the manager (which has no local handler) requests remote execution and this server runs
 * it, mutates state, and broadcasts the new color back to every runtime.
 *
 * `registerService` joins the cross-peer sync protocol automatically as a relay hub when the dev
 * server has installed the channel (the `services` preset does this on a real websocket transport),
 * so updates from the manager or preview flow in with no extra wiring. Without a channel — static
 * builds — the subscription only fires for server-local state changes.
 */

import { registerService } from 'storybook/internal/common';
import { backgroundServiceDef } from './definition.ts';

export function registerBackgroundService() {
  const service = registerService(backgroundServiceDef, {
    commands: {
      setColor: {
        handler: async (input, ctx) => {
          ctx.self.setState((state) => {
            state.color = input.color;
          });
        },
      },
    },
  });

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
