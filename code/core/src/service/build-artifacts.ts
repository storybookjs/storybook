import type { Patch } from 'immer';

import { ServiceRuntime } from './service-runtime.ts';
import type {
  BuildCtx,
  LoaderDefinition,
  ServiceDefinition,
  ServiceRegistration,
} from './types.ts';

/** Default filename for the whole-state artifact. */
export const STATE_ARTIFACT_NAME = 'state.json';

/**
 * Build the static-mode artifacts for a service definition.
 *
 * Constructs a fresh runtime from the definition + registration, then snapshots whatever the
 * runtime ends up with after construction. Additionally, iterates the loaders declared in
 * `definition.load`, runs each enumerated input through its own sandboxed runtime, captures
 * the patch list that loader produced, and writes that to the loader's file path.
 *
 * Returns a `Map<filename, value>`. The caller decides how to persist:
 *   - In a real build, iterate the map and `fs.writeFile(path, JSON.stringify(value))`.
 *   - In tests, hand the map straight to a Map-backed `ServiceStaticTransport`.
 *
 * Honours `definition.load === false` by returning an empty map.
 */
export async function buildServiceArtifacts<TDef extends ServiceDefinition<any, any, any, any>>(
  definition: TDef,
  registration?: ServiceRegistration<TDef>
): Promise<Map<string, unknown>> {
  const artifacts = new Map<string, unknown>();

  if (definition.load === false) {
    return artifacts;
  }

  // 1. Emit `state.json` containing the post-setup state.
  const runtime = new ServiceRuntime(definition, registration);
  await runtime.ready;
  artifacts.set(STATE_ARTIFACT_NAME, runtime.getState());

  // 2. Emit per-loader-input files containing the patch list each loader produces.
  if (definition.load) {
    await emitLoaderArtifacts(definition, registration, artifacts);
  }

  return artifacts;
}

/**
 * Build artifacts from an existing runtime. Use this when you want to pre-mutate state (run
 * commands, populate caches) before snapshotting — e.g. running `generateDocgen` for every
 * component at build time so the resulting `state.json` already contains all the docgen data.
 *
 * Note: this form snapshots whatever state the runtime currently holds, but does NOT iterate
 * loaders. For loader-driven per-input files, use `buildServiceArtifacts` (which runs each
 * loader against a freshly-constructed sandbox runtime so each file contains only that
 * loader's patches, not the cumulative state).
 */
export function buildServiceArtifactsFromRuntime<
  TDef extends ServiceDefinition<any, any, any, any>,
>(runtime: ServiceRuntime<TDef>): Map<string, unknown> {
  const artifacts = new Map<string, unknown>();
  const definition = runtime.definition;

  if (definition.load === false) {
    return artifacts;
  }

  artifacts.set(STATE_ARTIFACT_NAME, runtime.getState());
  return artifacts;
}

// -------------------- per-loader artifact emission --------------------

/**
 * For each declared loader, resolve its enumerated inputs and fire each in turn against a
 * fresh sandbox runtime, capturing the patches produced and writing them to the loader's
 * file path. Each loader+input pair gets an independent runtime so the captured patches
 * contain only that loader's mutations, isolated from other loaders.
 */
async function emitLoaderArtifacts<TDef extends ServiceDefinition<any, any, any, any>>(
  definition: TDef,
  registration: ServiceRegistration<TDef> | undefined,
  artifacts: Map<string, unknown>
): Promise<void> {
  const load = definition.load;
  if (!load || load === false) return;

  const loaders = load as Record<string, LoaderDefinition<unknown, unknown>>;
  for (const [queryName, loader] of Object.entries(loaders)) {
    const inputs = await resolveEnumerateInputs(loader);
    for (const input of inputs) {
      const sandbox = new ServiceRuntime(definition, registration);
      await sandbox.ready;

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
      artifacts.set(filename, collected);
    }
  }
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
