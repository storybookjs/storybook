import invariant from 'tiny-invariant';

import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from '../../../common/utils/select-component-entry.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../server-errors.ts';
import type { IndexEntry, StoryIndex } from '../../../types/modules/indexer.ts';
import { getService, registerService } from '../server.ts';
import type {
  CommandCtx,
  Commands,
  Queries,
  ServiceDefinition,
  ServiceRegistrationOptions,
} from '../types.ts';
import type { ModuleGraphService } from './module-graph/definition.ts';
import { toStoryIndexPath } from './module-graph/types.ts';

/** Extraction services key provider-extracted payloads by component id under `components`. */
type ExtractionServiceState = { components: Record<string, unknown> };

/**
 * The component-keyed query whose synchronous `.get({ id })` reports whether a payload is currently
 * stored: it returns the payload, or `undefined` when nothing has been extracted for that id. `.get()`
 * never fires the query's `load`, so reading it cannot trigger a behind-the-scenes extraction.
 */
type ComponentPayloadQuery = { get(input: { id: string }): unknown };

type ExtractionProvider<TPayload> = (input: { entry: IndexEntry }) => Promise<TPayload | undefined>;

export type RegisterExtractionServiceOptions<TPayload, TQueries, TCommands> = {
  workingDir: string;
  getIndex: () => Promise<StoryIndex>;
  provider: ExtractionProvider<TPayload>;
  /**
   * Query whose `staticInputs` enumerate the eligible component ids, and whose `.get({ id })` the
   * hot-refresh subscription reads to decide which components are already extracted. Typed as a key
   * of the service's queries so the runtime query handle resolves without a cast.
   */
  queryName: keyof TQueries & string;
  /** Command that extracts and stores one component's payload. Keyed against the service's commands. */
  extractCommand: keyof TCommands & string;
  /** Command that extracts every component in the story index. Keyed against the service's commands. */
  extractAllCommand: keyof TCommands & string;
};

/**
 * Re-extracts already-cached components when the module graph reports story file changes.
 *
 * `latestStoryChanges` reports `{ revision, storyFiles }`. The revision is the authoritative
 * "something changed" trigger; `storyFiles` is an optimization hint that is sometimes legitimately
 * empty (e.g. after a story-index invalidation). When the hint is empty we refresh every
 * already-extracted component; when populated we refresh only those mapped from the bumped files.
 */
function subscribeExtractionServiceRefresh(
  moduleGraph: ModuleGraphService,
  options: {
    workingDir: string;
    getIndex: () => Promise<StoryIndex>;
    query: ComponentPayloadQuery;
    refreshComponent: (componentId: string) => Promise<unknown>;
  }
) {
  const refreshExtracted = async (componentIds: Iterable<string>) => {
    const idsToRefresh = Array.from(componentIds).filter(
      (id) => options.query.get({ id }) !== undefined
    );
    if (idsToRefresh.length === 0) {
      return;
    }
    await Promise.all(
      idsToRefresh.map((id) => options.refreshComponent(id).catch(() => undefined))
    );
  };

  moduleGraph.queries.latestStoryChanges.subscribe(undefined, async ({ data }) => {
    if (!data || data.revision === 0) {
      return;
    }

    const { storyFiles } = data;

    const componentEntries = selectComponentEntriesByComponentId(
      Object.values((await options.getIndex()).entries)
    );

    if (storyFiles.length === 0) {
      await refreshExtracted(componentEntries.keys());
      return;
    }

    const componentEntryCandidates = Array.from(componentEntries)
      .map(([id, entry]) => {
        const storyFilePath = getStoryImportPathFromEntry(entry);
        if (!storyFilePath) {
          return undefined;
        }
        return {
          id,
          storyIndexPath: toStoryIndexPath(storyFilePath, options.workingDir),
        };
      })
      .filter((candidate) => candidate !== undefined);

    const bumpedComponentIds = new Set<string>();
    for (const storyFile of storyFiles) {
      const componentEntry = componentEntryCandidates.find(
        (candidate) => candidate.storyIndexPath === storyFile
      );
      if (!componentEntry) {
        continue;
      }
      bumpedComponentIds.add(componentEntry.id);
    }

    await refreshExtracted(bumpedComponentIds);
  });
}

/**
 * Registers one component-id-keyed extraction service (`core/docgen` or `core/story-docs`).
 *
 * Both services share the same wiring: a `staticInputs` enumeration over the eligible component
 * entries, an `extract` command that runs the provider chain and stores the payload, an
 * `extractAll` command that fans out over the index, and a module-graph subscription that re-extracts
 * already-extracted components when their source files change. The per-component pick and the
 * `staticInputs` enumeration both use {@link selectComponentEntriesByComponentId} so a component id
 * always resolves to the same index entry.
 *
 * Requires the `core/module-graph` service to be registered (it always is in the dev server).
 */
export function registerExtractionService<
  TState extends ExtractionServiceState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  options: RegisterExtractionServiceOptions<TState['components'][string], TQueries, TCommands>
) {
  const { workingDir, getIndex, provider, queryName, extractCommand, extractAllCommand } = options;

  // The registration object below is built with computed keys and cast to `ServiceRegistrationOptions`,
  // which defeats TS's per-key checking. Assert the names exist on the definition so a typo fails here
  // instead of silently registering nothing (and later calling an `undefined` command in the refresh).
  invariant(
    queryName in definition.queries,
    `Extraction service "${definition.id}" has no query named "${queryName}".`
  );
  invariant(
    extractCommand in definition.commands && extractAllCommand in definition.commands,
    `Extraction service "${definition.id}" is missing command "${extractCommand}" or "${extractAllCommand}".`
  );

  const resolveComponentEntries = async () =>
    selectComponentEntriesByComponentId(Object.values((await getIndex()).entries));

  const extractComponent = async (
    ctx: CommandCtx<TState>,
    id: string
  ): Promise<TState['components'][string] | undefined> => {
    const entry = (await resolveComponentEntries()).get(id);

    if (!entry) {
      throw new OpenServiceDocgenMissingComponentError({ id });
    }

    const payload = await provider({ entry });

    if (!payload) {
      ctx.self.setState((state) => {
        delete state.components[id];
      });
      return undefined;
    }

    ctx.self.setState((state) => {
      state.components[id] = payload;
    });
    return payload;
  };

  const runtime = registerService(definition, {
    queries: {
      [queryName]: {
        staticInputs: async () => {
          const eligible = await resolveComponentEntries();
          return Array.from(eligible.keys(), (id) => ({ id }));
        },
      },
    },
    commands: {
      [extractCommand]: {
        handler: (input: { id: string }, ctx: CommandCtx<TState>) =>
          extractComponent(ctx, input.id),
      },
      [extractAllCommand]: {
        handler: async (_input: undefined, ctx: CommandCtx<TState>) => {
          const ids = Array.from((await resolveComponentEntries()).keys());
          await Promise.all(ids.map((id) => extractComponent(ctx, id)));
        },
      },
    },
  } as unknown as ServiceRegistrationOptions<TState, TQueries, TCommands>);

  const moduleGraph = getService('core/module-graph');
  subscribeExtractionServiceRefresh(moduleGraph, {
    workingDir,
    getIndex,
    query: runtime.queries[queryName],
    refreshComponent: (id) =>
      (runtime.commands as Record<string, (input: { id: string }) => Promise<unknown>>)[
        extractCommand
      ]({ id }),
  });

  return runtime;
}
