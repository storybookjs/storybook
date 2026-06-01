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
 */

import {
  OpenServiceDuplicateRegistrationError,
  OpenServiceMissingServiceError,
} from '../../server-errors.ts';
import {
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
  generateClientId,
  getServiceChannel,
  type PatchesPayload,
  type WelcomeReplyPayload,
  type WelcomeRequestPayload,
} from './service-channel.ts';
import { createServiceRuntime, type ServiceRuntime } from './service-runtime.ts';
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

/**
 * Deep-assigns all keys from `source` onto `target` in place.
 *
 * Plain-object values are recursed so that fine-grained signal subscriptions on nested
 * fields are not unnecessarily invalidated. Arrays are replaced wholesale. Primitives are
 * assigned directly. Keys present in `target` but absent from `source` are left untouched.
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

/**
 * Registers a service on the client (manager or preview) and returns its runtime surface.
 *
 * Creates a local `ServiceRuntime` with the full definition so queries and commands work
 * identically to the server side. If a channel is installed via `setServiceChannel`, the
 * service also participates in the cross-peer multi-master sync protocol.
 *
 * @throws {OpenServiceDuplicateRegistrationError} if a service with the same id is already
 *   registered in the client registry.
 */
export function registerServiceClient<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
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

  // Wrap each command to broadcast the full post-mutation state snapshot after execution.
  // Only local command calls go through this wrapper — state applied via `commandSelf.setState`
  // (for incoming patches) does not, which is how the loop is naturally prevented.
  const wrappedCommands = Object.fromEntries(
    Object.entries(
      serviceRuntime.commands as Record<string, (input: unknown) => Promise<unknown>>
    ).map(([name, cmd]) => [
      name,
      async (input: unknown) => {
        const result = await cmd(input);
        const channel = getServiceChannel();

        if (channel) {
          channel.emit(SERVICE_PATCHES, {
            serviceId: definition.id,
            state: serviceRuntime.getStateSnapshot() as Record<string, unknown>,
            clientId: ownClientId,
          } satisfies PatchesPayload);
        }

        return result;
      },
    ])
  ) as ServiceInstance<TState, TQueries, TCommands>['commands'];

  const instance = {
    queries: serviceRuntime.queries,
    commands: wrappedCommands,
    ...clientRegistryApi,
  } as unknown as ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi;

  // Applies a received state snapshot into the local runtime without triggering a
  // re-broadcast. The call goes through `commandSelf.setState` which batches signal updates
  // so only the fields that actually changed re-fire subscriptions.
  const applyReceivedState = (receivedState: Record<string, unknown>): void => {
    serviceRuntime.commandSelf.setState((state) => {
      deepAssign(state as Record<string, unknown>, receivedState);
    });
  };

  let disconnect = (): void => {};

  const channel = getServiceChannel();

  if (channel) {
    // Reply to welcome-requests from other clients so they can bootstrap their state.
    const onWelcomeRequest = (payload: unknown): void => {
      const p = payload as WelcomeRequestPayload;
      if (p.serviceId !== definition.id || p.clientId === ownClientId) return;

      channel.emit(SERVICE_WELCOME_REPLY, {
        serviceId: definition.id,
        state: serviceRuntime.getStateSnapshot() as Record<string, unknown>,
        clientId: ownClientId,
      } satisfies WelcomeReplyPayload);
    };

    // Apply the first welcome-reply we receive so we bootstrap from an existing peer.
    const onWelcomeReply = (payload: unknown): void => {
      const p = payload as WelcomeReplyPayload;
      if (p.serviceId !== definition.id || p.clientId === ownClientId) return;
      applyReceivedState(p.state);
    };

    // Apply state patches from other peers.
    const onPatches = (payload: unknown): void => {
      const p = payload as PatchesPayload;
      if (p.serviceId !== definition.id || p.clientId === ownClientId) return;
      applyReceivedState(p.state);
    };

    channel.on(SERVICE_WELCOME_REQUEST, onWelcomeRequest);
    channel.on(SERVICE_WELCOME_REPLY, onWelcomeReply);
    channel.on(SERVICE_PATCHES, onPatches);

    disconnect = (): void => {
      channel.off(SERVICE_WELCOME_REQUEST, onWelcomeRequest);
      channel.off(SERVICE_WELCOME_REPLY, onWelcomeReply);
      channel.off(SERVICE_PATCHES, onPatches);
    };

    // Ask any existing peer for the current state.
    channel.emit(SERVICE_WELCOME_REQUEST, {
      serviceId: definition.id,
      clientId: ownClientId,
    } satisfies WelcomeRequestPayload);
  }

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
