import type { Patch } from 'immer';

import { ServiceRuntime, deepMerge } from './service-runtime.ts';
import type {
  BuildCtx,
  LoaderDefinition,
  ServiceDefinition,
  ServiceRegistration,
} from './types.ts';

/**
 * Build the static-mode artifacts for a service definition.
 *
 * For each loader declared in `definition.load`, enumerates the loader's inputs and runs each
 * input in its own sandboxed runtime. Captures the Immer patch list each loader produces,
 * converts it to a state-shaped diff (JSON-Merge-Patch flavour: `{a:{b:1}}`), and stores that
 * under the loader's `path(ctx, input)` callback (or a default).
 *
 * If multiple loader-input pairs resolve to the same filename, their diffs are deep-merged
 * into a single artifact at that path. This is the "many loaders, one file" pattern — useful
 * when several queries share an underlying single-file backing store.
 *
 * Services that don't declare any loaders return an empty Map.
 *
 * Returns `Map<filename, value>`. The caller decides how to persist:
 *   - In a real build, iterate the map and `fs.writeFile(path, JSON.stringify(value))`.
 *   - In tests, hand the map straight to a Map-backed `ServiceStaticTransport`.
 */
export async function buildServiceArtifacts<TDef extends ServiceDefinition<any, any, any, any>>(
  definition: TDef,
  registration?: ServiceRegistration<TDef>
): Promise<Map<string, unknown>> {
  const artifacts = new Map<string, Record<string, unknown>>();
  if (!definition.load) return artifacts;

  const loaders = definition.load as Record<string, LoaderDefinition<unknown, unknown>>;
  for (const [queryName, loader] of Object.entries(loaders)) {
    const inputs = await resolveEnumerateInputs(loader);
    for (const input of inputs) {
      const sandbox = new ServiceRuntime(definition, registration);

      // Subscribe before firing so we capture every patch the loader's body produces (a
      // loader may call multiple commands and emit several state transitions).
      const collected: Patch[] = [];
      const unsub = sandbox.subscribe((_state, _previous, patches) => {
        collected.push(...patches);
      });

      try {
        await sandbox.fireLoader(queryName, input);
      } finally {
        unsub();
      }

      const filename = sandbox.loaderFilename(queryName, input);
      const diff = patchesToStateDiff(collected, definition.id, queryName);

      const existing = artifacts.get(filename);
      if (existing) {
        // Same filename used by another loader-input pair — merge into the existing artifact.
        deepMerge(existing, diff);
      } else {
        artifacts.set(filename, diff);
      }
    }
  }

  return artifacts;
}

/**
 * Convert a list of Immer patches into a nested-object state diff suitable for `JSON.stringify`
 * and runtime `deepMerge`. Each patch's `path` becomes a chain of object keys ending at `value`.
 *
 * Constraints (matching the broader architecture's record-shaped-state guidance):
 *   - Numeric path segments (Immer's array-index patches) are rejected. State should be modelled
 *     as records (`{ byId: Record<...> }`) rather than arrays. Whole-array replacements are
 *     fine — they show up as a single `replace` patch with no numeric segments.
 *   - `remove` patches are rejected. Build-time loaders should be producing data, not deleting.
 *
 * Both rejections throw with an actionable hint pointing at the offending path.
 */
function patchesToStateDiff(
  patches: readonly Patch[],
  serviceId: string,
  queryName: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const patch of patches) {
    if (patch.op === 'remove') {
      throw new Error(
        `[service ${serviceId}] Loader "${queryName}" produced a 'remove' patch at ` +
          `${JSON.stringify(patch.path)}. Build-time artifacts only support data-producing ` +
          `patches (add/replace).`
      );
    }
    if (patch.path.some((p) => typeof p === 'number')) {
      throw new Error(
        `[service ${serviceId}] Loader "${queryName}" produced an array-index patch at ` +
          `${JSON.stringify(patch.path)}. Model collections as records (\`{ byId: Record<...> }\`) ` +
          `rather than arrays so they compose under deep-merge.`
      );
    }
    let target: Record<string, unknown> = result;
    for (let i = 0; i < patch.path.length - 1; i++) {
      const key = patch.path[i] as string;
      const next = target[key];
      if (next === null || typeof next !== 'object' || Array.isArray(next)) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    const lastKey = patch.path[patch.path.length - 1] as string;
    target[lastKey] = patch.value;
  }
  return result;
}

/**
 * Resolve a loader's `enumerateInputs` to a concrete list. Supports:
 *   - `undefined` → one synthetic "no input" call (single `undefined` input).
 *   - An array → used as-is.
 *   - A function → invoked with the build ctx; may be async.
 */
async function resolveEnumerateInputs(
  loader: LoaderDefinition<unknown, unknown>
): Promise<readonly unknown[]> {
  const e = loader.enumerateInputs;
  if (e === undefined) return [undefined];
  if (typeof e === 'function') {
    const buildCtx: BuildCtx = { isBuild: true };
    return await (e as (ctx: BuildCtx) => readonly unknown[] | Promise<readonly unknown[]>)(
      buildCtx
    );
  }
  return e as readonly unknown[];
}
