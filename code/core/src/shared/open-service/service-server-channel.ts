/**
 * Channel integration for server-side registered services.
 *
 * After registering a service with `registerService(def)`, call
 * `connectServiceToChannel(serviceId)` to make the server participate in the open-service
 * multi-master sync protocol:
 *
 * - Responds to `services:welcome-request` from newly-connected clients with the current
 *   server-side state snapshot so clients can bootstrap.
 * - Applies `services:patches` from other peers so the server's local state stays current
 *   when clients run commands.
 *
 * The returned function tears down the channel listeners when called, which is useful for
 * test cleanup or hot-reload scenarios.
 */

import { getServiceRuntime } from './service-registration.ts';
import {
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
  generateClientId,
  getServiceChannel,
  type PatchesPayload,
  type ServiceChannel,
  type WelcomeReplyPayload,
  type WelcomeRequestPayload,
} from './service-channel.ts';
import type { ServiceId } from './types.ts';

/**
 * Deep-assigns all keys from `source` onto `target` in place.
 *
 * Mirrors the same utility in `service-client.ts` — kept separate so each module stays
 * independently importable without coupling through a shared internal.
 */
function deepAssign(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];

    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      deepAssign(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      target[key] = sv;
    }
  }
}

/**
 * Connects a server-side registered service to the channel sync protocol.
 *
 * @param serviceId - The id of a service already registered via `registerService`.
 * @param channel - Optional explicit channel. Falls back to the module-level channel
 *   installed via `setServiceChannel`. If neither is available, returns a no-op.
 * @returns A teardown function that removes all channel listeners.
 *
 * @example
 * ```ts
 * const disconnect = connectServiceToChannel(myServiceDef.id);
 * // Later, on server shutdown or hot-reload:
 * disconnect();
 * ```
 */
export function connectServiceToChannel(
  serviceId: ServiceId,
  channel?: ServiceChannel
): () => void {
  const ch = channel ?? getServiceChannel();

  if (!ch) {
    return () => {};
  }

  const runtime = getServiceRuntime(serviceId);
  const ownClientId = generateClientId();

  const onWelcomeRequest = (payload: unknown): void => {
    const p = payload as WelcomeRequestPayload;
    if (p.serviceId !== serviceId || p.clientId === ownClientId) return;

    ch.emit(SERVICE_WELCOME_REPLY, {
      serviceId,
      state: runtime.getStateSnapshot() as Record<string, unknown>,
      clientId: ownClientId,
    } satisfies WelcomeReplyPayload);
  };

  const onPatches = (payload: unknown): void => {
    const p = payload as PatchesPayload;
    if (p.serviceId !== serviceId || p.clientId === ownClientId) return;

    runtime.commandSelf.setState((state) => {
      deepAssign(state as Record<string, unknown>, p.state);
    });
  };

  ch.on(SERVICE_WELCOME_REQUEST, onWelcomeRequest);
  ch.on(SERVICE_PATCHES, onPatches);

  return (): void => {
    ch.off(SERVICE_WELCOME_REQUEST, onWelcomeRequest);
    ch.off(SERVICE_PATCHES, onPatches);
  };
}
