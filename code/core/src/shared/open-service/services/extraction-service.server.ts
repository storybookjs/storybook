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

// Extractions still running, by registered service and component id. A call joins the one running
// for its component, so a manager and a preview that load it at once extract it once. A file change
// drops it, so the refresh reads the files as they are now.
const runningExtractions = new WeakMap<object, Map<string, Promise<unknown>>>();

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
 */
export function subscribeExtractionServiceToModuleGraphChanges<
  TState extends ExtractionServiceState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  options: {
    workingDir: string;
    getIndex: () => Promise<StoryIndex>;
    /** Query whose `.get({ id })` tells whether a component is already extracted. */
    queryName: keyof TQueries & string;
    extractCommand: keyof TCommands & string;
  }
) {
  const runtime = getService<ServiceInstance<TState, TQueries, TCommands>>(definition.id, {
    internal: true,
  });
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  const query: ComponentPayloadQuery = runtime.queries[options.queryName];
  const refreshComponent = (id: string) =>
    (runtime.commands as Record<string, (input: { id: string }) => Promise<unknown>>)[
      options.extractCommand
    ]({ id });

  const refreshExtracted = async (componentIds: Iterable<string>) => {
    // An extraction still running read the files before the change, so it is refreshed too.
    const running = runningExtractions.get(runtime);
    const idsToRefresh = Array.from(componentIds).filter(
      (id) => query.get({ id }) !== undefined || running?.has(id)
    );
    if (idsToRefresh.length === 0) {
      return;
    }
    for (const id of idsToRefresh) {
      running?.delete(id);
    }
    await Promise.all(idsToRefresh.map((id) => refreshComponent(id).catch(() => undefined)));
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
}

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

  const resolveInput = async (id: string) => {
    const input = (await resolveInputs()).get(id);

    if (!input) {
      throw new OpenServiceDocgenMissingComponentError({ id });
    }

    return input;
  };

  const writePayload = (
    state: TState,
    id: string,
    payload: TState['components'][string] | undefined
  ): void => {
    if (payload) {
      state.components[id] = payload;
    } else {
      delete state.components[id];
    }
  };

  type Extraction = { payload: TState['components'][string] | undefined; started: number };
  const running = new Map<string, Promise<Extraction>>();
  // By component, when the extraction whose payload is stored started. An extraction a file change
  // replaced can finish after its refresh, and must not overwrite what the refresh stored.
  const storedStart = new Map<string, number>();
  let starts = 0;
  const extract = (id: string) => {
    const joined = running.get(id);
    if (joined) {
      return joined;
    }
    const started = ++starts;
    const extraction: Promise<Extraction> = resolveInput(id)
      .then(provider)
      .then((payload) => ({ payload, started }))
      .finally(() => {
        if (running.get(id) === extraction) {
          running.delete(id);
        }
      });
    running.set(id, extraction);
    return extraction;
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
        handler: async (input: { id: string }, ctx: CommandCtx<TState>) => {
          const { payload, started } = await extract(input.id);
          if (started >= (storedStart.get(input.id) ?? 0)) {
            storedStart.set(input.id, started);
            ctx.self.setState((state) => writePayload(state, input.id, payload));
          }
          return payload;
        },
      },
      [extractAllCommand]: {
        // Every component is resolved first and the state written once: one sync entry for the
        // whole extraction instead of one per component.
        handler: async (_input: undefined, ctx: CommandCtx<TState>) => {
          const inputs = await resolveInputs();
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
          ctx.self.setState((state) => {
            for (const [id, payload] of results) {
              writePayload(state, id, payload);
            }
          });
        },
      },
    },
  } as unknown as ServiceRegistrationOptions<TState, TQueries, TCommands>);
  // A repeated registration returns the first service, whose commands join the first extractions.
  if (!runningExtractions.has(service)) {
    runningExtractions.set(service, running);
  }
  return service;
}
