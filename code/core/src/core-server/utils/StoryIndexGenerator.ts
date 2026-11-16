import { existsSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  commonGlobOptions,
  getProjectRoot,
  getTsconfigPathsBaseDir,
  normalizeStoryPath,
} from 'storybook/internal/common';
import { combineTags, storyNameFromExport, toId } from 'storybook/internal/csf/csf-utils';
import { loadConfig } from 'storybook/internal/csf-tools';
import { logger, once } from 'storybook/internal/node-logger';
import { isExampleStoryId } from 'storybook/internal/telemetry';
import type {
  DocsIndexEntry,
  DocsOptions,
  IndexEntry,
  IndexInputStats,
  Indexer,
  NormalizedStoriesSpecifier,
  Path,
  StoryIndex,
  StoryIndexEntry,
  StoryIndexInput,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import * as find from 'empathic/find';
import picocolors from 'picocolors';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';
import * as TsconfigPaths from 'tsconfig-paths';

import { resolveImport, supportedExtensions } from '../../common/index.ts';
import { anchorBlockIdFromId } from '../../docs-tools/shared.ts';
import { userOrAutoTitleFromSpecifier } from '../../shared/story-index/autoTitle.ts';
import { combineStorySorts, sortStoriesV7 } from '../../shared/story-index/sortStories.ts';
import { Tag } from '../../shared/constants/tags.ts';
import { isMdxEntry } from '../../shared/utils/story-index-filters.ts';
import { StorybookError } from '../../storybook-error.ts';
import { IndexingError, MultipleIndexingError } from './IndexingError.ts';
import { autoName } from './autoName.ts';
import { type MdxAnalysisResult, analyzeMdx } from './analyze-mdx.ts';
import { type IndexStatsSummary, addStats } from './summarizeStats.ts';

// Extended type to keep track of the csf meta id so we know the component id when resolving docs
type StoryIndexEntryWithExtra = StoryIndexEntry & {
  extra: { metaId?: string; stats: IndexInputStats };
};
type StoriesFile = {
  type: 'stories';
  entries: (StoryIndexEntryWithExtra | DocsIndexEntry)[];
};
// Only what the .mdx file itself says: its docs entry also depends on the stories files it imports
type DocsFile = {
  type: 'docs';
  analysis: MdxAnalysisResult;
};
type ErrorEntry = {
  type: 'error';
  err: IndexingError;
};
// `undefined` for a file that adds nothing to the index: an MDX template, or a file that is gone
type Extracted = StoriesFile | DocsFile | ErrorEntry | undefined;
// Replaced on every invalidation, so nothing reads what an earlier extraction resolves to
type Slot = { extracted?: Promise<Extracted> };
type ExtractedFile = {
  specifier: NormalizedStoriesSpecifier;
  absolutePath: Path;
  extracted: Extracted;
};
type MatchingFiles = Record<Path, false>;
type IndexAndStats = { storyIndex: StoryIndex; stats: IndexStatsSummary };

export type StoryIndexGeneratorOptions = {
  workingDir: Path;
  configDir: Path;
  indexers: Indexer[];
  docs: DocsOptions;
  build?: StorybookConfigRaw['build'];
  features?: StorybookConfigRaw['features'];
  storySorts?: StorybookConfigRaw['storySorts'];
};

const makeAbsolute = (otherImport: Path, normalizedPath: Path, workingDir: Path) =>
  otherImport.startsWith('.')
    ? slash(resolve(workingDir, normalizeStoryPath(join(dirname(normalizedPath), otherImport))))
    : otherImport;

type StoriesFilesByImport = Map<Path, { order: number; storiesFile: StoriesFile }[]>;

// An import names a stories file by its path, with or without the last extension
const indexStoriesFilesByImport = (files: ExtractedFile[]): StoriesFilesByImport => {
  const byImport: StoriesFilesByImport = new Map();
  files.forEach(({ absolutePath, extracted }, order) => {
    if (extracted?.type !== 'stories') {
      return;
    }
    const match = { order, storiesFile: extracted };
    new Set([absolutePath, absolutePath.replace(/\.[^.]+$/, '')]).forEach((storyImport) => {
      byImport.set(storyImport, [...(byImport.get(storyImport) ?? []), match]);
    });
  });
  return byImport;
};

/**
 * The StoryIndexGenerator extracts stories and docs entries for each file matching (one or more)
 * stories "specifiers", as defined in main.js.
 *
 * The output is a set of entries (see above for the types).
 *
 * Each file is treated as a stories or a (modern) docs file.
 *
 * A stories file is indexed by an indexer (passed in), which produces a list of stories.
 *
 * - If the stories have the `parameters.docsOnly` setting, they are disregarded.
 * - If the stories have `autodocs` enabled, a docs entry is added pointing to the story file.
 *
 * A (modern) docs (.mdx) file is indexed, a docs entry is added.
 *
 * In the preview, a docs entry with the `autodocs` tag will be rendered as a CSF file that exports
 * an MDX template on the `docs.page` parameter, whereas other docs entries are rendered as MDX
 * files directly.
 *
 * The entries are "uniq"-ed and sorted. Stories entries are preferred to docs entries and MDX docs
 * entries are preferred to CSF templates (with warnings).
 */
export class StoryIndexGenerator {
  private specifierToSlots = new Map<NormalizedStoriesSpecifier, Map<Path, Slot>>();

  /** Cache for findMatchingFiles results */
  private static findMatchingFilesCache = new Map<string, MatchingFiles>();

  // Bumped by every invalidation. An index is only valid for the revision it was built at.
  private revision = 0;

  private settled?: { revision: number } & ({ value: IndexAndStats } | { error: Error });

  // Callers that ask while the index is computed share the computation, so its errors log once
  private pending?: Promise<IndexAndStats>;

  // Settles on the next invalidation, so a computation stops waiting for extractions it no longer needs
  private nextInvalidation = Promise.withResolvers<void>();

  private invalidationListeners: Set<() => void> = new Set();

  constructor(
    public readonly specifiers: NormalizedStoriesSpecifier[],
    public readonly options: StoryIndexGeneratorOptions
  ) {}

  /** Generate a cache key for findMatchingFiles */
  private static getFindMatchingFilesCacheKey(
    specifier: NormalizedStoriesSpecifier,
    workingDir: Path,
    ignoreWarnings: boolean
  ): string {
    return JSON.stringify({
      directory: specifier.directory,
      files: specifier.files,
      workingDir,
      ignoreWarnings,
    });
  }

  /** Clear the findMatchingFiles cache */
  public static clearFindMatchingFilesCache(): void {
    this.findMatchingFilesCache.clear();
  }

  static async findMatchingFiles(
    specifier: NormalizedStoriesSpecifier,
    workingDir: Path,
    ignoreWarnings = false
  ): Promise<MatchingFiles> {
    // Check cache first
    const cacheKey = this.getFindMatchingFilesCacheKey(specifier, workingDir, ignoreWarnings);
    const cached = this.findMatchingFilesCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pathToSubIndex = {} as MatchingFiles;

    // Calculate a new CWD for each glob to handle paths that go above the workingDir.
    const globCwd = slash(resolve(workingDir, specifier.directory));
    // Prepend ./ to patterns starting with ! to ensure they are treated as extglobs
    const globPattern = specifier.files.startsWith('!') ? `./${specifier.files}` : specifier.files;

    // Dynamically import globby because it is a pure ESM module
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');

    const files = await globby(globPattern, {
      absolute: true,
      cwd: globCwd,
      ...commonGlobOptions(globPattern),
      onlyFiles: true,
    });

    if (files.length === 0 && !ignoreWarnings) {
      once.warn(
        `No story files found for the specified pattern: ${picocolors.blue(
          join(specifier.directory, specifier.files)
        )}`
      );
    }

    files.sort().forEach((absolutePath: Path) => {
      const ext = extname(absolutePath);
      if (ext === '.storyshot') {
        const relativePath = relative(workingDir, absolutePath);
        logger.info(`Skipping ${ext} file ${relativePath}`);
        return;
      }

      pathToSubIndex[absolutePath] = false;
    });

    // Store in cache before returning
    this.findMatchingFilesCache.set(cacheKey, pathToSubIndex);
    return pathToSubIndex;
  }

  static async findMatchingFilesForSpecifiers(
    specifiers: NormalizedStoriesSpecifier[],
    workingDir: Path,
    ignoreWarnings = false
  ): Promise<Array<readonly [NormalizedStoriesSpecifier, MatchingFiles]>> {
    return Promise.all(
      specifiers.map(async (specifier) => {
        const pathToSubIndex = await StoryIndexGenerator.findMatchingFiles(
          specifier,
          workingDir,
          ignoreWarnings
        );
        return [specifier, pathToSubIndex] as const;
      })
    );
  }

  async initialize() {
    const specifiersAndFiles = await StoryIndexGenerator.findMatchingFilesForSpecifiers(
      this.specifiers,
      this.options.workingDir
    );

    // We do this in a second step to avoid timing issues with the Promise.all above -- to ensure
    // the keys in `specifierToSlots` are consistent with the order of specifiers.
    specifiersAndFiles.forEach(([specifier, files]) =>
      this.specifierToSlots.set(
        specifier,
        new Map(Object.keys(files).map((absolutePath) => [absolutePath, {}]))
      )
    );

    const projectTags = this.getProjectTags(await this.getPreviewFile());

    await this.extractAll(projectTags);
  }

  private async extractAll(projectTags: Tag[]): Promise<ExtractedFile[]> {
    return Promise.all(
      [...this.specifierToSlots].flatMap(([specifier, slots]) =>
        [...slots].map(async ([absolutePath, slot]) => {
          slot.extracted ??= this.extract(specifier, absolutePath, projectTags);
          return { specifier, absolutePath, extracted: await slot.extracted };
        })
      )
    );
  }

  private async extract(
    specifier: NormalizedStoriesSpecifier,
    absolutePath: Path,
    projectTags: Tag[]
  ): Promise<Extracted> {
    try {
      return this.isDocsMdx(absolutePath)
        ? await this.extractDocs(absolutePath)
        : await this.extractStories(specifier, absolutePath, projectTags);
    } catch (err) {
      const isGone = await access(absolutePath).then(
        () => false,
        (accessError) => accessError?.code === 'ENOENT' || accessError?.code === 'ENOTDIR'
      );
      return isGone ? undefined : { type: 'error', err: this.toIndexingError(err, absolutePath) };
    }
  }

  private toIndexingError(err: unknown, absolutePath: Path) {
    const relativePath = `.${sep}${relative(this.options.workingDir, absolutePath)}`;

    return new IndexingError(
      err instanceof Error ? err.message : String(err),
      [relativePath],
      err instanceof Error ? err.stack : undefined,
      err instanceof StorybookError
        ? {
            code: err.fullErrorCode,
            messageWithoutPath: err.message
              .replaceAll(pathToFileURL(absolutePath).href, '')
              .replaceAll(absolutePath, ''),
          }
        : undefined
    );
  }

  isDocsMdx(absolutePath: Path) {
    return /(?<!\.stories)\.mdx$/i.test(absolutePath);
  }

  /**
   * Try to find the component path from a raw import string and return it in the same format as
   * `importPath`. Respect tsconfig paths if available.
   *
   * If no such file exists, assume that the import is from a package and return the raw
   */
  resolveComponentPath(
    rawComponentPath: Path,
    absolutePath: Path,
    matchPath: TsconfigPaths.MatchPath | undefined
  ) {
    const matchedPath =
      matchPath?.(rawComponentPath, undefined, undefined, supportedExtensions) ?? rawComponentPath;
    let resolved;
    try {
      resolved = resolveImport(matchedPath, { basedir: dirname(absolutePath) });
    } catch {
      return matchedPath;
    }
    const relativePath = relative(this.options.workingDir, resolved);
    return slash(normalizeStoryPath(relativePath));
  }

  async extractStories(
    specifier: NormalizedStoriesSpecifier,
    absolutePath: Path,
    projectTags: Tag[] = []
  ): Promise<StoriesFile> {
    const relativePath = relative(this.options.workingDir, absolutePath);
    const importPath = slash(normalizeStoryPath(relativePath));
    const defaultMakeTitle = (userTitle?: string) => {
      const title = userOrAutoTitleFromSpecifier(importPath, specifier, userTitle);
      invariant(
        title,
        "makeTitle created an undefined title. This happens when the fileName doesn't match any specifier from main.js"
      );
      return title;
    };

    const indexer = this.options.indexers.find((ind) => ind.test.exec(absolutePath));

    invariant(indexer, `No matching indexer found for ${absolutePath}`);

    const indexInputs = (await indexer.createIndex(absolutePath, {
      makeTitle: defaultMakeTitle,
    })) as StoryIndexInput[]; // we don't actually support DocsIndexInputs at runtime, although types say we do
    const tsconfigPath = find.up('tsconfig.json', {
      cwd: this.options.workingDir,
      last: getProjectRoot(),
    });
    const tsconfig = TsconfigPaths.loadConfig(tsconfigPath);
    let matchPath: TsconfigPaths.MatchPath | undefined;
    if (tsconfig.resultType === 'success') {
      matchPath = TsconfigPaths.createMatchPath(
        getTsconfigPathsBaseDir(tsconfig.configFileAbsolutePath),
        tsconfig.paths,
        ['browser', 'module', 'main']
      );
    }

    const toImportPath = (path: string | undefined) => {
      if (!path) {
        return importPath;
      }
      if (path.startsWith('virtual:')) {
        return path;
      }
      return slash(normalizeStoryPath(relative(this.options.workingDir, path)));
    };

    const storyEntries: ((StoryIndexEntryWithExtra | DocsIndexEntry) & { tags: Tag[] })[] =
      indexInputs.map((input) => {
        const name = input.name ?? storyNameFromExport(input.exportName);
        const componentPath =
          input.rawComponentPath &&
          this.resolveComponentPath(input.rawComponentPath, absolutePath, matchPath);
        const title = input.title ?? defaultMakeTitle();

        const id = input.__id ?? toId(input.metaId ?? title, storyNameFromExport(input.exportName));
        const tags = combineTags(...projectTags, ...(input.tags ?? []));
        const subtype = input.subtype ?? 'story';

        const entry: StoryIndexEntryWithExtra & { tags: Tag[] } = {
          type: 'story',
          subtype,
          id,
          extra: {
            metaId: input.metaId,
            stats: input.__stats ?? {},
          },
          name,
          title,
          importPath: toImportPath(input.importPath),
          componentPath,
          tags,
        };

        if (subtype === 'test') {
          entry.parent = input.parent;
          entry.parentName = input.parentName;
        }
        if (input.exportName) {
          entry.exportName = input.exportName;
        }

        return entry;
      });

    // We need a docs entry attached to the CSF file if either:
    //  a) autodocs is globally enabled
    //  b) we have autodocs enabled for this file
    const hasAutodocsTag = storyEntries.some((entry) => entry.tags.includes(Tag.AUTODOCS));
    const createDocEntry = hasAutodocsTag && !!this.options.docs;

    if (createDocEntry && this.options.build?.test?.disableAutoDocs !== true) {
      const docsName = this.options.docs?.defaultName ?? 'Docs';
      const name = docsName;
      const { metaId } = indexInputs[0];
      const entry = storyEntries[0];
      const id = toId(metaId ?? entry.title, name);
      const tags = combineTags(...projectTags, ...(indexInputs[0].tags ?? []));

      const docsEntry: DocsIndexEntry & { tags: Tag[] } = {
        id,
        title: entry.title,
        name,
        importPath: entry.importPath,
        type: 'docs',
        tags,
        storiesImports: [],
        ...(this.options.features?.experimentalSearchDocsHeadings && {
          // Each story in an autodocs page is wrapped in an `Anchor` block whose DOM id is
          // derived from the story id, so those are the reliable in-page navigation targets.
          anchors: storyEntries.map((e) => ({ id: anchorBlockIdFromId(e.id), title: e.name })),
        }),
      };

      return {
        entries: [docsEntry, ...storyEntries],
        type: 'stories',
      };
    }

    return {
      entries: storyEntries,
      type: 'stories',
    };
  }

  private async extractDocs(absolutePath: Path): Promise<DocsFile | undefined> {
    try {
      const content = await readFile(absolutePath, { encoding: 'utf8' });
      const analysis = await analyzeMdx(content);

      // Templates are not indexed
      return analysis.isTemplate ? undefined : { type: 'docs', analysis };
    } catch (err) {
      if (err && (err as { source?: string }).source?.match(/mdast-util-mdx-jsx/g)) {
        logger.warn(
          `💡 This seems to be an MDX2 syntax error. Please refer to the MDX section in the following resource for assistance on how to fix this: ${picocolors.yellow(
            'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mdx2-upgrade'
          )}`
        );
      }
      throw err;
    }
  }

  // A docs entry lists its stories files in the order they are indexed, not the order it imports them
  private findDependencies(absoluteImports: Path[], storiesFiles: StoriesFilesByImport) {
    return [
      ...new Set(absoluteImports.flatMap((storyImport) => storiesFiles.get(storyImport) ?? [])),
    ]
      .sort((a, b) => a.order - b.order)
      .map(({ storiesFile }) => storiesFile);
  }

  private resolveDocs(
    specifier: NormalizedStoriesSpecifier,
    absolutePath: Path,
    analysis: MdxAnalysisResult,
    storiesFiles: StoriesFilesByImport,
    projectTags: Tag[]
  ): DocsIndexEntry {
    const relativePath = relative(this.options.workingDir, absolutePath);
    const normalizedPath = normalizeStoryPath(relativePath);
    const importPath = slash(normalizedPath);

    const absoluteImports = analysis.imports.map((p) =>
      makeAbsolute(p, normalizedPath, this.options.workingDir)
    );

    const dependencies = this.findDependencies(absoluteImports, storiesFiles);

    // To ensure the `<Meta of={}/>` import is always first in the list, we'll bring the dependency
    // that contains it to the front of the list.
    let sortedDependencies = dependencies;

    // Also, if `analysis.of` is set, it means that we're using the `<Meta of={XStories} />` syntax,
    // so find the `title` defined the file that `meta` points to.
    let csfEntry: StoryIndexEntryWithExtra | undefined;
    if (analysis.of) {
      const absoluteOf = makeAbsolute(analysis.of, normalizedPath, this.options.workingDir);
      let metaDependency: StoriesFile | undefined;

      dependencies.forEach((dep) => {
        if (dep.entries.length > 0) {
          const first = dep.entries.find((e) => e.type !== 'docs') as StoryIndexEntryWithExtra;

          if (
            normalize(resolve(this.options.workingDir, first.importPath)).startsWith(
              normalize(absoluteOf)
            )
          ) {
            csfEntry = first;
            metaDependency = dep;
          }
        }
      });

      if (metaDependency) {
        sortedDependencies = [metaDependency, ...dependencies.filter((d) => d !== metaDependency)];
      }

      invariant(
        csfEntry,
        dedent`
          Could not find or load CSF file at path "${analysis.of}" referenced by \`of={}\` in docs file "${relativePath}".

          - Does that file exist?
          - If so, is it a CSF file (\`.stories.*\`)?
          - If so, is it matched by the \`stories\` glob in \`main.js\`?
          - If so, has the file successfully loaded in Storybook and are its stories visible?
        `
      );
    }

    const title =
      csfEntry?.title || userOrAutoTitleFromSpecifier(importPath, specifier, analysis.title);
    invariant(
      title,
      "makeTitle created an undefined title. This happens when a specifier's doesn't have any matches in its fileName"
    );
    const defaultName = this.options.docs?.defaultName ?? 'Docs';

    const name =
      analysis.name ||
      (csfEntry ? autoName(importPath, csfEntry.importPath, defaultName) : defaultName);

    const id = toId(csfEntry?.extra.metaId || analysis.id || title, name);

    const tags = combineTags(
      ...projectTags,
      ...(csfEntry?.tags ?? []),
      ...(analysis.metaTags ?? []),
      csfEntry ? Tag.ATTACHED_MDX : Tag.UNATTACHED_MDX
    );

    return {
      id,
      title,
      name,
      importPath,
      storiesImports: sortedDependencies.map((dep) => dep.entries[0].importPath),
      type: 'docs',
      tags,
      ...(this.options.features?.experimentalSearchDocsHeadings && { anchors: analysis.anchors }),
    };
  }

  chooseDuplicate(firstEntry: IndexEntry, secondEntry: IndexEntry, projectTags: Tag[]): IndexEntry {
    // NOTE: it is possible for the same entry to show up twice (if it matches >1 glob). That's OK.
    if (firstEntry.importPath === secondEntry.importPath) {
      return firstEntry;
    }

    let firstIsBetter = true;
    if (secondEntry.type === 'story') {
      firstIsBetter = false;
    } else if (isMdxEntry(secondEntry) && firstEntry.type === 'docs' && !isMdxEntry(firstEntry)) {
      firstIsBetter = false;
    }
    const betterEntry = firstIsBetter ? firstEntry : secondEntry;
    const worseEntry = firstIsBetter ? secondEntry : firstEntry;

    const changeDocsName = 'Use `<Meta of={} name="Other Name">` to distinguish them.';

    // This shouldn't be possible, but double check and use for typing
    if (worseEntry.type === 'story') {
      throw new IndexingError(`Duplicate stories with id: ${firstEntry.id}`, [
        firstEntry.importPath,
        secondEntry.importPath,
      ]);
    }

    if (betterEntry.type === 'story') {
      const worseDescriptor = isMdxEntry(worseEntry)
        ? `component docs page`
        : `automatically generated docs page`;
      const docsName = this.options.docs?.defaultName ?? 'Docs';
      if (betterEntry.name === docsName) {
        throw new IndexingError(
          `You have a story for ${betterEntry.title} with the same name as your default docs entry name (${betterEntry.name}), so the docs page is being dropped. Consider changing the story name.`,
          [firstEntry.importPath, secondEntry.importPath]
        );
      } else {
        throw new IndexingError(
          `You have a story for ${betterEntry.title} with the same name as your ${worseDescriptor} (${worseEntry.name}), so the docs page is being dropped. ${changeDocsName}`,
          [firstEntry.importPath, secondEntry.importPath]
        );
      }
    } else if (isMdxEntry(betterEntry)) {
      // Both entries are MDX but pointing at the same place
      if (isMdxEntry(worseEntry)) {
        throw new IndexingError(
          `You have two component docs pages with the same name ${betterEntry.title}:${betterEntry.name}. ${changeDocsName}`,
          [firstEntry.importPath, secondEntry.importPath]
        );
      }

      // If you link a file to a tagged CSF file, you have probably made a mistake
      if (worseEntry.tags?.includes(Tag.AUTODOCS) && !projectTags?.includes(Tag.AUTODOCS)) {
        throw new IndexingError(
          `You created a component docs page for '${worseEntry.title}', but also tagged the CSF file with '${Tag.AUTODOCS}'. This is probably a mistake.`,
          [betterEntry.importPath, worseEntry.importPath]
        );
      }

      // Otherwise the existing entry is created by project-level autodocs which is allowed to be overridden.
    } else {
      // If both entries are templates (e.g. you have two CSF files with the same title), then
      //   we need to merge the entries. We'll use the first one's name and importPath,
      //   but ensure we include both as storiesImports so they are both loaded before rendering
      //   the story (for the <Stories> block & friends)
      return {
        ...betterEntry,
        storiesImports: [
          ...betterEntry.storiesImports,
          worseEntry.importPath,
          ...worseEntry.storiesImports,
        ],
      };
    }

    return betterEntry;
  }

  async sortStories(entries: StoryIndex['entries'], storySortParameter: any) {
    const sortableStories = Object.values(entries);
    const fileNameOrder = [...this.specifierToSlots.values()].flatMap((slots) => [...slots.keys()]);
    sortStoriesV7(sortableStories, storySortParameter, fileNameOrder);

    return sortableStories.reduce(
      (acc, item) => {
        acc[item.id] = item;
        return acc;
      },
      {} as StoryIndex['entries']
    );
  }

  async getIndex() {
    return (await this.getIndexAndStats()).storyIndex;
  }

  async getIndexAndStats(): Promise<IndexAndStats> {
    if (this.settled?.revision === this.revision) {
      if ('error' in this.settled) {
        throw this.settled.error;
      }
      return this.settled.value;
    }

    this.pending ??= this.computeIndexAndStats();

    return this.pending;
  }

  private async computeIndexAndStats(): Promise<IndexAndStats> {
    try {
      // Starts over until no file was invalidated while the index was built
      while (true) {
        const { revision, nextInvalidation } = this;
        const projectTags = this.getProjectTags(await this.getPreviewFile());

        // invalidateAll() emptied the slots during the read, and they need the tags of the next read
        if (this.revision !== revision) {
          continue;
        }

        const files = await Promise.race([this.extractAll(projectTags), nextInvalidation.promise]);

        if (!files || this.revision !== revision) {
          continue;
        }

        const outcome = await this.buildIndex(files, projectTags).then(
          (value) => ({ value }),
          (error: unknown) => {
            invariant(error instanceof Error);
            return { error };
          }
        );

        // buildIndex awaits the sort, so a file can still be invalidated while it runs
        if (this.revision !== revision) {
          continue;
        }

        this.settled = { revision, ...outcome };

        if ('error' in outcome) {
          logger.warn(`🚨 ${outcome.error.toString()}`);
          throw outcome.error;
        }

        return outcome.value;
      }
    } finally {
      // Cleared before the promise settles, so no caller joins a computation that is already over
      this.pending = undefined;
    }
  }

  private async buildIndex(files: ExtractedFile[], projectTags: Tag[]): Promise<IndexAndStats> {
    const storiesFiles = indexStoriesFilesByImport(files);
    const stats = {} as IndexStatsSummary;
    const errors: IndexingError[] = [];
    const entries: IndexEntry[] = [];

    files.forEach(({ specifier, absolutePath, extracted }) => {
      if (extracted?.type === 'error') {
        errors.push(extracted.err);
      } else if (extracted?.type === 'docs') {
        try {
          entries.push(
            this.resolveDocs(specifier, absolutePath, extracted.analysis, storiesFiles, projectTags)
          );
        } catch (err) {
          errors.push(this.toIndexingError(err, absolutePath));
        }
      } else if (extracted?.type === 'stories') {
        extracted.entries.forEach((item) => {
          if (item.type === 'docs') {
            entries.push(item);
            return;
          }

          // don't count example stories towards feature usage stats
          if (!isExampleStoryId(item.id)) {
            addStats(item.extra.stats, stats);
          }

          // Drop extra data used for internal bookkeeping
          const { extra: _extra, ...entry } = item;
          entries.push(entry);
        });
      }
    });

    if (errors.length) {
      throw new MultipleIndexingError(errors);
    }

    const duplicateErrors: IndexingError[] = [];
    const indexEntries: StoryIndex['entries'] = {};
    entries.forEach((entry) => {
      try {
        const existing = indexEntries[entry.id];
        if (existing) {
          indexEntries[entry.id] = this.chooseDuplicate(existing, entry, projectTags);
        } else {
          indexEntries[entry.id] = entry;
        }
      } catch (err) {
        if (err instanceof IndexingError) {
          duplicateErrors.push(err);
        }
      }
    });

    if (duplicateErrors.length) {
      throw new MultipleIndexingError(duplicateErrors);
    }

    const sorted = await this.sortStories(
      indexEntries,
      combineStorySorts(this.options.storySorts ?? [])
    );

    return { storyIndex: { v: 5, entries: sorted }, stats };
  }

  invalidateAll() {
    this.specifierToSlots.forEach((slots) => {
      slots.forEach((_, absolutePath) => slots.set(absolutePath, {}));
    });
    this.notifyInvalidated();
  }

  invalidate(importPath: Path, removed: boolean) {
    const absolutePath = slash(resolve(this.options.workingDir, importPath));
    let invalidated = false;

    // the same file can match several specifiers
    this.specifierToSlots.forEach((slots, specifier) => {
      if (specifier.importPathMatcher.exec(importPath)) {
        if (removed) {
          slots.delete(absolutePath);
        } else {
          slots.set(absolutePath, {});
        }
        invalidated = true;
      }
    });

    if (invalidated) {
      this.notifyInvalidated();
    }
  }

  private notifyInvalidated() {
    this.revision += 1;
    this.nextInvalidation.resolve();
    this.nextInvalidation = Promise.withResolvers();
    this.invalidationListeners.forEach((listener) => listener());
  }

  onInvalidated(listener: () => void) {
    this.invalidationListeners.add(listener);
    return () => {
      this.invalidationListeners.delete(listener);
    };
  }

  async getPreviewFile(): Promise<{ path: string; code: string } | undefined> {
    const previewFile = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts']
      .map((ext) => join(this.options.configDir, `preview.${ext}`))
      .find((fname) => existsSync(fname));

    return previewFile
      ? { path: previewFile, code: (await readFile(previewFile, { encoding: 'utf8' })).toString() }
      : undefined;
  }

  getProjectTags(preview?: { path: string; code: string }) {
    let projectTags = [] as Tag[];
    const defaultTags = [Tag.DEV, Tag.TEST, Tag.MANIFEST];
    if (preview) {
      try {
        const projectAnnotations = loadConfig(preview.code, preview.path).parse();
        const tags =
          projectAnnotations.inspect(['tags']).kind === 'value'
            ? projectAnnotations.getValue(['tags'])
            : [];
        invariant(
          Array.isArray(tags) && tags.every((tag) => typeof tag === 'string'),
          'Preview tags must be a static array of strings'
        );
        projectTags = tags;
      } catch {
        once.warn(dedent`
          Unable to parse tags from project configuration. If defined, tags should be specified inline, e.g.

          export default {
            tags: ['foo'],
          }

          ---

          Received:

          ${preview.code}
        `);
      }
    }
    return [...defaultTags, ...projectTags];
  }

  // Get the story file names in "imported order"
  static storyFileNames(specifierToCache: Map<NormalizedStoriesSpecifier, MatchingFiles>) {
    return Array.from(specifierToCache.values()).flatMap((r) => Object.keys(r));
  }
}
