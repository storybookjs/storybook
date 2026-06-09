import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from '../../../../common/utils/select-component-entry.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../../server-errors.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { getService, registerService } from '../../server.ts';
import type { moduleGraphServiceDef } from '../module-graph/definition.ts';
import { toStoryIndexPath } from '../module-graph/types.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenPayload, DocgenProvider } from './types.ts';

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

  // Proactively keep already-extracted docgen fresh. The module graph publishes the story files
  // touched by the latest graph change; we react to that list and re-extract docgen for the affected
  // components — even when nobody is actively subscribed to them right now. Without this, an open
  // docgen consumer would keep serving stale output until it happened to re-query.
  const moduleGraph = getService<typeof moduleGraphServiceDef>('core/module-graph');

  moduleGraph.queries.getLatestStoryChanges.subscribe(undefined, async ({ storyFiles }) => {
    if (storyFiles.length === 0) {
      return;
    }

    // Resolve each bumped story file back to the first matching story-index entry. In the usual
    // case the graph bump list is tiny compared with the full story index, so scanning until the
    // first match per bumped file avoids building a complete file -> component map on every update.
    // If a future graph update routinely bumps most stories at once, this can be revisited with a
    // cached index-derived map.
    const index = await options.getIndex();
    const indexEntries = Object.values(index.entries);
    const bumpedComponentIds = new Set<string>();
    for (const storyFile of storyFiles) {
      const componentEntry = Array.from(selectComponentEntriesByComponentId(indexEntries)).find(
        ([, candidate]) => {
          const importPath = getStoryImportPathFromEntry(candidate);
          return !!importPath && toStoryIndexPath(importPath, workingDir) === storyFile;
        }
      );
      if (!componentEntry) {
        continue;
      }
      bumpedComponentIds.add(componentEntry[0]);
    }

    // Only refresh components that already have extracted docgen in service state, so we never
    // eagerly extract docgen nobody has requested yet.
    const componentIdsToRefresh = Array.from(bumpedComponentIds).filter((id) => {
      return runtime.queries.getDocgen({ id }) !== undefined;
    });

    if (componentIdsToRefresh.length === 0) {
      return;
    }

    // Re-extract in parallel. Failures are swallowed per-component so one failing provider run does
    // not prevent the others from refreshing.
    await Promise.all(
      componentIdsToRefresh.map((id) => {
        return runtime.commands.extractDocgen({ id }).catch(() => undefined);
      })
    );
  });

  return runtime;
}
