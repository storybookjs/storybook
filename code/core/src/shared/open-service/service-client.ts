/**
 * Client-side service registration for the open-service multi-master architecture.
 *
 * `registerServiceClient` creates a local `ServiceRuntime` (identical in shape to the
 * server-side one) and wires it into the cross-peer channel sync protocol:
 *
 * - On registration it emits `services:welcome-request` so any existing peer can reply with
 *   the current state snapshot.
 * - It responds to other peers' welcome-requests with its own snapshot.
 * - After each local command execution it broadcasts the full post-mutation state as
 *   `services:patches` so all peers stay in sync.
 * - Incoming `services:patches` from other peers are applied via `commandSelf.setState` —
 *   which triggers fine-grained signal updates and re-renders subscribed components —
 *   without going through the wrapped commands, so no loop broadcast is triggered.
 *
 * Loop prevention: every channel event carries the emitter's `clientId`. Events whose
 * `clientId` matches the local instance's id are silently ignored.
 *
 * Relay role: a runtime registered as a hub (`{ relay: true }`) re-emits every peer snapshot it
 * adopts so peers reachable on its *other* channel transports converge too. Storybook's channel is
 * point-to-point per transport and does not forward a received event between transports on its own,
 * so without an explicit relay a manager could never bridge the server and a preview iframe (nor one
 * dev server bridge two manager tabs). Previews are leaves (`relay` defaults to `false`): they have a
 * single transport, so they have nothing to forward. The `(version, clientId)` gate makes relaying
 * safe — a re-emitted snapshot that bounces back is recognized as not-newer and dropped.
 */

import {
  OpenServiceDuplicateRegistrationError,
  OpenServiceMissingServiceError,
} from '../../server-errors.ts';
import { generateClientId, getServiceChannel } from './service-channel.ts';
import { createServiceRuntime, type ServiceRuntime } from './service-runtime.ts';
import { createSnapshotReconciler } from './service-sync.ts';
import { connectRuntimeToChannel, wrapCommandsForBroadcast } from './service-transport.ts';
import type {
  AnyServiceDefinition,
  Commands,
  Queries,
  RuntimeService,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceId,
  ServiceInstance,
  ServiceRegistrationOptions,
  ServiceRegistryApi,
  ServiceSummary,
} from './types.ts';

type AnyServiceRuntime = ServiceRuntime<unknown, Queries<unknown>, Commands<unknown>>;

// ---- Client-side registry ----

type ClientRegistryEntry = {
  definition: AnyServiceDefinition;
  instance: RuntimeService;
  serviceRuntime: AnyServiceRuntime;
  disconnect: () => void;
};

const CLIENT_REGISTRY_SYMBOL = Symbol.for('storybook.open-service.client-registry');

function getClientRegistry(): Map<string, ClientRegistryEntry> {
  const g = globalThis as { [k: symbol]: Map<string, ClientRegistryEntry> | undefined };
  g[CLIENT_REGISTRY_SYMBOL] ??= new Map();
  return g[CLIENT_REGISTRY_SYMBOL];
}

/**
 * `ServiceRegistryApi` backed by the client-side registry.
 *
 * Cross-service `ctx.getService(id)` calls inside query/command handlers on a client runtime
 * resolve through this API so the handler sees other client-registered services, not the
 * server-side registry.
 */
export const clientRegistryApi: ServiceRegistryApi = {
  async listServices(): Promise<ServiceSummary[]> {
    return Array.from(getClientRegistry().values()).map(({ definition }) => ({
      id: definition.id,
      description: definition.description,
      queryNames: Object.keys(definition.queries),
      commandNames: Object.keys(definition.commands),
    }));
  },

  async describeService(serviceId: ServiceId): Promise<ServiceDescriptor> {
    const entry = getClientRegistry().get(serviceId);

    if (!entry) {
      throw new OpenServiceMissingServiceError({ serviceId });
    }

    return {
      id: entry.definition.id,
      description: entry.definition.description,
      queries: Object.fromEntries(
        Object.entries(entry.definition.queries).map(([name, q]) => [
          name,
          { name, description: q.description, input: q.input, output: q.output },
        ])
      ),
      commands: Object.fromEntries(
        Object.entries(entry.definition.commands).map(([name, c]) => [
          name,
          { name, description: c.description, input: c.input, output: c.output },
        ])
      ),
    };
  },

  getService(serviceId: ServiceId): RuntimeService {
    const entry = getClientRegistry().get(serviceId);

    if (!entry) {
      throw new OpenServiceMissingServiceError({ serviceId });
    }

    return entry.instance;
  },
} satisfies ServiceRegistryApi;

// ---- Utilities ----

/** Applies registration-time overrides to a service definition. */
function applyRegistration<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
): ServiceDefinition<TState, TQueries, TCommands> {
  if (!registration) {
    return definition;
  }

  return {
    ...definition,
    queries: Object.fromEntries(
      Object.entries(definition.queries).map(([name, query]) => {
        const override = registration.queries?.[name as keyof TQueries];
        return [name, override ? { ...query, ...override } : query];
      })
    ) as TQueries,
    commands: Object.fromEntries(
      Object.entries(definition.commands).map(([name, command]) => {
        const override = registration.commands?.[name as keyof TCommands];
        return [name, override ? { ...command, ...override } : command];
      })
    ) as TCommands,
  };
}

// ---- Registration ----

/** Channel-sync options that depend on the entrypoint rather than the service definition. */
export interface ServiceClientSyncOptions {
  /**
   * Whether this runtime acts as a relay hub. A hub re-broadcasts every peer snapshot it adopts so
   * peers on its other channel transports stay in sync (the manager bridges the server and preview
   * iframes; a dev server bridges multiple manager tabs). Leaves — previews — keep the default
   * `false`: with a single transport there is nothing to forward.
   */
  relay?: boolean;
}

/**
 * Registers a service on the client (manager or preview) and returns its runtime surface.
 *
 * Creates a local `ServiceRuntime` with the full definition so queries and commands work
 * identically to the server side. If a channel is installed via `setServiceChannel`, the
 * service also participates in the cross-peer multi-master sync protocol.
 *
 * @param sync - Channel-sync options. Pass `{ relay: true }` from a hub entrypoint (the manager) so
 *   adopted peer snapshots are forwarded to its other transports; previews omit it (leaf default).
 * @throws {OpenServiceDuplicateRegistrationError} if a service with the same id is already
 *   registered in the client registry.
 */
export function registerServiceClient<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>,
  sync?: ServiceClientSyncOptions
): ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi {
  const registry = getClientRegistry();

  if (registry.has(definition.id)) {
    throw new OpenServiceDuplicateRegistrationError({ serviceId: definition.id });
  }

  const ownClientId = generateClientId();
  const resolvedDefinition = applyRegistration(definition, registration);

  const serviceRuntime = createServiceRuntime(
    resolvedDefinition,
    { registryApi: clientRegistryApi },
    structuredClone(resolvedDefinition.initialState)
  );

  // Owns the per-service last-write-wins stamp (held in the sync envelope, never inside user state)
  // and the shared adopt/advance logic. Adopting a peer snapshot goes through `commandSelf.setState`
  // here, not the wrapped commands below, which is how the broadcast loop is prevented.
  const reconciler = createSnapshotReconciler({
    stateSchema: serviceRuntime.stateSchema,
    setState: (mutate) =>
      serviceRuntime.commandSelf.setState((state) => mutate(state as Record<string, unknown>)),
    initialStamp: { version: 0, clientId: ownClientId },
  });

  const getSnapshot = (): Record<string, unknown> =>
    serviceRuntime.getStateSnapshot() as Record<string, unknown>;

  // Wrap each command so a successful local call broadcasts the post-mutation snapshot. Incoming
  // peer state is applied through the reconciler's `setState` (passed below), not these wrappers, so
  // an adopted snapshot never loops back out as a broadcast.
  const wrappedCommands = wrapCommandsForBroadcast(
    serviceRuntime.commands as Record<string, (input: unknown) => Promise<unknown>>,
    {
      serviceId: definition.id,
      ownClientId,
      reconciler,
      getSnapshot,
      getChannel: getServiceChannel,
    }
  ) as ServiceInstance<TState, TQueries, TCommands>['commands'];

  const instance = {
    queries: serviceRuntime.queries,
    commands: wrappedCommands,
    ...clientRegistryApi,
  } as unknown as ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi;

  // The manager registers as a relay hub (`{ relay: true }`) so it bridges the server and preview
  // iframes; previews are leaves and keep the default `false`. Without a channel installed the
  // runtime stays local-only and there is nothing to tear down.
  const channel = getServiceChannel();
  const disconnect = channel
    ? connectRuntimeToChannel({
        serviceId: definition.id,
        channel,
        ownClientId,
        reconciler,
        getSnapshot,
        relay: sync?.relay ?? false,
      })
    : (): void => {};

  registry.set(definition.id, {
    definition: resolvedDefinition as AnyServiceDefinition,
    instance: instance as unknown as RuntimeService,
    serviceRuntime: serviceRuntime as AnyServiceRuntime,
    disconnect,
  });

  return instance;
}

/**
 * Removes a client-registered service and tears down its channel listeners.
 *
 * After calling this, the service id can be re-registered. Useful for hot-reloading
 * scenarios where a service definition changes and must be re-applied.
 */
export function unregisterServiceClient(serviceId: ServiceId): void {
  const entry = getClientRegistry().get(serviceId);

  if (entry) {
    entry.disconnect();
    getClientRegistry().delete(serviceId);
  }
}

/**
 * Clears all client-registered services and tears down their channel listeners.
 *
 * Tests should call this in `afterEach` alongside `clearServiceChannel()` to ensure
 * registrations do not leak between test cases.
 */
export function clearClientRegistry(): void {
  for (const entry of getClientRegistry().values()) {
    entry.disconnect();
  }

  getClientRegistry().clear();
}
