import type { Patch } from 'immer';

import { ServiceRuntime, UNSAFE_KEYS, deepMerge } from './service-runtime.ts';
import { validateAsync } from './service-validation.ts';
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
    const queryDef = definition.queries[queryName];
    const inputSchema = queryDef?.input;
    const inputs = await discovery.resolvePreloadInputs(queryName);
    for (const rawInput of inputs) {
      // Validate the enumerated input against the query's input schema (if declared) so the
      // build keys artifacts off the *parsed* value — matching what runtime callers will
      // request. A `z.string().transform(s => s.toUpperCase())` schema with `inputs: ['abc']`
      // emits the artifact under `'ABC'`, not `'abc'`.
      const input = inputSchema
        ? await validateAsync(inputSchema, rawInput, {
            serviceId: definition.id,
            kind: 'query',
            name: queryName,
            phase: 'input',
          })
        : rawInput;

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
 *   - Empty paths (root replacement) are rejected — preloads should mutate the draft, not
 *     return a new object. The artifact format has no way to encode "replace the whole state".
 *   - Path segments matching {@link UNSAFE_KEYS} (`__proto__`, `constructor`, `prototype`) are
 *     rejected to prevent JSON-encoded prototype pollution slipping into shipped artifacts.
 *
 * All rejections throw with an actionable hint pointing at the offending path.
 *
 * @internal Exported for direct testing of the guards. Not part of the public service API.
 */
export function patchesToStateDiff(
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
    if (patch.path.length === 0) {
      throw new Error(
        `[service ${serviceId}] Query "${queryName}"'s preload produced a root-replacement ` +
          `patch (empty path). Mutate the draft (\`draft.byId[x] = ...\`) instead of returning ` +
          `a new state object from \`setState\`.`
      );
    }
    if (patch.path.some((p) => typeof p === 'number')) {
      throw new Error(
        `[service ${serviceId}] Query "${queryName}"'s preload produced an array-index patch at ` +
          `${JSON.stringify(patch.path)}. Model collections as records (\`{ byId: Record<...> }\`) ` +
          `rather than arrays so they compose under deep-merge.`
      );
    }
    if (patch.path.some((p) => typeof p === 'string' && UNSAFE_KEYS.has(p))) {
      throw new Error(
        `[service ${serviceId}] Query "${queryName}"'s preload wrote to an unsafe key at ` +
          `${JSON.stringify(patch.path)} (one of: ${[...UNSAFE_KEYS].join(', ')}). These keys ` +
          `can pollute Object.prototype when the artifact is rehydrated via JSON.parse.`
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
