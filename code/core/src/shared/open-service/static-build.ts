import { toMerged } from 'es-toolkit/object';

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

/**
 * Builds the serialized static-state snapshots for a set of services.
 *
 * For every query that declares both `preload` and `static.inputs`, this function:
 * - creates a fresh runtime from the service's initial state
 * - resolves all static inputs
 * - validates each input exactly like a runtime call would
 * - runs preload for that input
 * - stores the resulting state under the resolved static path
 *
 * Snapshots that land on the same path are deep-merged so multiple queries can contribute to one
 * serialized state file.
 */
export async function buildStaticFiles(services: RuntimeServiceDefinition[]): Promise<StaticStore> {
  const store: StaticStore = {};
  const buildTasks: Promise<BuildTaskResult>[] = [];

  for (const service of services) {
    for (const [queryName, query] of Object.entries(service.queries) as [
      string,
      RuntimeQueryDefinition,
    ][]) {
      if (!query.preload || !query.static?.inputs) {
        continue;
      }

      // Resolve the static input list from a clean runtime so discovery cannot leak state.
      const inputsRuntime = createServiceRuntime(
        service,
        undefined,
        structuredClone(service.initialState)
      );
      const inputs = await query.static.inputs(inputsRuntime.queryCtx);

      buildTasks.push(
        ...inputs.map(async (input) => {
          // Each input gets its own fresh runtime so the snapshot only reflects that preload path.
          const buildRuntime = createServiceRuntime(
            service,
            undefined,
            structuredClone(service.initialState)
          );
          const validatedInput = await validateSchema(query.input, input, {
            kind: 'query',
            serviceId: service.id,
            name: queryName,
            phase: 'input',
          });
          const path = resolveStaticPath(service.id, query, validatedInput, buildRuntime.queryCtx);

          // Run the same preload logic used at runtime, but capture the resulting state to disk.
          await query.preload!(validatedInput, buildRuntime.queryCtx);

          return { path, state: buildRuntime.stateSignal() };
        })
      );
    }
  }

  const builtStates = await Promise.all(buildTasks);

  for (const { path, state } of builtStates) {
    // Shared paths intentionally merge so multiple queries can contribute one serialized file.
    store[path] = path in store ? toMerged(store[path] as object, state as object) : state;
  }

  return store;
}
