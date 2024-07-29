import type { StoryId, ComponentTitle, StoryName, Parameters, Tag, Path } from './csf';

type ExportName = string;
type MetaId = string;

export interface StoriesSpecifier {
  /**
   * When auto-titling, what to prefix all generated titles with (default: '')
   */
  titlePrefix?: string;
  /**
   * Where to start looking for story files
   */
  directory: string;
  /**
   * What does the filename of a story file look like?
   * (a glob, relative to directory, no leading `./`)
   * If unset, we use `** / *.@(mdx|stories.@(mdx|js|jsx|mjs|ts|tsx))` (no spaces)
   */
  files?: string;
}

export type StoriesEntry = string | StoriesSpecifier;

export type NormalizedStoriesSpecifier = Required<StoriesSpecifier> & {
  /*
   * Match the "importPath" of a file (e.g. `./src/button/Button.stories.js')
   * relative to the current working directory.
   */
  importPathMatcher: RegExp;
};

export interface IndexerOptions {
  makeTitle: (userTitle?: string) => string;
}

export interface IndexedStory {
  id: string;
  name: string;
  tags?: Tag[];
  parameters?: Parameters;
}
export interface IndexedCSFFile {
  meta: { id?: string; title?: string; tags?: Tag[] };
  stories: IndexedStory[];
}

/**
 * FIXME: This is a temporary type to allow us to deprecate the old indexer API.
 * We should remove this type and the deprecated indexer API in 8.0.
 */
type BaseIndexer = {
  /**
   * A regular expression that should match all files to be handled by this indexer
   */
  test: RegExp;
};

/**
 * An indexer describes which filenames it handles, and how to index each individual file - turning it into an entry in the index.
 */
export type Indexer = BaseIndexer & {
  /**
   * Indexes a file containing stories or docs.
   * @param fileName The name of the file to index.
   * @param options {@link IndexerOptions} for indexing the file.
   * @returns A promise that resolves to an array of {@link IndexInput} objects.
   */
  createIndex: (fileName: string, options: IndexerOptions) => Promise<IndexInput[]>;
};

export interface BaseIndexEntry {
  id: StoryId;
  name: StoryName;
  title: ComponentTitle;
  tags?: Tag[];
  importPath: Path;
}
export type StoryIndexEntry = BaseIndexEntry & {
  type: 'story';
};

export type DocsIndexEntry = BaseIndexEntry & {
  storiesImports: Path[];
  type: 'docs';
};

export type IndexEntry = StoryIndexEntry | DocsIndexEntry;

export interface IndexInputStats {
  loaders?: boolean;
  play?: boolean;
  render?: boolean;
  storyFn?: boolean;
  mount?: boolean;
  beforeEach?: boolean;
  moduleMock?: boolean;
}

/**
 * The base input for indexing a story or docs entry.
 */
export type BaseIndexInput = {
  /** The file to import from e.g. the story file. */
  importPath: Path;
  /** The raw path/package of the file that provides meta.component, if one exists */
  rawComponentPath?: Path;
  /** The name of the export to import. */
  exportName: ExportName;
  /** The name of the entry, auto-generated from {@link exportName} if unspecified. */
  name?: StoryName;
  /** The location in the sidebar, auto-generated from {@link importPath} if unspecified. */
  title?: ComponentTitle;
  /**
   * The custom id optionally set at `meta.id` if it needs to differ from the id generated via {@link title}.
   * If unspecified, the meta id will be auto-generated from {@link title}.
   * If specified, the meta in the CSF file _must_ have a matching id set at `meta.id`, to be correctly matched.
   */
  metaId?: MetaId;
  /** Tags for filtering entries in Storybook and its tools. */
  tags?: Tag[];
  /**
   * The id of the entry, auto-generated from {@link title}/{@link metaId} and {@link exportName} if unspecified.
   * If specified, the story in the CSF file _must_ have a matching id set at `parameters.__id`, to be correctly matched.
   * Only use this if you need to override the auto-generated id.
   */
  __id?: StoryId;
  /**
   * Stats about language feature usage that the indexer can optionally report
   */
  __stats?: IndexInputStats;
};

/**
 * The input for indexing a story entry.
 */
export type StoryIndexInput = BaseIndexInput & {
  type: 'story';
};

/**
 * The input for indexing a docs entry.
 */
export type DocsIndexInput = BaseIndexInput & {
  type: 'docs';
  /** Paths to story files that must be pre-loaded for this docs entry. */
  storiesImports?: Path[];
};

export type IndexInput = StoryIndexInput | DocsIndexInput;

export interface V3CompatIndexEntry extends Omit<StoryIndexEntry, 'type' | 'tags'> {
  kind: ComponentTitle;
  story: StoryName;
  parameters: Parameters;
}

export interface StoryIndexV2 {
  v: number;
  stories: Record<
    StoryId,
    Omit<V3CompatIndexEntry, 'title' | 'name' | 'importPath'> & {
      name?: StoryName;
    }
  >;
}

export interface StoryIndexV3 {
  v: number;
  stories: Record<StoryId, V3CompatIndexEntry>;
}

export interface StoryIndex {
  v: number;
  entries: Record<StoryId, IndexEntry>;
}
