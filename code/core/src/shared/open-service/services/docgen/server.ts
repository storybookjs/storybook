import {
  getStoryImportPathFromEntry,
  selectComponentEntriesByComponentId,
} from '../../../../common/utils/select-component-entry.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { Tag } from '../../../constants/tags.ts';
import { registerExtractionService } from '../extraction-service.server.ts';
import { docgenServiceDef, type ManifestEntries } from './definition.ts';
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

/**
 * What the index publishes to manifests: the manifest-tagged entries, reduced with the same
 * component selection as extraction so a listed id always resolves to a payload, plus the
 * standalone MDX docs that are not components at all.
 */
export function selectManifestEntries(index: StoryIndex): ManifestEntries {
  const published = Object.values(index.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  return {
    componentIds: [...selectComponentEntriesByComponentId(published).keys()],
    docs: published
      .filter((entry) => entry.type === 'docs' && entry.tags?.includes(Tag.UNATTACHED_MDX))
      .map((entry) => ({ id: entry.id, name: entry.name })),
  };
}

/** Registers the `core/docgen` open service against the process-global registry. */
export function registerDocgenService(options: RegisterDocgenServiceOptions) {
  return registerExtractionService(docgenServiceDef, {
    workingDir: options.workingDir ?? process.cwd(),
    getIndex: options.getIndex,
    provider: options.docgenProvider,
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
      _resolveManifestEntries: {
        handler: async (_input, ctx) => {
          const manifestEntries = selectManifestEntries(await options.getIndex());
          ctx.self.setState((state) => {
            state.manifestEntries = manifestEntries;
          });
        },
      },
    },
  });
}
