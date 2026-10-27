import { getStoryImportPathFromEntry } from '../../../../common/utils/select-component-entry.ts';
import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import {
  type ExtractionInput,
  registerExtractionService,
  subscribeExtractionServiceToModuleGraphChanges,
  toExtractionError,
} from '../extraction-service.server.ts';
import { storyDocsServiceDef } from './definition.ts';
import { prependImportToSnippet } from './snippet.ts';
import type { StoryDoc, StoryDocsPayload, StoryDocsProvider } from './types.ts';

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

type FileResult = PromiseSettledResult<StoryDocsPayload | undefined>;

function storyDocFromFile(entry: IndexEntry, result: FileResult): StoryDoc | undefined {
  if (result.status === 'rejected') {
    return { id: entry.id, name: entry.name, error: toExtractionError(result.reason) };
  }
  const story = result.value?.stories[entry.id];
  if (story?.snippet === undefined) {
    return story;
  }
  return { ...story, snippet: prependImportToSnippet(result.value?.import, story.snippet) };
}

// CSF files that share a title share a component id, but `entry` stands for only one of them.
function withStoriesFromEveryFile(provider: StoryDocsProvider) {
  return async ({ entry, storyEntries }: ExtractionInput) => {
    const fileEntries = [
      ...new Map(storyEntries.map((storyEntry) => [storyEntry.importPath, storyEntry])).values(),
    ];
    if (fileEntries.length < 2) {
      return provider({ entry });
    }

    const results = await Promise.allSettled(
      fileEntries.map((fileEntry) => provider({ entry: fileEntry }))
    );
    const resultByFile = Object.fromEntries(
      fileEntries.map((fileEntry, index) => [fileEntry.importPath, results[index]])
    );

    const selected = resultByFile[entry.importPath];
    if (selected.status === 'rejected') {
      throw selected.reason;
    }
    if (!selected.value) {
      return undefined;
    }

    // `import` describes one file, so each snippet carries the import block of its own file instead.
    const { import: _import, ...component } = selected.value;
    return {
      ...component,
      stories: Object.fromEntries(
        storyEntries.flatMap((storyEntry) => {
          const story = storyDocFromFile(storyEntry, resultByFile[storyEntry.importPath]);
          return story ? [[storyEntry.id, story]] : [];
        })
      ),
    };
  };
}

/** Registers the `core/story-docs` open service against the process-global registry. */
export function registerStoryDocsService(options: RegisterStoryDocsServiceOptions) {
  return registerExtractionService(storyDocsServiceDef, {
    getIndex: options.getIndex,
    provider: withStoriesFromEveryFile(options.storyDocsProvider),
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
