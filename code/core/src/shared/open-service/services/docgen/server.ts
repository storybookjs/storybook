import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from '../../../../common/utils/select-component-entry.ts';
import { OpenServiceDocgenMissingComponentError } from '../../../../server-errors.ts';
import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import { getService, registerService } from '../../server.ts';
import type {
  CommandCtx,
  Commands,
  Queries,
  ServiceDefinition,
  ServiceRegistrationOptions,
} from '../../types.ts';
import type { ModuleGraphService } from '../module-graph/definition.ts';
import { toStoryIndexPath } from '../module-graph/types.ts';
import { storyDocsServiceDef } from '../story-docs/definition.ts';
import type { StoryDocsProvider } from '../story-docs/types.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenProvider } from './types.ts';

/** Extraction services key provider-extracted payloads by component id under `components`. */
type ExtractionServiceState = { components: Record<string, unknown> };

type ExtractionProvider<TPayload> = (input: { entry: IndexEntry }) => Promise<TPayload | undefined>;

type RegisterExtractionServiceOptions<TPayload> = {
  workingDir: string;
  getIndex: () => Promise<StoryIndex>;
  provider: ExtractionProvider<TPayload>;
  /** Query whose `staticInputs` enumerate the eligible component ids. */
  queryName: string;
  /** Command that extracts and stores one component's payload. */
  extractCommand: string;
  /** Command that extracts every component in the story index. */
  extractAllCommand: string;
};

/**
 * Re-extracts already-cached components when the module graph reports story file changes.
 *
 * `getLatestStoryChanges` reports `{ revision, storyFiles }`. The revision is the authoritative
 * "something changed" trigger; `storyFiles` is an optimization hint that is sometimes legitimately
 * empty (e.g. after a story-index invalidation). When the hint is empty we refresh every
 * already-extracted component; when populated we refresh only those mapped from the bumped files.
 */
function subscribeExtractionServiceRefresh(
  moduleGraph: ModuleGraphService,
  options: {
    workingDir: string;
    getIndex: () => Promise<StoryIndex>;
    hasExtractedPayload: (componentId: string) => boolean;
    refreshComponent: (componentId: string) => Promise<unknown>;
  }
) {
  const refreshExtracted = async (componentIds: Iterable<string>) => {
    const idsToRefresh = Array.from(componentIds).filter((id) => options.hasExtractedPayload(id));
    if (idsToRefresh.length === 0) {
      return;
    }
    await Promise.all(
      idsToRefresh.map((id) => options.refreshComponent(id).catch(() => undefined))
    );
  };

  moduleGraph.queries.getLatestStoryChanges.subscribe(
    undefined,
    async ({ revision, storyFiles }) => {
      if (revision === 0) {
        return;
      }

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
    }
  );
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
function registerExtractionService<
  TState extends ExtractionServiceState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  definition: ServiceDefinition<TState, TQueries, TCommands>,
  options: RegisterExtractionServiceOptions<TState['components'][string]>
) {
  const { workingDir, getIndex, provider, queryName, extractCommand, extractAllCommand } = options;
  const extractedComponentIds = new Set<string>();

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
      return undefined;
    }

    ctx.self.setState((state) => {
      state.components[id] = payload;
    });
    extractedComponentIds.add(id);
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

  const moduleGraph = getService<ModuleGraphService>('core/module-graph');
  subscribeExtractionServiceRefresh(moduleGraph, {
    workingDir,
    getIndex,
    hasExtractedPayload: (id) => extractedComponentIds.has(id),
    refreshComponent: (id) =>
      (runtime.commands as Record<string, (input: { id: string }) => Promise<unknown>>)[
        extractCommand
      ]({ id }),
  });

  return runtime;
}

export type RegisterDocgenServicesOptions = {
  workingDir?: string;
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Fully composed docgen provider chain from `presets.apply('experimental_docgenProvider', ...)`.
   * Omit to skip registering the `core/docgen` service.
   */
  docgenProvider?: DocgenProvider;
  /**
   * Fully composed story-docs provider chain from
   * `presets.apply('experimental_storyDocsProvider', ...)`. Omit to skip registering the
   * `core/story-docs` service.
   */
  storyDocsProvider?: StoryDocsProvider;
};

/**
 * Registers the docgen open services (`core/docgen` and `core/story-docs`) against the process-global
 * registry.
 *
 * `core/docgen` carries component prop docgen; `core/story-docs` carries per-story snippets,
 * descriptions, and file-level imports. Each is registered only when its provider is supplied.
 */
export function registerDocgenServices(options: RegisterDocgenServicesOptions) {
  const workingDir = options.workingDir ?? process.cwd();

  const docgen = options.docgenProvider
    ? registerExtractionService(docgenServiceDef, {
        workingDir,
        getIndex: options.getIndex,
        provider: options.docgenProvider,
        queryName: 'getDocgen',
        extractCommand: 'extractDocgen',
        extractAllCommand: 'extractAllDocgen',
      })
    : undefined;

  const storyDocs = options.storyDocsProvider
    ? registerExtractionService(storyDocsServiceDef, {
        workingDir,
        getIndex: options.getIndex,
        provider: options.storyDocsProvider,
        queryName: 'getStoryDocs',
        extractCommand: 'extractStoryDocs',
        extractAllCommand: 'extractAllStoryDocs',
      })
    : undefined;

  return { docgen, storyDocs };
}
