import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { registerExtractionService } from '../extraction-service.server.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  workingDir?: string;
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /** Fully composed docgen provider chain from `presets.apply('experimental_docgenProvider', ...)`. */
  docgenProvider: DocgenProvider;
};

/** Registers the `core/docgen` open service against the process-global registry. */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  return registerExtractionService(docgenServiceDef, {
    workingDir: options.workingDir ?? process.cwd(),
    getIndex: options.getIndex,
    provider: options.docgenProvider,
    queryName: 'docgen',
    extractCommand: 'extractDocgen',
    extractAllCommand: 'extractAllDocgen',
  });
}
