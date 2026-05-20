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

  for (const def of services) {
    for (const [queryName, queryDef] of Object.entries(def.queries) as [
      string,
      RuntimeQueryDefinition,
    ][]) {
      if (!queryDef.preload || !queryDef.static?.inputs) {
        continue;
      }

      const inputsRuntime = createServiceRuntime(def, undefined, structuredClone(def.initialState));
      const inputs = await queryDef.static.inputs(inputsRuntime.queryCtx);

      buildTasks.push(
        ...inputs.map(async (input) => {
          const buildRuntime = createServiceRuntime(
            def,
            undefined,
            structuredClone(def.initialState)
          );
          const validatedInput = await validateSchema(queryDef.input, input, {
            kind: 'query',
            serviceId: def.id,
            name: queryName,
            phase: 'input',
          });
          const path = resolveStaticPath(def.id, queryDef, validatedInput, buildRuntime.queryCtx);

          await queryDef.preload!(validatedInput, buildRuntime.queryCtx);

          return { path, state: buildRuntime.stateSignal() };
        })
      );
    }
  }

  const builtStates = await Promise.all(buildTasks);

  for (const { path, state } of builtStates) {
    store[path] = path in store ? toMerged(store[path] as object, state as object) : state;
  }

  return store;
}
