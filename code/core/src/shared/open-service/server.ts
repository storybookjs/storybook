import { mkdir, writeFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';

import { toMerged } from 'es-toolkit/object';

import type { ServerCoreServices, TypedGetService } from './core-service-types.ts';
import {
  clearRegistry,
  describeService,
  getRegisteredServiceTelemetry,
  getRegisteredServices,
  getService as getServiceCore,
  listServices,
  registerService as registerServiceCore,
  serviceRegistryApi,
} from './service-registry.ts';
import { createServiceRuntime, resolveStaticPath } from './service-runtime.ts';
import { validateSchema } from './service-validation.ts';
import type {
  AnyQueryDefinition,
  BuildTaskResult,
  Commands,
  Queries,
  ServiceDefinition,
  ServiceInstance,
  ServiceRegistrationOptions,
  ServiceRegistryApi,
  ServiceTelemetry,
  ServiceTelemetryHook,
  StaticStore,
} from './types.ts';

/** What writing the open-service static files leaves behind for the `build` telemetry event. */
export type OpenServiceStaticFiles = {
  /**
   * Summarizes every service registered with {@link registerServiceWithTelemetry}, keyed by service
   * id, or `undefined` when none reports. Deferred so a failing hook cannot fail the build.
   */
  summarizeTelemetry: () => Promise<Record<string, ServiceTelemetry> | undefined>;
};

type RuntimeServiceDefinition = ServiceDefinition<unknown, Queries<unknown>, Commands<unknown>>;
type RuntimeQueryDefinition = AnyQueryDefinition<unknown>;

export const getService = getServiceCore as TypedGetService<ServerCoreServices>;

export { clearRegistry, describeService, getRegisteredServices, listServices };

/**
 * Registers a service on the dev server and returns its runtime surface.
 *
 * The server is a relay hub: when a channel is installed (the `services` preset does this on a real
 * websocket transport) it bridges every connected manager tab. Without a channel — static builds and
 * the index builder — the runtime stays local-only.
 */
export function registerService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration?: ServiceRegistrationOptions<TState, TQueries, TCommands>
): ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi {
  return registerServiceCore(definition, registration, { relay: true });
}

/**
 * Internal {@link registerService} that also reports the service to the `build` telemetry event.
 * Kept off the public registration options so only core services can add telemetry fields.
 */
export function registerServiceWithTelemetry<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  registration: ServiceRegistrationOptions<TState, TQueries, TCommands>,
  telemetry: ServiceTelemetryHook<TState> | undefined
): ServiceInstance<TState, TQueries, TCommands> & ServiceRegistryApi {
  return registerServiceCore(definition, registration, { relay: true, telemetry });
}

/**
 * Builds serialized static-state snapshots for `load`-enabled queries across every service
 * currently in the registry.
 *
 * Each static input runs against a fresh service runtime so one load path cannot leak state
 * into another path's snapshot. The runtime's `runLoadOnce` helper drives the load to completion
 * (including transitively triggered self-queries) before the resulting state is captured.
 * Cross-service `ctx.getService(...)` lookups inside a load resolve through the live registry,
 * matching dev-server behavior.
 */
export async function buildStaticFiles(): Promise<StaticStore> {
  return toStaticStore(await buildStaticSnapshots());
}

/**
 * Writes the registered services' static snapshots to `<outputDir>/services`.
 *
 * The snapshot keys are normalized slash-separated logical paths; splitting them here lets `join`
 * produce the correct native separators for the current operating system.
 */
export async function writeOpenServiceStaticFiles(
  outputDir: string
): Promise<OpenServiceStaticFiles> {
  const snapshots = await buildStaticSnapshots();

  await Promise.all(
    Object.entries(toStaticStore(snapshots)).map(async ([relativePath, state]) => {
      const outputPath = join(outputDir, 'services', ...relativePath.split('/'));

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(state, null, 2));
    })
  );

  return { summarizeTelemetry: () => summarizeSnapshotsForTelemetry(snapshots) };
}

async function buildStaticSnapshots(): Promise<BuildTaskResult[]> {
  const buildTasks: Promise<BuildTaskResult[]>[] = [];

  for (const service of getRegisteredServices() as RuntimeServiceDefinition[]) {
    for (const [queryName, query] of Object.entries(service.queries) as [
      string,
      RuntimeQueryDefinition,
    ][]) {
      const { load, staticPath, staticInputs } = query;
      if (!staticPath || !load || !staticInputs) {
        continue;
      }

      buildTasks.push(
        (async () => {
          const inputsRuntime = createServiceRuntime(service, { registryApi: serviceRegistryApi });
          const inputs = await staticInputs(inputsRuntime.loadCtxForStatic);

          return Promise.all(
            inputs.map(async (input) => {
              // Build every static input from a clean initial state so the serialized output mirrors
              // the one path this task is responsible for.
              const buildRuntime = createServiceRuntime(service, {
                registryApi: serviceRegistryApi,
              });
              const validatedInput = await validateSchema(query.input, input, {
                kind: 'query',
                serviceId: service.id,
                name: queryName,
                phase: 'input',
              });
              const path = resolveStaticPath(service.id, queryName, { staticPath }, validatedInput);

              await buildRuntime.runLoadOnce(queryName, validatedInput);

              return { serviceId: service.id, path, state: buildRuntime.getStateSnapshot() };
            })
          );
        })()
      );
    }
  }

  return (await Promise.all(buildTasks)).flat();
}

function toStaticStore(snapshots: BuildTaskResult[]): StaticStore {
  const store: StaticStore = {};

  for (const { path, state } of snapshots) {
    store[path] = path in store ? toMerged(store[path] as object, state as object) : state;
  }

  return store;
}

async function summarizeSnapshotsForTelemetry(
  snapshots: BuildTaskResult[]
): Promise<Record<string, ServiceTelemetry> | undefined> {
  const summaries = await Promise.all(
    Array.from(getRegisteredServiceTelemetry(), async ([serviceId, telemetry]) => {
      const states = snapshots
        .filter((snapshot) => snapshot.serviceId === serviceId)
        .map((snapshot) => snapshot.state);
      return [serviceId, await telemetry(states)] as const;
    })
  );

  const reported = summaries.filter(
    (entry): entry is readonly [string, ServiceTelemetry] => entry[1] !== undefined
  );

  return reported.length > 0 ? Object.fromEntries(reported) : undefined;
}
