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
  InferSchemaInput,
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

type AllComponentsQuery = { get(): unknown };

// An extraction still running, with the runtime state it writes to.
type RunningExtraction = { state: object; extraction: Promise<unknown> };

type RegisteredExtraction = {
  idsToExtractAgain: Set<string>;
  // By component id. A call joins the one running in its runtime; a refresh never joins.
  running: Map<string, RunningExtraction>;
  storySignature: (entry: IndexEntry) => string;
  isExtracted: (id: string) => boolean;
};

const registeredExtractions = new WeakMap<object, RegisteredExtraction>();

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

export type RegisterExtractionServiceOptions<
  TState extends ExtractionServiceState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
  TQueryName extends keyof TQueries & string = keyof TQueries & string,
  TPayload = TState['components'][string],
> = {
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
  queryName: TQueryName;
  /** Command that extracts and stores one component's payload. Keyed against the service's commands. */
  extractCommand: keyof TCommands & string;
  /** Command that extracts every component in the story index. Keyed against the service's commands. */
  extractAllCommand: keyof TCommands & string;
  toQueryInput: (id: string) => InferSchemaInput<TQueries[TQueryName]['input']>;
  writeComponent?: (
    state: TState,
    key: string,
    extracted: { payload: TPayload; input: ExtractionInput } | undefined
  ) => void;
  storySignature?: (entry: IndexEntry) => string;
  /** Handlers of the commands the service defines beyond its two extraction commands. */
  commands?: ServiceRegistrationOptions<TState, TQueries, TCommands>['commands'];
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
    allQueryName: keyof TQueries & string;
    extractCommand: keyof TCommands & string;
  }
) {
  const runtime = getService<ServiceInstance<TState, TQueries, TCommands>>(definition.id, {
    internal: true,
  });
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  const allQuery: AllComponentsQuery = runtime.queries[options.allQueryName];
  const registered = registeredExtractions.get(runtime);
  invariant(registered, `Extraction service "${definition.id}" is not registered.`);
  const { idsToExtractAgain, running, storySignature, isExtracted } = registered;
  const extract = (runtime.commands as Record<string, (input: { id: string }) => Promise<unknown>>)[
    options.extractCommand
  ];
  const refreshComponent = (id: string) => {
    running.delete(id);
    return extract({ id }).catch(() => undefined);
  };

  const refreshExtracted = async (componentIds: Iterable<string>) => {
    // An extraction still running read the files before the change, so it is refreshed too.
    const idsToRefresh = Array.from(componentIds).filter(
      (id) => isExtracted(id) || running.has(id)
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

  // The story signatures of each component at the last sweep, so a component whose stories changed (a
  // renamed title in one of its files) is extracted again.
  let previousSignatures: Map<string, string> | undefined;
  void options.getIndex().then(
    (index) => {
      previousSignatures ??= getStorySignatureByComponent(index, storySignature);
    },
    () => undefined
  );

  options.channel.on(STORY_INDEX_INVALIDATED, async () => {
    const index = await options.getIndex().catch(() => undefined);
    if (!index) {
      return;
    }

    const signatures = getStorySignatureByComponent(index, storySignature);
    const storedIds = new Set(
      Object.keys(allQuery.get() as Record<string, unknown>).map(fromComponentStateKey)
    );
    for (const id of storedIds) {
      if (
        !signatures.has(id) ||
        (previousSignatures !== undefined && previousSignatures.get(id) !== signatures.get(id))
      ) {
        idsToExtractAgain.add(id);
      }
    }
    previousSignatures = signatures;

    await Promise.all(
      [...idsToExtractAgain]
        .filter((id) => signatures.has(id) || storedIds.has(id))
        .map(refreshComponent)
    );
  });
}

const getStorySignatureByComponent = (
  index: StoryIndex,
  storySignature: (entry: IndexEntry) => string
): Map<string, string> => {
  const entries = Object.values(index.entries);
  const storyEntries = Map.groupBy(entries.filter(isEligibleStoryEntry), getComponentIdFromEntry);
  return new Map(
    Array.from(selectComponentEntriesByComponentId(entries), ([id, entry]) => [
      id,
      [entry, ...(storyEntries.get(id) ?? [])].map(storySignature).join('\n'),
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
  TQueryName extends keyof TQueries & string,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  options: RegisterExtractionServiceOptions<TState, TQueries, TCommands, TQueryName>
) {
  const {
    getIndex,
    provider,
    buildErrorPayload,
    queryName,
    extractCommand,
    extractAllCommand,
    toQueryInput,
    writeComponent = (state, key, extracted) => {
      if (extracted) {
        state.components[key] = extracted.payload;
      } else {
        delete state.components[key];
      }
    },
    storySignature = (entry: IndexEntry) => entry.id,
  } = options;

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

  const idsToExtractAgain = new Set<string>();
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
    extracted: { payload: TState['components'][string]; input: ExtractionInput } | undefined
  ): void => {
    writeComponent(state, toComponentStateKey(id), extracted);
  };

  const extractComponent = async (
    id: string,
    ctx: CommandCtx<TState>,
    isLatestRun: () => boolean
  ) => {
    const extractionInput = (await resolveInputs()).get(id);
    if (!extractionInput) {
      if (isLatestRun()) {
        idsToExtractAgain.add(id);
        ctx.self.setState((state) => writePayload(state, id, undefined));
      }
      throw new OpenServiceDocgenMissingComponentError({ id });
    }
    const payload = await provider(extractionInput);
    // The file can be deleted or the title renamed while the provider runs. When the index cannot
    // be read, keep the payload.
    const latestInput = await resolveInputs().then(
      (inputs) => inputs.get(id),
      () => extractionInput
    );
    const indexed = latestInput !== undefined;
    if (isLatestRun()) {
      ctx.self.setState((state) =>
        writePayload(state, id, payload && latestInput && { payload, input: latestInput })
      );
      if (indexed) {
        idsToExtractAgain.delete(id);
      } else {
        idsToExtractAgain.add(id);
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
        idsToExtractAgain.delete(id);
      } else {
        idsToExtractAgain.add(id);
      }
    }
    ctx.self.setState((state) => {
      for (const [id, payload] of latestResults) {
        const input = current.get(id);
        writePayload(state, id, payload && input && { payload, input });
      }
    });
  };

  const service = registerService(definition, {
    queries: {
      [queryName]: {
        staticInputs: async () => {
          const inputs = await resolveInputs();
          return Array.from(inputs.keys(), toQueryInput);
        },
      },
    },
    commands: {
      ...options.commands,
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
  if (!registeredExtractions.has(service)) {
    const componentQuery = (service.queries as Record<string, { get(input: unknown): unknown }>)[
      queryName
    ];
    registeredExtractions.set(service, {
      idsToExtractAgain,
      running,
      storySignature,
      isExtracted: (id) => componentQuery.get(toQueryInput(id)) !== undefined,
    });
  }
  return service;
}
