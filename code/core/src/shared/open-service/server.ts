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
 * Builds serialized static-state snapshots for `load`-enabled queries in the server runtime.
 *
 * Each static input runs against a fresh service runtime so one load path cannot leak state into
 * another path's snapshot. The runtime's `runLoadOnce` helper drives the load to completion
 * (including transitively triggered self-queries) before the resulting state is captured.
 */
export async function buildStaticFiles(services: RuntimeServiceDefinition[]): Promise<StaticStore> {
  const store: StaticStore = {};
  const buildTasks: Promise<BuildTaskResult[]>[] = [];

  for (const service of services) {
    for (const [queryName, query] of Object.entries(service.queries) as [
      string,
      RuntimeQueryDefinition,
    ][]) {
      const { load, static: staticConfig } = query;
      if (!load || !staticConfig?.inputs) {
        continue;
      }

      buildTasks.push(
        (async () => {
          const inputsRuntime = createServiceRuntime(
            service,
            { registryApi: serviceRegistryApi },
            structuredClone(service.initialState)
          );
          const inputs = await staticConfig.inputs(inputsRuntime.loadCtxForStatic);

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
                buildRuntime.loadCtxForStatic
              );

              await buildRuntime.runLoadOnce(queryName, validatedInput);

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
  const staticStore = await buildStaticFiles(getRegisteredServices());

  await Promise.all(
    Object.entries(staticStore).map(async ([relativePath, state]) => {
      const outputPath = join(outputDir, 'services', ...relativePath.split('/'));

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, JSON.stringify(state, null, 2));
    })
  );
}
