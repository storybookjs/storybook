import { logger } from '../../../../node-logger/index.ts';
import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../../server-errors.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { registerService } from '../../service-registration.ts';
import type { ServiceInstanceOf } from '../../types.ts';
import type { moduleGraphServiceDef } from '../module-graph/definition.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  /**
   * Returns the current story index when the service needs it. Callers should bind this to a
   * pre-resolved generator so each docgen call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Fully composed docgen provider chain produced by
   * `presets.apply('experimental_docgenProvider', ...)`. May return `undefined` when no provider
   * in the chain has docgen for the requested file.
   */
  provider: DocgenProvider;
};

/**
 * Registers the docgen open service against the process-global registry.
 *
 * The `extractDocgen` command does the work: it reads the story index, picks an entry for the
 * requested componentId, hands the entry's `importPath` to the provider chain, and stores the
 * returned payload (if any) into state. The `getDocgen` query's load hook simply invokes that
 * command. `static.inputs` enumerates every distinct componentId for the static-build pass.
 */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  return registerService(docgenServiceDef, {
    queries: {
      getDocgen: {
        load: async (input, ctx) => {
          await ctx.self.commands.extractDocgen(input);
        },
        staticInputs: async () => {
          const index = await options.getIndex();
          const componentIds = new Set<string>();
          for (const entry of Object.values(index.entries)) {
            componentIds.add(getComponentIdFromEntry(entry));
          }
          return Array.from(componentIds, (componentId) => ({ componentId }));
        },
      },
    },
    commands: {
      extractDocgen: {
        handler: async (input, ctx) => {
          const index = await options.getIndex();
          const entry = Object.values(index.entries).find(
            (e) => getComponentIdFromEntry(e) === input.componentId
          );

          if (!entry) {
            throw new OpenServiceDocgenMissingComponentError({ componentId: input.componentId });
          }

          // Provider errors bubble out of the command unchanged; consumers see the underlying
          // failure rather than a generic "missing".
          const payload = await options.provider({ importPath: entry.importPath });

          if (!payload) {
            // No provider produced docgen for this file — leave state untouched and signal
            // "nothing here" to the caller.
            return undefined;
          }

          ctx.self.setState((state) => {
            state.components[input.componentId] = payload;
          });
          return payload;
        },
      },
      handleSourceChange: {
        handler: async (input, ctx) => {
          // Re-extract only components that are already in state ("present"). Absent components are
          // left untouched so the next read's `load` extracts them lazily. We never null out an
          // entry: `extractDocgen` overwrites in place (or no-ops when the provider yields nothing),
          // so a current reader never flashes empty and a future reader sees fresh data.
          for (const componentId of input.componentIds) {
            if (ctx.self.state.components[componentId] === undefined) {
              continue;
            }

            try {
              await ctx.self.commands.extractDocgen({ componentId });
            } catch (error) {
              // Keep the last-good payload rather than blanking it — e.g. when a file is mid-edit
              // and the provider throws on a transient syntax error.
              logger.warn(
                `core/docgen: failed to re-extract docgen for "${componentId}" after a source change; keeping last-known value. ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }

          return undefined;
        },
      },
    },
  });
}

/**
 * Connects `core/docgen` to `core/module-graph` so docgen re-extracts when source files change.
 *
 * This is the open-service-native link between the two services: docgen subscribes to the module
 * graph's latest invalidation and re-extracts the affected components (re-extract-if-present, via
 * `handleSourceChange`). Because the module graph bumps a monotonic `revision` on every change, two
 * consecutive changes that affect the same components still emit distinct values, so value-dedup on
 * the subscription never swallows a repeat change.
 *
 * Note: this is an explicit subscription rather than a pure reactive read because re-extraction is
 * async/side-effecting and the open-service runtime fires a query's `load` only once (it does not
 * re-run `load` when a tracked dependency changes). A future "reactive load" runtime primitive
 * would let `getDocgen` depend on the revision directly and drop this wiring entirely.
 *
 * Returns an unsubscribe function; the caller (the `services` preset) keeps the subscription alive
 * for the lifetime of the process.
 */
export function connectDocgenToModuleGraph(
  docgen: ServiceInstanceOf<typeof docgenServiceDef>,
  moduleGraph: ServiceInstanceOf<typeof moduleGraphServiceDef>
): () => void {
  return moduleGraph.queries.getLastAffected.subscribe({}, (affected) => {
    if (affected.componentIds.length === 0) {
      return;
    }
    void docgen.commands.handleSourceChange({ componentIds: affected.componentIds });
  });
}
