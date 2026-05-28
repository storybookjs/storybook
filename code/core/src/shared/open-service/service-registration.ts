import { createServiceRuntime } from './service-runtime.ts';
import {
  OpenServiceDuplicateRegistrationError,
  OpenServiceMissingServiceError,
} from '../../server-errors.ts';
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
  runtime: RuntimeService;
  summary: ServiceSummary;
  descriptor: ServiceDescriptor;
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
 * Applies optional server-side overrides to an authored service definition.
 *
 * Registration overrides are shallow merges over the authored definition. That lets the server
 * swap handlers, load hooks, or static config per operation while the original schema contract
 * and operation names remain the source of truth.
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
      Object.entries(definition.queries).map(([name, query]) => [
        name,
        registration?.queries?.[name as keyof TQueries]
          ? { ...query, ...registration.queries[name as keyof TQueries] }
          : query,
      ])
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

  const resolvedDefinition = applyRegistration(definition, registration);
  const runtime = createServiceRuntime(resolvedDefinition, { registryApi: serviceRegistryApi });
  const registeredRuntime = {
    queries: runtime.queries,
    commands: runtime.commands,
    ...serviceRegistryApi,
  } as ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi;
  const descriptor = describeDefinition(resolvedDefinition as AnyServiceDefinition);

  // Persist the runtime together with precomputed metadata so later lookups stay cheap and do not
  // need to rebuild descriptors from the authored definition each time.
  registry.set(definition.id, {
    definition: resolvedDefinition as AnyServiceDefinition,
    runtime: registeredRuntime as RuntimeService,
    descriptor,
    summary: summarizeDescriptor(descriptor),
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

  return entry.runtime as ServiceInstanceOf<TDefinition>;
}

/**
 * Clears the process-global registry.
 *
 * Tests call this after each case so registrations from one scenario do not leak into the next.
 */
export function clearRegistry(): void {
  getRegistry().clear();
}
