import type { ChannelLike } from 'storybook/internal/channels';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';

import invariant from 'tiny-invariant';

import { getComponentIdFromEntry } from '../../../common/utils/component-id.ts';
import {
  getStoryImportPathFromEntry,
  isEligibleStoryEntry,
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
  ServiceInstance,
  ServiceRegistrationOptions,
} from '../types.ts';
import { fromComponentStateKey, toComponentStateKey } from './component-state-key.ts';
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

type AllComponentsQuery = { get(): unknown };

// Per registered service: the ids to extract again until an extraction of them completes. They were
// missing from the index (a reverted rename or `git stash pop` brings them back) or their stories
// changed, so a failed refresh is retried on the next index change.
const pendingIdsByService = new WeakMap<object, Set<string>>();

// Extractions still running, by registered service and component id. A call joins the one running
// for its component in the same runtime, so a manager and a preview that load it at once extract it
// once. A refresh never joins, so it reads the files as they are now.
type RunningExtraction = { state: object; extraction: Promise<unknown> };
const runningExtractions = new WeakMap<object, Map<string, RunningExtraction>>();

export type ExtractionInput = {
  /** The entry {@link selectComponentEntriesByComponentId} picks for the component. */
  entry: IndexEntry;
  /** Every story of the component, which spans several CSF files when they share a title. */
  storyEntries: IndexEntry[];
};

type ExtractionProvider<TPayload> = (input: ExtractionInput) => Promise<TPayload | undefined>;

/** The `{ name, message }` shape both extraction payloads carry under `error`. */
export type ExtractionError = { name: string; message: string };

export const toExtractionError = (error: unknown): ExtractionError =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'Error', message: String(error) };

export type RegisterExtractionServiceOptions<TPayload, TQueries, TCommands> = {
  getIndex: () => Promise<StoryIndex>;
  provider: ExtractionProvider<TPayload>;
  /**
   * Builds the payload stored for a component whose provider threw during the fan-out.
   *
   * Supplied per service because the payload shapes differ and both are validated against their
   * service's output schema.
   */
  buildErrorPayload: (input: { id: string; entry: IndexEntry; error: ExtractionError }) => TPayload;
  /** Query whose `staticInputs` enumerate the eligible component ids. */
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
 * already-extracted component; when populated we refresh only those with a story file among the
 * bumped files.
 *
 * When the story index is invalidated, a stored component that left the index (renamed title,
 * deleted file) is extracted again, which removes its payload. So is one whose stories changed, and
 * one that came back. The module-graph change can arrive before the index is invalidated, so only the
 * invalidation reads an index that already holds the change.
 */
export function subscribeExtractionServiceToModuleGraphChanges<
  TState extends ExtractionServiceState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  options: {
    channel: ChannelLike;
    workingDir: string;
    getIndex: () => Promise<StoryIndex>;
    /** Query whose `.get({ id })` tells whether a component is already extracted. */
    queryName: keyof TQueries & string;
    allQueryName: keyof TQueries & string;
    extractCommand: keyof TCommands & string;
  }
) {
  const runtime = getService<ServiceInstance<TState, TQueries, TCommands>>(definition.id, {
    internal: true,
  });
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  const query: ComponentPayloadQuery = runtime.queries[options.queryName];
  const allQuery: AllComponentsQuery = runtime.queries[options.allQueryName];
  const pendingIds = pendingIdsByService.get(runtime);
  invariant(pendingIds, `Extraction service "${definition.id}" is not registered.`);
  const extract = (runtime.commands as Record<string, (input: { id: string }) => Promise<unknown>>)[
    options.extractCommand
  ];
  const refreshComponent = (id: string) => {
    runningExtractions.get(runtime)?.delete(id);
    return extract({ id }).catch(() => undefined);
  };

  const refreshExtracted = async (componentIds: Iterable<string>) => {
    // An extraction still running read the files before the change, so it is refreshed too.
    const running = runningExtractions.get(runtime);
    const idsToRefresh = Array.from(componentIds).filter(
      (id) => query.get({ id }) !== undefined || running?.has(id)
    );
    if (idsToRefresh.length === 0) {
      return;
    }
    await Promise.all(idsToRefresh.map(refreshComponent));
  };

  moduleGraph.queries.latestStoryChanges.subscribe(undefined, async ({ data }) => {
    if (!data || data.revision === 0) {
      return;
    }

    // An unindexable story (e.g. a syntax error mid-edit) must not become an unhandled rejection.
    const index = await options.getIndex().catch(() => undefined);
    if (!index) {
      return;
    }

    const changedStoryFiles = new Set(data.storyFiles);
    const entries = Object.values(index.entries);
    const affectedEntries =
      changedStoryFiles.size === 0
        ? entries
        : entries.filter((entry) => {
            const storyFilePath = getStoryImportPathFromEntry(entry);
            return (
              storyFilePath &&
              changedStoryFiles.has(toStoryIndexPath(storyFilePath, options.workingDir))
            );
          });

    await refreshExtracted(new Set(affectedEntries.map(getComponentIdFromEntry)));
  });

  // The story ids of each component at the last sweep, so a component whose stories changed (a
  // renamed title in one of its files) is extracted again.
  let previousStoryIds: Map<string, string> | undefined;
  void options.getIndex().then(
    (index) => {
      previousStoryIds ??= getStoryIdsByComponent(index);
    },
    () => undefined
  );

  options.channel.on(STORY_INDEX_INVALIDATED, async () => {
    const index = await options.getIndex().catch(() => undefined);
    if (!index) {
      return;
    }

    const storyIds = getStoryIdsByComponent(index);
    const storedIds = new Set(
      Object.keys(allQuery.get() as Record<string, unknown>).map(fromComponentStateKey)
    );
    for (const id of storedIds) {
      if (
        !storyIds.has(id) ||
        (previousStoryIds !== undefined && previousStoryIds.get(id) !== storyIds.get(id))
      ) {
        pendingIds.add(id);
      }
    }
    previousStoryIds = storyIds;

    await Promise.all(
      [...pendingIds].filter((id) => storyIds.has(id) || storedIds.has(id)).map(refreshComponent)
    );
  });
}

// The entry each component is extracted from and its story ids, keyed by component id.
const getStoryIdsByComponent = (index: StoryIndex): Map<string, string> => {
  const entries = Object.values(index.entries);
  const storyEntries = Map.groupBy(entries.filter(isEligibleStoryEntry), getComponentIdFromEntry);
  return new Map(
    Array.from(selectComponentEntriesByComponentId(entries), ([id, entry]) => [
      id,
      [entry, ...(storyEntries.get(id) ?? [])].map((story) => story.id).join('\n'),
    ])
  );
};

/**
 * Registers one component-id-keyed extraction service (`core/docgen` or `core/story-docs`).
 *
 * Both services share the same wiring: a `staticInputs` enumeration over the eligible component
 * entries, an `extract` command that runs the provider chain and stores the payload,
 * and an `extractAll` command that fans out over the index. The per-component pick and the
 * `staticInputs` enumeration both use {@link selectComponentEntriesByComponentId} so a component id
 * always resolves to the same index entry.
 */
export function registerExtractionService<
  TState extends ExtractionServiceState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  options: RegisterExtractionServiceOptions<TState['components'][string], TQueries, TCommands>
) {
  const { getIndex, provider, buildErrorPayload, queryName, extractCommand, extractAllCommand } =
    options;

  // The registration object below is built with computed keys and cast to `ServiceRegistrationOptions`,
  // which defeats TS's per-key checking. Assert the names exist on the definition so a typo fails here
  // instead of silently registering nothing.
  invariant(
    queryName in definition.queries,
    `Extraction service "${definition.id}" has no query named "${queryName}".`
  );
  invariant(
    extractCommand in definition.commands && extractAllCommand in definition.commands,
    `Extraction service "${definition.id}" is missing command "${extractCommand}" or "${extractAllCommand}".`
  );

  const pendingIds = new Set<string>();
  const running = new Map<string, RunningExtraction>();
  // The latest extraction of each component in each runtime, so an older one that finishes later
  // does not overwrite its payload. The static build runs these handlers on runtimes of its own.
  const latestRunsByState = new WeakMap<object, Map<string, Promise<void>>>();
  const startRun = (ctx: CommandCtx<TState>, id: string) => {
    const runs = latestRunsByState.get(ctx.self.state) ?? new Map<string, Promise<void>>();
    latestRunsByState.set(ctx.self.state, runs);
    const settled = Promise.withResolvers<void>();
    runs.set(id, settled.promise);
    const isLatest = () => runs.get(id) === settled.promise;
    return {
      isLatest,
      // A superseded run settles after the run that replaced it, so whoever awaited it sees the
      // newer payload.
      settle: async () => {
        if (!isLatest()) {
          await runs.get(id);
        }
        settled.resolve();
      },
    };
  };

  const resolveInputs = async (): Promise<Map<string, ExtractionInput>> => {
    const entries = Object.values((await getIndex()).entries);
    const storyEntries = Map.groupBy(entries.filter(isEligibleStoryEntry), getComponentIdFromEntry);
    return new Map(
      Array.from(selectComponentEntriesByComponentId(entries), ([id, entry]) => [
        id,
        { entry, storyEntries: storyEntries.get(id) ?? [] },
      ])
    );
  };

  const writePayload = (
    state: TState,
    id: string,
    payload: TState['components'][string] | undefined
  ): void => {
    const key = toComponentStateKey(id);
    if (payload) {
      state.components[key] = payload;
    } else {
      delete state.components[key];
    }
  };

  const extractComponent = async (
    id: string,
    ctx: CommandCtx<TState>,
    isLatestRun: () => boolean
  ) => {
    const extractionInput = (await resolveInputs()).get(id);
    if (!extractionInput) {
      if (isLatestRun()) {
        pendingIds.add(id);
        ctx.self.setState((state) => writePayload(state, id, undefined));
      }
      throw new OpenServiceDocgenMissingComponentError({ id });
    }
    const payload = await provider(extractionInput);
    // The file can be deleted or the title renamed while the provider runs. When the index cannot
    // be read, keep the payload.
    const indexed = await resolveInputs().then(
      (inputs) => inputs.has(id),
      () => true
    );
    if (isLatestRun()) {
      ctx.self.setState((state) => writePayload(state, id, indexed ? payload : undefined));
      if (indexed) {
        pendingIds.delete(id);
      } else {
        pendingIds.add(id);
      }
    }
    if (!indexed) {
      throw new OpenServiceDocgenMissingComponentError({ id });
    }
    return payload;
  };

  // Every component is resolved first and the state written once: one sync entry for the whole
  // extraction instead of one per component.
  const extractAllComponents = async (
    inputs: Map<string, ExtractionInput>,
    ctx: CommandCtx<TState>,
    isLatestRun: (id: string) => boolean
  ) => {
    const results = await Promise.all(
      Array.from(inputs, async ([id, input]) => {
        try {
          return [id, await provider(input)] as const;
        } catch (error) {
          // A provider is not required to be total, so one component's failure must not
          // discard every other component's payload.
          return [
            id,
            buildErrorPayload({ id, entry: input.entry, error: toExtractionError(error) }),
          ] as const;
        }
      })
    );
    // A component that left the index while the providers ran does not get its payload back.
    const current = await resolveInputs().catch(() => inputs);
    const latestResults = results.filter(([id]) => isLatestRun(id));
    for (const [id] of latestResults) {
      if (current.has(id)) {
        pendingIds.delete(id);
      } else {
        pendingIds.add(id);
      }
    }
    ctx.self.setState((state) => {
      for (const [id, payload] of latestResults) {
        writePayload(state, id, current.has(id) ? payload : undefined);
      }
    });
  };

  const service = registerService(definition, {
    queries: {
      [queryName]: {
        staticInputs: async () => {
          const inputs = await resolveInputs();
          return Array.from(inputs.keys(), (id) => ({ id }));
        },
      },
    },
    commands: {
      [extractCommand]: {
        handler: (input: { id: string }, ctx: CommandCtx<TState>) => {
          const joined = running.get(input.id);
          if (joined?.state === ctx.self.state) {
            return joined.extraction;
          }
          const run = startRun(ctx, input.id);
          const extraction = extractComponent(input.id, ctx, run.isLatest).finally(async () => {
            if (running.get(input.id)?.extraction === extraction) {
              running.delete(input.id);
            }
            await run.settle();
          });
          running.set(input.id, { state: ctx.self.state, extraction });
          return extraction;
        },
      },
      [extractAllCommand]: {
        handler: async (_input: undefined, ctx: CommandCtx<TState>) => {
          const inputs = await resolveInputs();
          const runs = new Map(Array.from(inputs.keys(), (id) => [id, startRun(ctx, id)]));
          try {
            await extractAllComponents(inputs, ctx, (id) => runs.get(id)?.isLatest() === true);
          } finally {
            await Promise.all(Array.from(runs.values(), (run) => run.settle()));
          }
        },
      },
    },
  } as unknown as ServiceRegistrationOptions<TState, TQueries, TCommands>);
  // A second registration returns the first instance, whose commands write the first set.
  if (!pendingIdsByService.has(service)) {
    pendingIdsByService.set(service, pendingIds);
    runningExtractions.set(service, running);
  }
  return service;
}
