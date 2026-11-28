import type { ChannelLike } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';
import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from '../../../../common/utils/select-component-entry.ts';
import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import {
  registerExtractionService,
  subscribeExtractionServiceToModuleGraphChanges,
} from '../extraction-service.server.ts';
import { readComponent } from '../component-state-key.ts';
import { docgenServiceDef } from './definition.ts';
import type { ComponentSummary, DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /** Fully composed docgen provider chain from `presets.apply('experimental_docgenProvider', ...)`. */
  docgenProvider: DocgenProvider;
  /**
   * Summarizes the component of each entry through the summary providers of the chain. Resolves to
   * `undefined` when a provider has none, so that docgen has to be extracted for the summaries.
   */
  summarize?: (entries: IndexEntry[]) => Promise<ComponentSummary[] | undefined>;
};

/** Registers the `core/docgen` open service against the process-global registry. */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  return registerExtractionService(docgenServiceDef, {
    getIndex: options.getIndex,
    provider: ({ entry }) => options.docgenProvider({ entry }),
    buildErrorPayload: ({ id, entry, error }) => ({
      id,
      name: entry.title,
      path: getStoryImportPathFromEntry(entry) ?? entry.importPath,
      jsDocTags: {},
      error,
    }),
    queryName: 'docgen',
    toQueryInput: (id) => ({ id }),
    extractCommand: 'extractDocgen',
    extractAllCommand: 'extractAllDocgen',
    commands: {
      summarizeComponents: {
        handler: async (_input, ctx) => {
          const entries = selectComponentEntriesByComponentId(
            Object.values((await options.getIndex()).entries)
          );
          // A worker that cannot summarize must not cost the listing: extraction reports a
          // failing component in its payload.
          const summaries = await options.summarize?.([...entries.values()]).catch((error) => {
            logger.debug(`Summarizing components failed, so their docgen is extracted: ${error}`);
            return undefined;
          });
          if (summaries) {
            return summaries;
          }
          const allDocgen = await ctx.self.queries.docgenForAllComponents.loaded();
          return Array.from(entries.keys(), (id) => {
            const { name = id, description, summary } = readComponent(allDocgen, id) ?? {};
            return {
              id,
              name,
              ...(description !== undefined ? { description } : {}),
              ...(summary !== undefined ? { summary } : {}),
            };
          });
        },
      },
    },
  });
}

export function subscribeDocgenToModuleGraphChanges(options: {
  channel: ChannelLike;
  getIndex: () => Promise<StoryIndex>;
  workingDir: string;
}) {
  subscribeExtractionServiceToModuleGraphChanges(docgenServiceDef, {
    ...options,
    allQueryName: 'docgenForAllComponents',
    extractCommand: 'extractDocgen',
  });
}
