import type { ChannelLike } from 'storybook/internal/channels';
import { getStoryImportPathFromEntry } from '../../../../common/utils/select-component-entry.ts';
import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import {
  registerExtractionService,
  subscribeExtractionServiceToModuleGraphChanges,
} from '../extraction-service.server.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /** Fully composed docgen provider chain from `presets.apply('experimental_docgenProvider', ...)`. */
  docgenProvider: DocgenProvider;
  /** Receives the entry of every component before the service extracts all of them. */
  prepareDocgen?: (entries: IndexEntry[]) => void;
};

/** Registers the `core/docgen` open service against the process-global registry. */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  return registerExtractionService(docgenServiceDef, {
    getIndex: options.getIndex,
    provider: ({ entry }) => options.docgenProvider({ entry }),
    prepare: (inputs) => options.prepareDocgen?.(inputs.map(({ entry }) => entry)),
    buildErrorPayload: ({ id, entry, error }) => ({
      id,
      name: entry.title,
      path: getStoryImportPathFromEntry(entry) ?? entry.importPath,
      jsDocTags: {},
      error,
    }),
    queryName: 'docgen',
    extractCommand: 'extractDocgen',
    extractAllCommand: 'extractAllDocgen',
  });
}

export function subscribeDocgenToModuleGraphChanges(options: {
  channel: ChannelLike;
  getIndex: () => Promise<StoryIndex>;
  workingDir: string;
}) {
  subscribeExtractionServiceToModuleGraphChanges(docgenServiceDef, {
    ...options,
    queryName: 'docgen',
    allQueryName: 'docgenForAllComponents',
    extractCommand: 'extractDocgen',
  });
}
