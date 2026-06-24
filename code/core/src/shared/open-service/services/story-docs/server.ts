import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { registerExtractionService } from '../extraction-service.server.ts';
import { storyDocsServiceDef } from './definition.ts';
import type { StoryDocsProvider } from './types.ts';

export type RegisterStoryDocsServiceOptions = {
  workingDir?: string;
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
    workingDir: options.workingDir ?? process.cwd(),
    getIndex: options.getIndex,
    provider: options.storyDocsProvider,
    queryName: 'storyDocs',
    extractCommand: 'extractStoryDocs',
    extractAllCommand: 'extractAllStoryDocs',
  });
}
