import type { Patch } from 'immer';

import { ServiceRuntime, deepMerge } from './service-runtime.ts';
import type { ServiceDefinition } from './types.ts';

/**
 * Build the static-mode artifacts for a service definition.
 *
 * Iterates queries that declare a `preload`, enumerates each preload's inputs, and runs each
 * input in its own sandboxed runtime. Captures the Immer patch list produced, converts it to
 * a state-shaped diff (`{a:{b:1}}`), and stores it under the query's `path(ctx, input)`
 * callback (or a default).
 *
 * If multiple query-input pairs resolve to the same filename, their diffs are deep-merged
 * into a single artifact at that path — the "many queries, one file" pattern, useful when
 * several queries share an underlying single-file backing store.
 *
 * Services with no preloads (no `def.queries.*.preload`) return an empty Map.
 */
export async function buildServiceArtifacts<TDef extends ServiceDefinition<any, any, any>>(
  definition: TDef
): Promise<Map<string, unknown>> {
  const artifacts = new Map<string, Record<string, unknown>>();

  // Build a discovery runtime to enumerate which preloads exist. This runtime isn't used to
  // capture patches — each query-input pair gets its own sandboxed runtime below.
  const discovery = new ServiceRuntime(definition);
  const preloadNames = discovery.getPreloadNames();
  if (preloadNames.length === 0) return artifacts;

  for (const queryName of preloadNames) {
    const inputs = await discovery.resolvePreloadInputs(queryName);
    for (const input of inputs) {
      const sandbox = new ServiceRuntime(definition);

      // Subscribe before firing so we capture every patch the preload produces (a preload
      // may call multiple commands and emit several state transitions).
      const collected: Patch[] = [];
      const unsub = sandbox.subscribe((_state, _previous, patches) => {
        collected.push(...patches);
      });

      try {
        await sandbox.firePreload(queryName, input);
      } finally {
        unsub();
      }

      const filename = sandbox.preloadFilename(queryName, input);
      const diff = patchesToStateDiff(collected, definition.id, queryName);

      const existing = artifacts.get(filename);
      if (existing) {
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
 *   - `remove` patches are rejected. Build-time preloads should be producing data, not deleting.
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
        `[service ${serviceId}] Query "${queryName}"'s preload produced a 'remove' patch at ` +
          `${JSON.stringify(patch.path)}. Build-time artifacts only support data-producing ` +
          `patches (add/replace).`
      );
    }
    if (patch.path.some((p) => typeof p === 'number')) {
      throw new Error(
        `[service ${serviceId}] Query "${queryName}"'s preload produced an array-index patch at ` +
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
