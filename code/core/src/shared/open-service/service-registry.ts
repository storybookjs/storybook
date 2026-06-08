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
  OpenServiceMissingChannelError,
  OpenServiceMissingServiceError,
} from '../../server-errors.ts';
import { getChannel } from '../../channels/channel-slot.ts';
import { generateClientId } from './service-channel.ts';
import { createServiceRuntime } from './service-runtime.ts';
import { createSnapshotReconciler } from './service-sync.ts';
import { connectServiceToChannel } from './service-transport.ts';
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

type RegistryEntry = {
  definition: AnyServiceDefinition;
  /** The public, channel-wrapped runtime surface returned from `registerService` and `getService`. */
  instance: RuntimeService;
  descriptor: ServiceDescriptor;
  summary: ServiceSummary;
  /** Tears down this service's channel listeners. */
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
        // Only `staticInputs` is a supported query override. Picking it explicitly stops untyped JS
        // callers from merging unsupported keys (e.g. `handler`, `load`) into the definition.
        return [
          name,
          override && 'staticInputs' in override
            ? { ...query, staticInputs: override.staticInputs }
            : query,
        ];
      })
    ) as TQueries,
    commands: Object.fromEntries(
      Object.entries(definition.commands).map(([name, command]) => {
        const override = registration.commands?.[name as keyof TCommands];
        // Only `handler` is a supported command override. Picking it explicitly stops untyped JS
        // callers from merging unsupported keys into the definition.
        return [
          name,
          override && 'handler' in override ? { ...command, handler: override.handler } : command,
        ];
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
 * callers use, wraps commands to broadcast their post-mutation state, and joins the cross-peer sync
 * protocol as a hub or leaf (`relay`). Each runtime must install the addons channel at its entry
 * boundary before calling this (builders, manager boot, server `services` preset, or Node import
 * bootstrap). Registration is idempotent by id: a repeated registration returns the existing runtime.
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

  // Registration is idempotent by id. Re-registering an already-registered service returns the
  // existing runtime instead of throwing. This deliberately swallows duplicate-id collisions, which is
  // the right trade-off: core services register from a `beforeAll` annotation that CSF4 composes twice
  // (once in `definePreview`, once in `StoryStore`), and `beforeAll` also re-runs on HMR. A second
  // registration is a no-op rather than a crash.
  const existingEntry = registry.get(definition.id);
  if (existingEntry) {
    return existingEntry.instance as unknown as ServiceInstance<TState, TQueries, TCommands> &
      ServiceRegistryApi;
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
    setState: (mutate) =>
      runtime.commandSelf.setState((state) => mutate(state as Record<string, unknown>)),
    initialStamp: { version: 0, clientId: ownClientId },
  });

  const getSnapshot = (): Record<string, unknown> =>
    runtime.getStateSnapshot() as Record<string, unknown>;

  const descriptor = describeDefinition(resolvedDefinition as AnyServiceDefinition);

  const channel = getChannel();
  if (!channel) {
    throw new OpenServiceMissingChannelError({ serviceId: definition.id });
  }

  // A command may only have a handler in some runtimes (e.g. supplied at server registration). Where
  // a local handler exists, callers run it locally and broadcast; where it does not, the resulting
  // command routes calls to a peer that implements it and awaits the reply.
  const implementedCommandNames = new Set<string>(
    Object.entries(resolvedDefinition.commands)
      .filter(([, command]) => typeof command.handler === 'function')
      .map(([name]) => name)
  );

  // Wire the runtime to the channel end to end against the one channel captured above: broadcast-wrap
  // commands, run the remote-command protocol, and attach the sync-start + patch listeners.
  const { commands, disconnect } = connectServiceToChannel({
    serviceId: definition.id,
    ownClientId,
    reconciler,
    getSnapshot,
    channel,
    relay,
    commands: runtime.commands as Record<string, (input: unknown) => Promise<unknown>>,
    implementedCommandNames,
    commandNames: Object.keys(resolvedDefinition.commands),
    runtime,
  });

  const instance = {
    queries: runtime.queries,
    commands: commands as ServiceInstance<TState, TQueries, TCommands>['commands'],
    ...serviceRegistryApi,
  } as ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi;

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
export function getService<TInstance extends RuntimeService = RuntimeService>(
  serviceId: ServiceId
): TInstance {
  const entry = getRegistry().get(serviceId);

  if (!entry) {
    throw new OpenServiceMissingServiceError({ serviceId });
  }

  return entry.instance as unknown as TInstance;
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
