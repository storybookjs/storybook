import { createServiceRuntime } from './service-runtime.ts';
import {
  OpenServiceDuplicateRegistrationError,
  OpenServiceMissingServiceError,
} from '../../server-errors.ts';
import { instances, type AnyServiceDefinition, type RegistryEntry } from './instances.ts';
import type {
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
 * swap handlers, preload hooks, or static config per operation while the original schema contract
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
 * Shared registry API injected into registered runtimes.
 *
 * The runtime contexts only need cross-service `getService` lookups; discovery APIs like
 * `listServices` and `describeService` live as standalone exports so the runtime contract stays
 * minimal.
 */
export const registryApi: ServiceRegistryApi = {
  getService,
};

/**
 * Registers one service definition in the module-local registry and returns its runtime instance.
 *
 * Throws `OpenServiceDuplicateRegistrationError` if a service with the same id is already
 * registered: the registry must have exactly one canonical definition per id, and callers are
 * expected to register each service exactly once per process.
 */
export function registerService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
): ServiceInstance<TState, TQueries, TCommands> {
  if (instances.has(definition.id)) {
    throw new OpenServiceDuplicateRegistrationError({ serviceId: definition.id });
  }

  const resolvedDefinition = applyRegistration(definition, registration);
  const runtime = createServiceRuntime(resolvedDefinition, { registryApi });
  const registeredRuntime: ServiceInstance<TState, TQueries, TCommands> = {
    queries: runtime.queries,
    commands: runtime.commands,
  };
  const descriptor = describeDefinition(resolvedDefinition as AnyServiceDefinition);
  const entry: RegistryEntry = {
    definition: definition as AnyServiceDefinition,
    runtime: registeredRuntime as RuntimeService,
    descriptor,
    summary: summarizeDescriptor(descriptor),
  };

  instances.set(definition.id, entry);

  return registeredRuntime;
}

/**
 * Returns the authored definitions currently registered in this server process.
 *
 * Static build code uses this to discover which services contribute preload snapshots.
 */
export function getRegisteredServices(): AnyServiceDefinition[] {
  return Array.from(instances.values(), ({ definition }) => definition);
}

/**
 * Returns one summary entry per registered service.
 *
 * This is the lowest-cost discovery endpoint for callers that only need ids, descriptions, and
 * operation names.
 */
export async function listServices(): Promise<ServiceSummary[]> {
  return Array.from(instances.values(), ({ summary }) => summary);
}

/**
 * Returns the schema-backed descriptor for one registered service.
 *
 * The descriptor mirrors the public contract of the service without exposing handlers or state.
 */
export async function describeService(serviceId: ServiceId): Promise<ServiceDescriptor> {
  const entry = instances.get(serviceId);

  if (!entry) {
    throw new OpenServiceMissingServiceError({ serviceId });
  }

  return entry.descriptor;
}

/**
 * Resolves a registered runtime service by id from the current server process.
 *
 * Query and command contexts delegate cross-service calls through this lookup so one service can
 * reuse another service's runtime contract.
 */
export async function getService(serviceId: ServiceId): Promise<RuntimeService> {
  const entry = instances.get(serviceId);

  if (!entry) {
    throw new OpenServiceMissingServiceError({ serviceId });
  }

  return entry.runtime;
}

/**
 * Clears the module-local registry.
 *
 * Tests call this after each case so registrations from one scenario do not leak into the next.
 */
export function clearRegistry(): void {
  instances.clear();
}
