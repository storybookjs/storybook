import { getStoryImportPathFromEntry } from '../../../../common/utils/select-component-entry.ts';
import type { IndexEntry, StoryIndex } from '../../../../types/modules/indexer.ts';
import {
  type ExtractionInput,
  registerExtractionService,
  subscribeExtractionServiceToModuleGraphChanges,
  toExtractionError,
} from '../extraction-service.server.ts';
import { type StoryDocsServiceState, storyDocsServiceDef } from './definition.ts';
import {
  isSnippetTemplate,
  prependToTemplate,
  stripHoles,
} from '../../../../docs-tools/snippetTemplate.ts';
import { importPrefix } from './snippet.ts';
import type {
  ProvidedStoryDoc,
  ProvidedStoryDocsPayload,
  StoryDocsPayload,
  StoryDocsProvider,
  StoryTemplatesPayload,
} from './types.ts';

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

type FileResult = PromiseSettledResult<ProvidedStoryDocsPayload | undefined>;

// A template the preview can fill: it has a template's shape, and it prints the snippet while no arg
// changes.
function withFillableTemplate(story: ProvidedStoryDoc): ProvidedStoryDoc {
  const { template, ...doc } = story;
  if (
    template === undefined ||
    (story.snippet !== undefined &&
      isSnippetTemplate(template) &&
      stripHoles(template) === story.snippet)
  ) {
    return story;
  }
  return doc;
}

const withFillableTemplates = (payload: ProvidedStoryDocsPayload | undefined) =>
  payload && {
    ...payload,
    stories: Object.fromEntries(
      Object.entries(payload.stories).map(([id, story]) => [id, withFillableTemplate(story)])
    ),
  };

function storyDocFromFile(entry: IndexEntry, result: FileResult): ProvidedStoryDoc | undefined {
  if (result.status === 'rejected') {
    return { id: entry.id, name: entry.name, error: toExtractionError(result.reason) };
  }
  const story = result.value?.stories[entry.id];
  if (story?.snippet === undefined) {
    return story;
  }
  const prefix = importPrefix(result.value?.import);
  return {
    ...story,
    snippet: prefix + story.snippet,
    ...(story.template !== undefined && { template: prependToTemplate(prefix, story.template) }),
  };
}

// CSF files that share a title share a component id, but `entry` stands for only one of them.
function withStoriesFromEveryFile(provider: StoryDocsProvider) {
  return async ({ entry, storyEntries }: ExtractionInput) => {
    const fileEntries = [
      ...new Map(storyEntries.map((storyEntry) => [storyEntry.importPath, storyEntry])).values(),
    ];
    if (fileEntries.length < 2) {
      return withFillableTemplates(await provider({ entry }));
    }

    const results = await Promise.allSettled(
      fileEntries.map(async (fileEntry) =>
        withFillableTemplates(await provider({ entry: fileEntry }))
      )
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

// Stores a payload's story docs under `components` and their templates apart, under `templates`, so
// agents and the components manifest read the story docs without them.
function writeStoryDocs(
  state: StoryDocsServiceState,
  id: string,
  payload: ProvidedStoryDocsPayload | undefined
) {
  if (!payload) {
    delete state.components[id];
    delete state.templates[id];
    return;
  }
  const stories: StoryDocsPayload['stories'] = {};
  const templates: StoryTemplatesPayload['stories'] = {};
  for (const [storyId, { template, ...story }] of Object.entries(payload.stories)) {
    stories[storyId] = story;
    if (template !== undefined) {
      templates[storyId] = template;
    }
  }
  state.components[id] = { ...payload, stories };
  // Stored even when empty, so the preview can tell a component without templates from one whose
  // templates did not load.
  state.templates[id] = {
    ...(payload.import !== undefined && { import: payload.import }),
    stories: templates,
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
    writePayload: writeStoryDocs,
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
