/**
 * Unified service registry for the open-service multi-master architecture.
 *
 * One implementation backs every runtime — the dev server (Node), the manager (top window), and each
 * preview iframe. Registration builds a local `ServiceRuntime` and, when a channel is present, wires it
 * into the cross-peer sync protocol through the shared transport. The only thing that differs per
 * runtime is the `relay` role: the dev server and the manager are hubs (`relay: true`) that bridge
 * their other channel transports, while a preview is a leaf (`relay: false`) — a single transport has
 * nothing to forward. The handshake + patch-broadcast protocol lives in `service-transport.ts` and the
 * last-write-wins reconciliation in `service-sync.ts`; both transports drive them identically.
 *
 * The registry is anchored on a symbol-keyed `globalThis` slot so every module in one realm shares a
 * single registration map even if this file is reached through different import paths. Server (Node),
 * manager (top window), and preview (iframe) are already isolated realms, so one symbol is correct for
 * all three — they never share a map at runtime.
 */

import {
  OpenServiceDuplicateRegistrationError,
  OpenServiceMissingChannelError,
  OpenServiceMissingServiceError,
} from '../../server-errors.ts';
import { generateClientId, getServiceChannel } from './service-channel.ts';
import { createServiceRuntime } from './service-runtime.ts';
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
  ServiceInstanceOf,
  ServiceRegistrationOptions,
  ServiceRegistryApi,
  ServiceSummary,
} from './types.ts';

type RegistryEntry = {
  definition: AnyServiceDefinition;
  /** The public, channel-wrapped runtime surface returned from `registerService` and `getService`. */
  instance: RuntimeService;
  descriptor: ServiceDescriptor;
  summary: ServiceSummary;
  /** Tears down this service's channel listeners. A no-op when no channel was installed. */
  disconnect: () => void;
};

const REGISTRY_SYMBOL = Symbol.for('storybook.open-service.registry');

/**
 * Returns the realm-global registry backing service registration.
 *
 * Lazily created so importing the module does not eagerly mutate global state. Anchoring it on a
 * `globalThis` symbol keeps runtime lookups, static builds, and tests pointed at one service inventory
 * even when the module is reached through different import paths.
 */
function getRegistry(): Map<string, RegistryEntry> {
  const registryGlobal = globalThis as {
    [key: symbol]: Map<string, RegistryEntry> | undefined;
  };

  registryGlobal[REGISTRY_SYMBOL] ??= new Map<string, RegistryEntry>();

  return registryGlobal[REGISTRY_SYMBOL];
}

/**
 * Converts one service definition into the serializable descriptor returned by registry metadata APIs.
 *
 * Descriptors expose schemas and descriptions but not runtime handlers, so callers can inspect a
 * service's contract without gaining access to executable behavior. `staticPath: true` is surfaced so
 * manager code can choose between live runtime queries and prebuilt JSON snapshots.
 */
function describeDefinition(definition: AnyServiceDefinition): ServiceDescriptor {
  return {
    id: definition.id,
    description: definition.description,
    queries: Object.fromEntries(
      Object.entries(definition.queries).map(([name, query]) => [
        name,
        {
          name,
          description: query.description,
          input: query.input,
          output: query.output,
          ...(query.staticPath ? { staticPath: true as const } : {}),
        },
      ])
    ),
    commands: Object.fromEntries(
      Object.entries(definition.commands).map(([name, command]) => [
        name,
        {
          name,
          description: command.description,
          input: command.input,
          output: command.output,
        },
      ])
    ),
  };
}

/** Derives the lightweight summary returned by `listServices()` from a full descriptor. */
function summarizeDescriptor(descriptor: ServiceDescriptor): ServiceSummary {
  return {
    id: descriptor.id,
    description: descriptor.description,
    queryNames: Object.keys(descriptor.queries),
    commandNames: Object.keys(descriptor.commands),
  };
}

/**
 * Applies optional registration overrides to an authored definition.
 *
 * Query registration may supply dependency-aware `staticInputs` (used by server static builds);
 * command registration may override the `handler`. Anything not overridden is forwarded unchanged so
 * every runtime shares the same contract.
 */
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

/**
 * Shared registry API injected into registered runtimes and static-build runtimes.
 *
 * Exporting the object keeps all call sites on one lookup implementation instead of each environment
 * assembling a structurally identical wrapper.
 */
export const serviceRegistryApi: ServiceRegistryApi = {
  listServices,
  describeService,
  getService,
};

/** Channel-sync options that depend on the entrypoint rather than the service definition. */
export interface ServiceRegisterOptions {
  /**
   * Whether this runtime acts as a relay hub. Hubs (the dev server, the manager) re-broadcast every
   * peer snapshot they adopt so peers on their *other* channel transports converge; leaves (a preview
   * iframe) keep the default `false` — with a single transport there is nothing to forward.
   */
  relay?: boolean;
}

/**
 * Registers one service definition in the realm-global registry and returns its runtime surface.
 *
 * Registration resolves any registration-time overrides, builds the runtime that query and command
 * callers use, wraps commands to broadcast their post-mutation state, and — when a channel is already
 * installed — joins the cross-peer sync protocol immediately as a hub or leaf (`relay`). There is no
 * separate connect step. Without a channel (static builds, isolated unit tests) the runtime stays
 * local-only. Duplicate ids are rejected up front so lookups remain deterministic.
 */
export function registerService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>,
  { relay = false }: ServiceRegisterOptions = {}
): ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi {
  const registry = getRegistry();

  if (registry.has(definition.id)) {
    throw new OpenServiceDuplicateRegistrationError({ serviceId: definition.id });
  }

  const ownClientId = generateClientId();
  const resolvedDefinition = applyRegistration(definition, registration);

  // The runtime mutates its state object in place, so give it a copy rather than the definition's
  // shared `initialState` (which would otherwise leak state across registrations).
  const runtime = createServiceRuntime(
    resolvedDefinition,
    { registryApi: serviceRegistryApi },
    structuredClone(resolvedDefinition.initialState)
  );

  // Owns the per-service last-write-wins stamp and the adopt/advance logic. Adopting a peer snapshot
  // goes through `commandSelf.setState` — not the wrapped commands below — which is how the broadcast
  // loop is prevented.
  const reconciler = createSnapshotReconciler({
    stateSchema: runtime.stateSchema,
    setState: (mutate) =>
      runtime.commandSelf.setState((state) => mutate(state as Record<string, unknown>)),
    initialStamp: { version: 0, clientId: ownClientId },
  });

  const getSnapshot = (): Record<string, unknown> =>
    runtime.getStateSnapshot() as Record<string, unknown>;

  // Wrap commands so a local mutation broadcasts its post-mutation snapshot to peers. The wrapper
  // re-reads the channel at call time, so without a channel it is a no-op and static builds are
  // unaffected. State adopted from peers flows through the reconciler's `setState`, never these
  // wrappers, so an adopted snapshot never loops back out as a broadcast.
  const instance = {
    queries: runtime.queries,
    commands: wrapCommandsForBroadcast(
      runtime.commands as Record<string, (input: unknown) => Promise<unknown>>,
      {
        serviceId: definition.id,
        ownClientId,
        reconciler,
        getSnapshot,
        getChannel: getServiceChannel,
      }
    ) as ServiceInstance<TState, TQueries, TCommands>['commands'],
    ...serviceRegistryApi,
  } as ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi;

  const descriptor = describeDefinition(resolvedDefinition as AnyServiceDefinition);

  const channel = getServiceChannel();

  if (!channel) {
    throw new OpenServiceMissingChannelError({ serviceId: definition.id });
  }

  const disconnect = connectRuntimeToChannel({
    serviceId: definition.id,
    channel,
    ownClientId,
    reconciler,
    getSnapshot,
    relay,
  });

  // Persist the instance together with precomputed metadata so later lookups stay cheap and do not
  // rebuild descriptors from the authored definition each time.
  registry.set(definition.id, {
    definition: resolvedDefinition as AnyServiceDefinition,
    instance: instance as unknown as RuntimeService,
    descriptor,
    summary: summarizeDescriptor(descriptor),
    disconnect,
  });

  return instance;
}

/**
 * Returns the authored definitions currently registered in this realm.
 *
 * The server static build uses this to discover which services contribute snapshots.
 */
export function getRegisteredServices(): AnyServiceDefinition[] {
  return Array.from(getRegistry().values(), ({ definition }) => definition);
}

/** Returns one summary entry per registered service — the lowest-cost discovery endpoint. */
export async function listServices(): Promise<ServiceSummary[]> {
  return Array.from(getRegistry().values(), ({ summary }) => summary);
}

/** Returns the schema-backed descriptor for one registered service. */
export async function describeService(serviceId: ServiceId): Promise<ServiceDescriptor> {
  const entry = getRegistry().get(serviceId);

  if (!entry) {
    throw new OpenServiceMissingServiceError({ serviceId });
  }

  return entry.descriptor;
}

/**
 * Resolves a registered runtime service by id from the current realm.
 *
 * Query and command contexts delegate cross-service calls through this lookup so one service can reuse
 * another's runtime contract. Synchronous because callers need it inside sync query handlers.
 */
export function getService(serviceId: ServiceId): RuntimeService;
export function getService<TDefinition extends AnyServiceDefinition>(
  serviceId: ServiceId
): ServiceInstanceOf<TDefinition>;
export function getService<TDefinition extends AnyServiceDefinition>(
  serviceId: ServiceId
): RuntimeService | ServiceInstanceOf<TDefinition> {
  const entry = getRegistry().get(serviceId);

  if (!entry) {
    throw new OpenServiceMissingServiceError({ serviceId });
  }

  return entry.instance as unknown as ServiceInstanceOf<TDefinition>;
}

/**
 * Removes one registered service and tears down its channel listeners.
 *
 * After this the id can be re-registered — useful for hot-reload scenarios where a definition changes.
 */
export function unregisterService(serviceId: ServiceId): void {
  const entry = getRegistry().get(serviceId);

  if (entry) {
    entry.disconnect();
    getRegistry().delete(serviceId);
  }
}

/**
 * Clears the registry, tearing down each service's channel listeners first.
 *
 * Tests call this after each case so registrations — and the channel listeners a registration attaches
 * — from one scenario do not leak into the next.
 */
export function clearRegistry(): void {
  const registry = getRegistry();

  for (const entry of registry.values()) {
    entry.disconnect();
  }

  registry.clear();
}
