import { mkdir, writeFile } from 'node:fs/promises';

import { dirname, join } from 'pathe';

import { toMerged } from 'es-toolkit/object';

import {
  clearRegistry,
  describeService,
  getRegisteredServices,
  getService,
  listServices,
  registerService,
  serviceRegistryApi,
} from './service-registration.ts';
import { createServiceRuntime, resolveStaticPath } from './service-runtime.ts';
import { validateSchema } from './service-validation.ts';
import type {
  AnySchema,
  BuildTaskResult,
  Commands,
  Queries,
  QueryDefinition,
  ServiceDefinition,
  StaticStore,
} from './types.ts';

type RuntimeServiceDefinition = ServiceDefinition<unknown, Queries<unknown>, Commands<unknown>>;
type RuntimeQueryDefinition = QueryDefinition<unknown, AnySchema, AnySchema>;

export {
  clearRegistry,
  describeService,
  getRegisteredServices,
  getService,
  listServices,
  registerService,
};

/**
 * Builds serialized static-state snapshots for preload-enabled queries across every service
 * currently in the registry.
 *
 * Each static input runs against a fresh service runtime so one preload path cannot leak state
 * into another path's snapshot. Cross-service `ctx.getService(...)` lookups inside a preload
 * resolve through the live registry, matching dev-server behavior.
 */
export async function buildStaticFiles(): Promise<StaticStore> {
  const store: StaticStore = {};
  const buildTasks: Promise<BuildTaskResult[]>[] = [];

  for (const service of getRegisteredServices() as RuntimeServiceDefinition[]) {
    for (const [queryName, query] of Object.entries(service.queries) as [
      string,
      RuntimeQueryDefinition,
    ][]) {
      const { preload, static: staticConfig } = query;
      if (!preload || !staticConfig?.inputs) {
        continue;
      }

      buildTasks.push(
        (async () => {
          const inputsRuntime = createServiceRuntime(
            service,
            { registryApi: serviceRegistryApi },
            structuredClone(service.initialState)
          );
          const inputs = await staticConfig.inputs(inputsRuntime.queryCtx);

          return Promise.all(
            inputs.map(async (input) => {
              // Build every static input from a clean initial state so the serialized output mirrors
              // the one path this task is responsible for.
              const buildRuntime = createServiceRuntime(
                service,
                { registryApi: serviceRegistryApi },
                structuredClone(service.initialState)
              );
              const validatedInput = await validateSchema(query.input, input, {
                kind: 'query',
                serviceId: service.id,
                name: queryName,
                phase: 'input',
              });
              const path = resolveStaticPath(
                service.id,
                queryName,
                query,
                validatedInput,
                buildRuntime.queryCtx
              );

              await preload(validatedInput, buildRuntime.queryCtx);

              return { path, state: buildRuntime.stateSignal() };
            })
          );
        })()
      );
    }
  }

  const builtStates = (await Promise.all(buildTasks)).flat();

  for (const { path, state } of builtStates) {
    store[path] = path in store ? toMerged(store[path] as object, state as object) : state;
  }

  return store;
}

/**
 * Writes the registered services' static snapshots to `<outputDir>/services`.
 *
 * The snapshot keys are normalized slash-separated logical paths; splitting them here lets `join`
 * produce the correct native separators for the current operating system.
 */
export async function writeOpenServiceStaticFiles(outputDir: string): Promise<void> {
  const staticStore = await buildStaticFiles();

  await Promise.all(
    Object.entries(staticStore).map(async ([relativePath, state]) => {
      const outputPath = join(outputDir, 'services', ...relativePath.split('/'));

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(state, null, 2));
    })
  );
}
