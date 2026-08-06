import invariant from 'tiny-invariant';

import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from '../../../common/utils/select-component-entry.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../server-errors.ts';
import type { IndexEntry, StoryIndex } from '../../../types/modules/indexer.ts';
import { logger } from 'storybook/internal/node-logger';
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

type ExtractionProvider<TPayload> = (input: {
  entry: IndexEntry;
  generation?: number;
}) => Promise<TPayload | undefined>;

type FileRefreshInput = {
  files: string[];
  generation: number;
  invalidation: 'files' | 'global';
};

/** The `{ name, message }` shape both extraction payloads carry under `error`. */
export type ExtractionError = { name: string; message: string };

const toExtractionError = (error: unknown): ExtractionError =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'Error', message: String(error) };

export type RegisterExtractionServiceOptions<TPayload, TQueries, TCommands> = {
  workingDir: string;
  getIndex: () => Promise<StoryIndex>;
  provider: ExtractionProvider<TPayload>;
  /**
   * Builds the payload stored for a component whose provider threw during the fan-out.
   *
   * Supplied per service because the payload shapes differ and both are validated against their
   * service's output schema.
   */
  buildErrorPayload: (input: { id: string; entry: IndexEntry; error: ExtractionError }) => TPayload;
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
  /** Optional internal command used by completion-driven providers to refresh cached components. */
  refreshFilesCommand?: keyof TCommands & string;
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
    getTrackedComponentIds: () => Iterable<string>;
    refreshComponent: (componentId: string) => Promise<unknown>;
  }
) {
  const refreshComponents = async (componentIds: Iterable<string>) => {
    await Promise.all(
      Array.from(componentIds, (id) => options.refreshComponent(id).catch(() => undefined))
    );
  };
  const refreshExtracted = async (componentIds: Iterable<string>) => {
    const idsToRefresh = Array.from(componentIds).filter(
      (id) => options.query.get({ id }) !== undefined
    );
    if (idsToRefresh.length === 0) {
      return;
    }
    await refreshComponents(idsToRefresh);
  };

  moduleGraph.queries.latestStoryChanges.subscribe(undefined, async ({ data }) => {
    if (!data || data.revision === 0) {
      return;
    }

    const { storyFiles } = data;

    const componentEntries = selectComponentEntriesByComponentId(
      Object.values((await options.getIndex()).entries)
    );
    const removedComponentIds = Array.from(options.getTrackedComponentIds()).filter(
      (id) => !componentEntries.has(id)
    );
    await refreshComponents(removedComponentIds);

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
 * A service may additionally name a `refreshFilesCommand`. That is the entry point for providers
 * whose data is produced by an external tool: instead of reacting to the module graph as the edit
 * happens, the integration calls it once its own generation has finished, so the refresh reads
 * output that is already on disk. Those calls are serialized and older generations are dropped.
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
  const {
    workingDir,
    getIndex,
    provider,
    buildErrorPayload,
    queryName,
    extractCommand,
    extractAllCommand,
    refreshFilesCommand,
  } = options;

  // The registration object below is built with computed keys and cast to `ServiceRegistrationOptions`,
  // which defeats TS's per-key checking. Assert the names exist on the definition so a typo fails here
  // instead of silently registering nothing (and later calling an `undefined` command in the refresh).
  invariant(
    queryName in definition.queries,
    `Extraction service "${definition.id}" has no query named "${queryName}".`
  );
  if (refreshFilesCommand) {
    invariant(
      refreshFilesCommand in definition.commands,
      `Extraction service "${definition.id}" has no command named "${refreshFilesCommand}".`
    );
  }
  invariant(
    extractCommand in definition.commands && extractAllCommand in definition.commands,
    `Extraction service "${definition.id}" is missing command "${extractCommand}" or "${extractAllCommand}".`
  );

  const resolveComponentEntries = async () =>
    selectComponentEntriesByComponentId(Object.values((await getIndex()).entries));

  type SuccessfulExtraction = { generation: number; operation: number };
  type ExtractionOutcome =
    | { status: 'success'; payload: TState['components'][string] | undefined }
    | { status: 'failure'; error: unknown };
  type ExtractionOperation = SuccessfulExtraction & {
    settlement: Promise<ExtractionOutcome>;
    settle: (outcome: ExtractionOutcome) => void;
  };
  const latestSuccessfulExtraction = new Map<string, SuccessfulExtraction>();
  const latestExtraction = new Map<string, ExtractionOperation>();
  const activeExtractions = new Map<string, Set<ExtractionOperation>>();
  const inFlightExtractions = new Map<string, number>();
  const lastGoodComponentIds = new Set<string>();
  const storedComponentIds = new Set<string>();
  const evictedBeforeOperation = new Map<string, number>();
  let extractionSequence = 0;
  const outranks = (left: SuccessfulExtraction, right: SuccessfulExtraction) =>
    left.generation > right.generation ||
    (left.generation === right.generation && left.operation > right.operation);
  // Completion-driven generations are provider-wide invalidation watermarks. Every later
  // extraction, including components that were not cached when the completion arrived, must carry
  // the watermark so long-lived providers cannot reuse a pre-completion snapshot.
  let latestRefreshGeneration = 0;
  const getTrackedComponentIds = () =>
    new Set([
      ...storedComponentIds,
      ...latestSuccessfulExtraction.keys(),
      ...latestExtraction.keys(),
      ...inFlightExtractions.keys(),
      ...lastGoodComponentIds,
    ]);
  const evictComponents = (
    ctx: CommandCtx<TState>,
    componentIds: Iterable<string>,
    evictionOperation = extractionSequence
  ) => {
    const ids = Array.from(new Set(componentIds)).filter((id) => {
      const latest = latestExtraction.get(id);
      return !latest || latest.operation <= evictionOperation;
    });
    if (ids.length === 0) {
      return;
    }
    ctx.self.setState((state) => {
      for (const id of ids) {
        delete state.components[id];
      }
    });
    for (const id of ids) {
      latestSuccessfulExtraction.delete(id);
      latestExtraction.delete(id);
      lastGoodComponentIds.delete(id);
      storedComponentIds.delete(id);
      evictedBeforeOperation.set(
        id,
        Math.max(evictedBeforeOperation.get(id) ?? 0, evictionOperation)
      );
    }
  };
  const extractComponent = async (
    ctx: CommandCtx<TState>,
    id: string,
    generation?: number,
    storeError = false
  ): Promise<TState['components'][string] | undefined> => {
    const operation = ++extractionSequence;
    const effectiveGeneration = (generation ?? latestRefreshGeneration) || undefined;
    const rank = { generation: effectiveGeneration ?? 0, operation };
    let settle: (outcome: ExtractionOutcome) => void = () => undefined;
    const settlement = new Promise<ExtractionOutcome>((resolvePromise) => {
      settle = resolvePromise;
    });
    const extraction: ExtractionOperation = { ...rank, settlement, settle };
    const activeForComponent = activeExtractions.get(id) ?? new Set<ExtractionOperation>();
    activeForComponent.add(extraction);
    activeExtractions.set(id, activeForComponent);
    const throwIfEvicted = () => {
      const evictionOperation = evictedBeforeOperation.get(id);
      if (evictionOperation !== undefined && operation <= evictionOperation) {
        throw new OpenServiceDocgenMissingComponentError({ id });
      }
    };
    const previousLatest = latestExtraction.get(id);
    if (!previousLatest || outranks(extraction, previousLatest)) {
      latestExtraction.set(id, extraction);
    }
    inFlightExtractions.set(id, (inFlightExtractions.get(id) ?? 0) + 1);
    let entry: IndexEntry | undefined;
    let outcome: ExtractionOutcome;
    try {
      entry = (await resolveComponentEntries()).get(id);

      if (!entry) {
        evictComponents(ctx, [id], operation);
        throw new OpenServiceDocgenMissingComponentError({ id });
      }

      const payload = await provider(
        effectiveGeneration === undefined ? { entry } : { entry, generation: effectiveGeneration }
      );
      outcome = { status: 'success', payload };
    } catch (error) {
      outcome = { status: 'failure', error };
    }

    const evictionOperation = evictedBeforeOperation.get(id);
    if (evictionOperation !== undefined && operation <= evictionOperation) {
      entry = undefined;
      outcome = {
        status: 'failure',
        error: new OpenServiceDocgenMissingComponentError({ id }),
      };
    }

    extraction.settle(outcome);
    try {
      throwIfEvicted();
      const observedDominant = new Set<ExtractionOperation>();
      let dominantFailure: Extract<ExtractionOutcome, { status: 'failure' }> | undefined;
      const nextDominant = () => {
        const latest = latestExtraction.get(id);
        return Array.from(
          new Set([...Array.from(activeExtractions.get(id) ?? []), ...(latest ? [latest] : [])])
        )
          .filter(
            (candidate) =>
              candidate !== extraction &&
              !observedDominant.has(candidate) &&
              outranks(candidate, extraction)
          )
          .sort((left, right) => (outranks(left, right) ? -1 : outranks(right, left) ? 1 : 0))[0];
      };
      let dominant = nextDominant();
      while (dominant) {
        observedDominant.add(dominant);
        const dominantOutcome = await dominant.settlement;
        // Eviction can happen while this operation waits for a newer extraction. Re-check the
        // tombstone before returning or publishing either operation's payload.
        throwIfEvicted();
        if (dominantOutcome.status === 'success') {
          return dominantOutcome.payload;
        }
        dominantFailure ??= dominantOutcome;
        dominant = nextDominant();
      }

      // A stale success may still establish the first last-good value when every newer refresh
      // failed. Looking through every active newer rank first prevents an older caller from
      // returning before an intermediate newer success.
      if (dominantFailure && outcome.status === 'success' && outcome.payload !== undefined) {
        const payload = outcome.payload;
        const latestSuccess = latestSuccessfulExtraction.get(id);
        if (latestSuccess && outranks(latestSuccess, rank)) {
          return ctx.self.state.components[id] as TState['components'][string] | undefined;
        }
        latestSuccessfulExtraction.set(id, rank);
        lastGoodComponentIds.add(id);
        storedComponentIds.add(id);
        evictedBeforeOperation.delete(id);
        ctx.self.setState((state) => {
          state.components[id] = payload;
        });
        return payload;
      }
      if (dominantFailure && outcome.status === 'failure') {
        outcome = dominantFailure;
      }

      if (outcome.status === 'failure') {
        const latestSuccess = latestSuccessfulExtraction.get(id);
        if (latestSuccess && outranks(latestSuccess, rank)) {
          return ctx.self.state.components[id] as TState['components'][string] | undefined;
        }
        // extractAll reports a component-local error only when there is no last-good payload. A
        // transient failure must not replace usable documentation already held by the service.
        if (storeError && entry && !lastGoodComponentIds.has(id)) {
          const payload = buildErrorPayload({ id, entry, error: toExtractionError(outcome.error) });
          ctx.self.setState((state) => {
            state.components[id] = payload;
          });
          storedComponentIds.add(id);
          return payload;
        }
        if (storeError && lastGoodComponentIds.has(id)) {
          return ctx.self.state.components[id] as TState['components'][string] | undefined;
        }
        throw outcome.error;
      }

      const latestSuccess = latestSuccessfulExtraction.get(id);
      if (latestSuccess && outranks(latestSuccess, rank)) {
        return ctx.self.state.components[id] as TState['components'][string] | undefined;
      }
      latestSuccessfulExtraction.set(id, rank);
      if (outcome.payload === undefined) {
        lastGoodComponentIds.delete(id);
        storedComponentIds.delete(id);
        ctx.self.setState((state) => {
          delete state.components[id];
        });
        return undefined;
      }
      lastGoodComponentIds.add(id);
      storedComponentIds.add(id);
      evictedBeforeOperation.delete(id);
      const payload = outcome.payload;
      ctx.self.setState((state) => {
        state.components[id] = payload;
      });
      return payload;
    } finally {
      const active = activeExtractions.get(id);
      active?.delete(extraction);
      if (active?.size === 0) {
        activeExtractions.delete(id);
      }
      const remaining = (inFlightExtractions.get(id) ?? 1) - 1;
      if (remaining > 0) {
        inFlightExtractions.set(id, remaining);
      } else {
        inFlightExtractions.delete(id);
      }
    }
  };

  const moduleGraph = getService('core/module-graph', { internal: true });
  let refreshQueue: Promise<void> = Promise.resolve();
  let reportedFallbackStatus: string | undefined;

  const refreshForFiles = async (input: FileRefreshInput, ctx: CommandCtx<TState>) => {
    await moduleGraph.queries.status.loaded(undefined);
    const status = moduleGraph.queries.status.get(undefined);
    const componentEntries = await resolveComponentEntries();
    const trackedIds = getTrackedComponentIds();
    const removedIds = Array.from(trackedIds).filter((id) => !componentEntries.has(id));
    evictComponents(ctx, removedIds);
    const knownIds = new Set(Array.from(trackedIds).filter((id) => componentEntries.has(id)));
    let componentIds: Set<string>;

    if (input.invalidation === 'global') {
      reportedFallbackStatus = undefined;
      componentIds = knownIds;
    } else if (status.value === 'ready') {
      reportedFallbackStatus = undefined;
      const affectedStoryFiles = new Set(
        moduleGraph.queries.storiesForFiles
          .get({ files: input.files })
          .flatMap((matches) => matches.map(({ storyFile }) => storyFile))
      );
      componentIds = new Set<string>();
      for (const [id, entry] of componentEntries) {
        const storyFilePath = getStoryImportPathFromEntry(entry);
        if (
          knownIds.has(id) &&
          storyFilePath &&
          affectedStoryFiles.has(toStoryIndexPath(storyFilePath, workingDir))
        ) {
          componentIds.add(id);
        }
      }
    } else {
      // One line per status transition: a persistently unavailable graph refreshes on every save.
      if (reportedFallbackStatus !== status.value) {
        reportedFallbackStatus = status.value;
        logger.warn(
          `Extraction refresh for "${definition.id}" is using cached-component fallback because the module graph is ${status.value}.`
        );
      }
      componentIds = knownIds;
    }

    const results = await Promise.allSettled(
      Array.from(componentIds, (id) => extractComponent(ctx, id, input.generation))
    );
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `Failed to refresh ${failures.length} ${definition.id} component(s)`
      );
    }
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
          const componentEntries = await resolveComponentEntries();
          await Promise.all(
            Array.from(componentEntries, ([id]) =>
              // Each provider failure is stored independently so one bad component cannot discard
              // every other component's payload.
              extractComponent(ctx, id, undefined, true)
            )
          );
        },
      },
      ...(refreshFilesCommand
        ? {
            [refreshFilesCommand]: {
              handler: (input: FileRefreshInput, ctx: CommandCtx<TState>) => {
                if (input.generation <= latestRefreshGeneration) {
                  return refreshQueue;
                }
                latestRefreshGeneration = input.generation;
                refreshQueue = refreshQueue
                  .catch(() => undefined)
                  .then(() => refreshForFiles(input, ctx));
                return refreshQueue;
              },
            },
          }
        : {}),
    },
  } as unknown as ServiceRegistrationOptions<TState, TQueries, TCommands>);

  subscribeExtractionServiceRefresh(moduleGraph, {
    workingDir,
    getIndex,
    query: runtime.queries[queryName],
    getTrackedComponentIds,
    refreshComponent: (id) =>
      (runtime.commands as Record<string, (input: { id: string }) => Promise<unknown>>)[
        extractCommand
      ]({ id }),
  });

  return runtime;
}
