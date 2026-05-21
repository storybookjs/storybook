import { createServiceRuntime } from './service-runtime.ts';
import {
  OpenServiceDuplicateRegistrationError,
  OpenServiceMissingServiceError,
} from '../../server-errors.ts';
import type {
  Commands,
  Queries,
  RuntimeService,
  ServiceDefinition,
  ServiceDescriptor,
  ServiceInstance,
  ServiceRegistrationOptions,
  ServiceRegistryApi,
  ServiceSummary,
} from './types.ts';

type AnyServiceDefinition = ServiceDefinition<unknown, Queries<unknown>, Commands<unknown>>;
type RegistryEntry = {
  definition: AnyServiceDefinition;
  runtime: RuntimeService;
  summary: ServiceSummary;
  descriptor: ServiceDescriptor;
};

type GlobalRegistryStore = typeof globalThis & {
  __STORYBOOK_OPEN_SERVICE_REGISTRY__?: Map<string, RegistryEntry>;
};

function getRegistry(): Map<string, RegistryEntry> {
  const store = globalThis as GlobalRegistryStore;

  store.__STORYBOOK_OPEN_SERVICE_REGISTRY__ ??= new Map<string, RegistryEntry>();

  return store.__STORYBOOK_OPEN_SERVICE_REGISTRY__;
}

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

function summarizeDescriptor(descriptor: ServiceDescriptor): ServiceSummary {
  return {
    id: descriptor.id,
    description: descriptor.description,
    queryNames: Object.keys(descriptor.queries),
    commandNames: Object.keys(descriptor.commands),
  };
}

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

const registryApi: ServiceRegistryApi = {
  listServices,
  describeService,
  getService,
};

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
  const runtime = createServiceRuntime(resolvedDefinition, { registryApi });
  const registeredRuntime = {
    queries: runtime.queries,
    commands: runtime.commands,
    ...registryApi,
  } as ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi;
  const descriptor = describeDefinition(resolvedDefinition as AnyServiceDefinition);

  registry.set(definition.id, {
    definition: resolvedDefinition as AnyServiceDefinition,
    runtime: registeredRuntime as RuntimeService,
    descriptor,
    summary: summarizeDescriptor(descriptor),
  });

  return registeredRuntime;
}

/** Returns the registered service definitions for the current server process. */
export function getRegisteredServices(): AnyServiceDefinition[] {
  return Array.from(getRegistry().values(), ({ definition }) => definition);
}

/** Returns a summary entry for every service currently registered in this server process. */
export async function listServices(): Promise<ServiceSummary[]> {
  return Array.from(getRegistry().values(), ({ summary }) => summary);
}

/** Returns the schema-backed descriptor for one registered service. */
export async function describeService(serviceId: string): Promise<ServiceDescriptor> {
  const entry = getRegistry().get(serviceId);

  if (!entry) {
    throw new OpenServiceMissingServiceError({ serviceId });
  }

  return entry.descriptor;
}

/** Resolves a registered runtime service by id from the current server process. */
export async function getService(serviceId: string): Promise<RuntimeService> {
  const entry = getRegistry().get(serviceId);

  if (!entry) {
    throw new OpenServiceMissingServiceError({ serviceId });
  }

  return entry.runtime;
}

/** Clears the global server registry, primarily so tests can avoid cross-test leakage. */
export function clearRegistry(): void {
  getRegistry().clear();
}
