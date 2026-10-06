import { getStoryImportPathFromEntry } from '../../../../common/utils/select-component-entry.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import {
  registerExtractionService,
  subscribeExtractionServiceToModuleGraphChanges,
} from '../extraction-service.server.ts';
import { storyDocsServiceDef } from './definition.ts';
import type { StoryDocsProvider } from './types.ts';

export type RegisterStoryDocsServiceOptions = {
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Fully composed story-docs provider chain from
   * `presets.apply('experimental_storyDocsProvider', ...)`.
   */
  storyDocsProvider: StoryDocsProvider;
};

/** Registers the `core/story-docs` open service against the process-global registry. */
export function registerStoryDocsService(options: RegisterStoryDocsServiceOptions) {
  return registerExtractionService(storyDocsServiceDef, {
    getIndex: options.getIndex,
    provider: options.storyDocsProvider,
    buildErrorPayload: ({ id, entry, error }) => ({
      id,
      name: entry.title,
      path: getStoryImportPathFromEntry(entry) ?? entry.importPath,
      stories: {},
      error,
    }),
    queryName: 'storyDocs',
    extractCommand: 'extractStoryDocs',
    extractAllCommand: 'extractAllStoryDocs',
  });
}

export function subscribeStoryDocsToModuleGraphChanges(options: {
  getIndex: () => Promise<StoryIndex>;
  workingDir: string;
}) {
  subscribeExtractionServiceToModuleGraphChanges(storyDocsServiceDef, {
    ...options,
    queryName: 'storyDocs',
    extractCommand: 'extractStoryDocs',
  });
}
