import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../../server-errors.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { getService, registerService } from '../../service-registration.ts';
import { moduleGraphServiceDef } from '../module-graph/definition.ts';
import { toStoryIndexPath } from '../module-graph/types.ts';
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
 * requested componentId, hands the entry's `importPath` to the provider chain, and stores the
 * returned payload (if any) into state. The `getDocgen` query's load hook simply invokes that
 * command. `static.inputs` enumerates every distinct componentId for the static-build pass.
 *
 * Requires the `core/module-graph` service to be registered (it always is in the dev server); we
 * subscribe to it to keep already-extracted docgen fresh when source files change.
 */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  const workingDir = options.workingDir ?? process.cwd();

  const runtime = registerService(docgenServiceDef, {
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
    },
  });

  // Proactively keep already-extracted docgen fresh. The module graph bumps a story file's version
  // whenever that story or any module in its dependency graph changes; we react to those bumps and
  // re-extract docgen for the affected components — even when nobody is actively subscribed to them
  // right now. Without this, an open docgen consumer would keep serving stale output until it
  // happened to re-query.
  const moduleGraph = getService<typeof moduleGraphServiceDef>('core/module-graph');

  // Snapshot of the versions we last reacted to, so each tick we can diff and act only on the story
  // files whose version actually increased.
  let previousStoryVersions: Record<string, number> = {};

  moduleGraph.queries.getAllStoryVersions.subscribe(undefined, async (versions) => {
    // Find story files whose version increased since the previous tick.
    const bumpedStoryFiles: string[] = [];
    for (const [storyFile, version] of Object.entries(versions)) {
      if ((previousStoryVersions[storyFile] ?? 0) < version) {
        bumpedStoryFiles.push(storyFile);
      }
    }
    previousStoryVersions = { ...versions };

    if (bumpedStoryFiles.length === 0) {
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
    for (const storyFile of bumpedStoryFiles) {
      const entry = indexEntries.find((candidate) => {
        return (
          candidate.type === 'story' &&
          !candidate.importPath.startsWith('virtual:') &&
          toStoryIndexPath(candidate.importPath, workingDir) === storyFile
        );
      });
      if (!entry) {
        continue;
      }
      bumpedComponentIds.add(getComponentIdFromEntry(entry));
    }

    // Only refresh components that already have extracted docgen in service state, so we never
    // eagerly extract docgen nobody has requested yet.
    const componentIdsToRefresh = Array.from(bumpedComponentIds).filter((componentId) => {
      return runtime.queries.getDocgen({ componentId }) !== undefined;
    });

    if (componentIdsToRefresh.length === 0) {
      return;
    }

    // Re-extract in parallel. Failures are swallowed per-component so one failing provider run does
    // not prevent the others from refreshing.
    await Promise.all(
      componentIdsToRefresh.map((componentId) => {
        return runtime.commands.extractDocgen({ componentId }).catch(() => undefined);
      })
    );
  });

  return runtime;
}
