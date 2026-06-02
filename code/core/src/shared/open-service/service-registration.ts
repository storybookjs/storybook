import { createServiceRuntime, type ServiceRuntime } from './service-runtime.ts';
import { generateClientId, getServiceChannel } from './service-channel.ts';
import { createSnapshotReconciler } from './service-sync.ts';
import { connectRuntimeToChannel, wrapCommandsForBroadcast } from './service-transport.ts';
import {
  OpenServiceDuplicateRegistrationError,
  OpenServiceMissingServiceError,
} from '../../server-errors.ts';
import type {
  AnyServiceDefinition,
  AnyQueryDefinition,
  Commands,
  Queries,
  RegisteredStaticInputs,
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

type AnyServiceRuntime = ServiceRuntime<unknown, Queries<unknown>, Commands<unknown>>;

type RegistryEntry = {
  definition: AnyServiceDefinition;
  runtime: RuntimeService;
  serviceRuntime: AnyServiceRuntime;
  summary: ServiceSummary;
  descriptor: ServiceDescriptor;
  /** Tears down this service's channel listeners. A no-op when no channel was installed. */
  disconnect: () => void;
};

const OPEN_SERVICE_REGISTRY_SYMBOL = Symbol.for('storybook.open-service.registry');

/**
 * Returns the process-global registry backing server-side service registration.
 *
 * The registry is anchored on a symbol-keyed `globalThis` slot so all modules in the same process
 * share one registration map even if this file is imported through different paths. That keeps
 * runtime lookups, static builds, and tests pointed at the same service inventory.
 */
function getRegistry(): Map<string, RegistryEntry> {
  const registryGlobal = globalThis as {
    [key: symbol]: Map<string, RegistryEntry> | undefined;
  };

  // Lazily create the registry so importing the module does not eagerly mutate global state.
  registryGlobal[OPEN_SERVICE_REGISTRY_SYMBOL] ??= new Map<string, RegistryEntry>();

  return registryGlobal[OPEN_SERVICE_REGISTRY_SYMBOL];
}

/**
 * Converts one service definition into the serializable descriptor returned by registry metadata
 * APIs.
 *
 * Descriptors intentionally expose schemas and descriptions, but not runtime handlers, so callers
 * can inspect the contract of a registered service without gaining access to executable behavior.
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

/**
 * Derives the lightweight summary returned by `listServices()` from a full descriptor.
 *
 * Keeping this separate avoids recomputing names from the live definition shape whenever callers
 * only need discovery metadata for navigation or debugging UIs.
 */
function summarizeDescriptor(descriptor: ServiceDescriptor): ServiceSummary {
  return {
    id: descriptor.id,
    description: descriptor.description,
    queryNames: Object.keys(descriptor.queries),
    commandNames: Object.keys(descriptor.commands),
  };
}

/**
 * Resolves the static input enumerator stored on a registered query.
 *
 * Registration may override the authored definition. When it does not, the definition's
 * `staticInputs` is forwarded as-is so ctx-aware enumerators keep receiving `LoadCtx` at call time.
 */
function resolveRegisteredStaticInputs<TState>(
  query: AnyQueryDefinition<TState>,
  registrationQuery?: { staticInputs?: RegisteredStaticInputs<TState> }
): RegisteredStaticInputs<TState> | undefined {
  if (registrationQuery?.staticInputs) {
    return registrationQuery.staticInputs;
  }

  return query.staticInputs;
}

/**
 * Applies optional server-side overrides to an authored service definition.
 *
 * Registration overrides are shallow merges over the authored definition. That lets the server
 * swap handlers, load hooks, or dependency-aware static input enumerators per operation while the
 * original schema contract, `staticPath`, and operation names remain the source of truth.
 */
function applyRegistration<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
): ServiceDefinition<TState, TQueries, TCommands> {
  return {
    ...definition,
    queries: Object.fromEntries(
      Object.entries(definition.queries).map(([name, query]) => {
        const registrationQuery = registration?.queries?.[name as keyof TQueries];
        const staticInputs = resolveRegisteredStaticInputs(query, registrationQuery);

        return [
          name,
          {
            ...query,
            ...registrationQuery,
            ...(staticInputs ? { staticInputs } : {}),
          },
        ];
      })
    ) as TQueries,
    commands: Object.fromEntries(
      Object.entries(definition.commands).map(([name, command]) => [
        name,
        registration?.commands?.[name as keyof TCommands]
          ? { ...command, ...registration.commands[name as keyof TCommands] }
          : command,
      ])
    ) as TCommands,
  };
}

/**
 * Shared registry API injected into registered runtimes and static-build runtimes.
 *
 * Exporting the object keeps all call sites on the same lookup implementation instead of each
 * environment assembling a structurally identical wrapper.
 */
export const serviceRegistryApi: ServiceRegistryApi = {
  listServices,
  describeService,
  getService,
};

/**
 * Registers one service definition in the process-global registry and returns its runtime surface.
 *
 * Registration resolves any server-side operation overrides first, then builds the runtime that
 * query and command callers will use, and finally stores both the runtime and its metadata in the
 * shared registry. Duplicate ids are rejected up front so lookups remain deterministic.
 *
 * If a channel is installed via `setServiceChannel` before this runs — which the dev server does in
 * the `services` preset, gated on a real websocket transport — registration also joins the
 * cross-peer sync protocol immediately: commands are wrapped to broadcast their post-mutation state,
 * and the runtime is wired as a relay hub so it bridges every connected manager tab. There is no
 * separate connect step, mirroring how the manager and preview register. Without a channel (static
 * builds) the runtime stays local-only.
 */
export function registerService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
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

  // Owns the per-service last-write-wins stamp and the shared adopt/advance logic. Adopting a peer
  // snapshot goes through `commandSelf.setState` here — not the wrapped commands below — which is how
  // the broadcast loop is prevented (identical to the client transport in `service-client.ts`).
  const reconciler = createSnapshotReconciler({
    stateSchema: runtime.stateSchema,
    setState: (mutate) =>
      runtime.commandSelf.setState((state) => mutate(state as Record<string, unknown>)),
    initialStamp: { version: 0, clientId: ownClientId },
  });

  const getSnapshot = (): Record<string, unknown> =>
    runtime.getStateSnapshot() as Record<string, unknown>;

  // Wrap commands so a server-authored mutation broadcasts its post-mutation snapshot to peers,
  // exactly as the manager and preview do. The wrapper re-reads the channel at call time, so without
  // a channel it is a no-op and static builds are unaffected.
  const registeredRuntime = {
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

  // The dev server is a relay hub: it bridges every connected manager tab, each on its own channel
  // transport. When a channel is installed (dev only — `setServiceChannel` is gated on a real
  // websocket transport) registration wires the sync protocol right here, so there is no separate
  // connect step. Without a channel the runtime stays local-only and there is nothing to tear down.
  const channel = getServiceChannel();
  const disconnect = channel
    ? connectRuntimeToChannel({
        serviceId: definition.id,
        channel,
        ownClientId,
        reconciler,
        getSnapshot,
        relay: true,
      })
    : (): void => {};

  // Persist the runtime together with precomputed metadata so later lookups stay cheap and do not
  // need to rebuild descriptors from the authored definition each time.
  registry.set(definition.id, {
    definition: resolvedDefinition as AnyServiceDefinition,
    runtime: registeredRuntime as unknown as RuntimeService,
    serviceRuntime: runtime as AnyServiceRuntime,
    descriptor,
    summary: summarizeDescriptor(descriptor),
    disconnect,
  });

  return registeredRuntime;
}

/**
 * Returns the authored definitions currently registered in this server process.
 *
 * Static build code uses this to discover which services contribute static snapshots.
 */
export function getRegisteredServices(): AnyServiceDefinition[] {
  return Array.from(getRegistry().values(), ({ definition }) => definition);
}

/**
 * Returns one summary entry per registered service.
 *
 * This is the lowest-cost discovery endpoint for callers that only need ids, descriptions, and
 * operation names.
 */
export async function listServices(): Promise<ServiceSummary[]> {
  return Array.from(getRegistry().values(), ({ summary }) => summary);
}

/**
 * Returns the schema-backed descriptor for one registered service.
 *
 * The descriptor mirrors the public contract of the service without exposing handlers or state.
 */
export async function describeService(serviceId: ServiceId): Promise<ServiceDescriptor> {
  const entry = getRegistry().get(serviceId);

  if (!entry) {
    throw new OpenServiceMissingServiceError({ serviceId });
  }

  return entry.descriptor;
}

/**
 * Resolves a registered runtime service by id from the current server process.
 *
 * Query and command contexts delegate cross-service calls through this lookup so one service can
 * reuse another service's runtime contract. Synchronous because callers need it available inside
 * sync query handlers.
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

  return entry.runtime as unknown as ServiceInstanceOf<TDefinition>;
}

/**
 * Clears the process-global registry, tearing down each service's channel listeners first.
 *
 * Tests call this after each case so registrations — and the channel listeners a registration now
 * attaches — from one scenario do not leak into the next.
 */
export function clearRegistry(): void {
  const registry = getRegistry();

  for (const entry of registry.values()) {
    entry.disconnect();
  }

  registry.clear();
}
