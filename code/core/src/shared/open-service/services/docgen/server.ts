import { selectComponentEntriesByComponentId } from '../../../../common/utils/select-component-entry.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../../server-errors.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { getService, registerService } from '../../server.ts';
import type { ModuleGraphService } from '../module-graph/definition.ts';
import { subscribeStoryFileChangeRefresh } from '../subscribe-story-file-change-refresh.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  workingDir?: string;
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
 * requested component id, hands the resolved index entry to the provider chain, and stores the
 * returned payload (if any) into state. The `getDocgen` query's load hook simply invokes that
 * command. Both the `static.inputs` enumeration and the per-component pick use
 * {@link selectComponentEntriesByComponentId} — the same selection (and tie-breaking) the React
 * component manifest generator uses — so the two flows always resolve a component id to the same
 * index entry.
 *
 * Requires the `core/module-graph` service to be registered (it always is in the dev server); we
 * subscribe to it to keep already-extracted docgen fresh when source files change.
 */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  const workingDir = options.workingDir ?? process.cwd();
  const extractedComponentIds = new Set<string>();

  const runtime = registerService(docgenServiceDef, {
    queries: {
      getDocgen: {
        staticInputs: async () => {
          const index = await options.getIndex();
          const eligible = selectComponentEntriesByComponentId(Object.values(index.entries));
          return Array.from(eligible.keys(), (id) => ({ id }));
        },
      },
    },
    commands: {
      extractDocgen: {
        handler: async (input, ctx) => {
          const index = await options.getIndex();
          const entry = selectComponentEntriesByComponentId(Object.values(index.entries)).get(
            input.id
          );

          if (!entry) {
            throw new OpenServiceDocgenMissingComponentError({ id: input.id });
          }

          // Provider errors bubble out of the command unchanged; consumers see the underlying
          // failure rather than a generic "missing".
          const payload = await options.provider({ entry });

          if (!payload) {
            // No provider produced docgen for this file — leave state untouched and signal
            // "nothing here" to the caller.
            return undefined;
          }

          ctx.self.setState((state) => {
            state.components[input.id] = payload;
          });
          extractedComponentIds.add(input.id);
          return payload;
        },
      },
      extractAllDocgen: {
        handler: async (_input, ctx) => {
          const index = await options.getIndex();
          const ids = Array.from(
            selectComponentEntriesByComponentId(Object.values(index.entries)).keys()
          );
          await Promise.all(ids.map((id) => ctx.self.commands.extractDocgen({ id })));
        },
      },
    },
  });

  const moduleGraph = getService<ModuleGraphService>('core/module-graph');

  subscribeStoryFileChangeRefresh(moduleGraph, {
    workingDir,
    getIndex: options.getIndex,
    hasExtractedPayload: (id) => extractedComponentIds.has(id),
    refreshComponent: (id) => runtime.commands.extractDocgen({ id }),
  });

  return runtime;
}
