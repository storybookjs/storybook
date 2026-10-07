import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from '../../../../common/utils/select-component-entry.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { Tag } from '../../../constants/tags.ts';
import {
  registerExtractionService,
  subscribeExtractionServiceToModuleGraphChanges,
} from '../extraction-service.server.ts';
import { docgenServiceDef, type ManifestEntries } from './definition.ts';
import type { DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /** Fully composed docgen provider chain from `presets.apply('experimental_docgenProvider', ...)`. */
  docgenProvider: DocgenProvider;
};

// The `manifest` tag filter and the component selection match core's manifest generator, so the
// docs toolset lists what a manifest would.
export function selectManifestEntries(index: StoryIndex): ManifestEntries {
  const published = Object.values(index.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );

  const attachedDocIds = Map.groupBy(
    published.filter((entry) => entry.type === 'docs' && entry.tags?.includes(Tag.ATTACHED_MDX)),
    getComponentIdFromEntry
  );

  return {
    components: Array.from(selectComponentEntriesByComponentId(published), ([id, entry]) => ({
      id,
      storyBased: entry.type === 'story',
      attachedDocIds: attachedDocIds.get(id)?.map((doc) => doc.id) ?? [],
    })),
    docs: published
      .filter((entry) => entry.type === 'docs' && entry.tags?.includes(Tag.UNATTACHED_MDX))
      .map((entry) => ({ id: entry.id, name: entry.name })),
  };
}

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
    extractCommand: 'extractDocgen',
    extractAllCommand: 'extractAllDocgen',
    commands: {
      resolveManifestEntries: {
        handler: async () => selectManifestEntries(await options.getIndex()),
      },
    },
  });
}

export function subscribeDocgenToModuleGraphChanges(options: {
  getIndex: () => Promise<StoryIndex>;
  workingDir: string;
}) {
  subscribeExtractionServiceToModuleGraphChanges(docgenServiceDef, {
    ...options,
    queryName: 'docgen',
    extractCommand: 'extractDocgen',
  });
}
