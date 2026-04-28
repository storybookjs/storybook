import { join, normalize } from 'pathe';

import { logger } from 'storybook/internal/node-logger';
import { disposeOxcParsePool } from 'storybook/internal/oxc-parser';
import { getProjectRoot } from 'storybook/internal/common';
import type {
  Presets,
  StatusValue,
  StoryIndex,
  Status,
  StatusStoreByTypeId,
} from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';

import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator.ts';
import type { ChangeDetectionAdapter, FileChangeEvent } from './adapters/index.ts';
import {
  ChangeDetectionResolverFactory,
  DependencyGraphBuilder,
  IncrementalPatcher,
  ParseResolveCache,
} from './dependency-graph/index.ts';
import type { ReverseIndexImpl } from './dependency-graph/index.ts';
import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';
import { extractBaselineEntryIds, IndexBaselineService } from './IndexBaselineService.ts';
import type { ImportParser } from './parser-registry/index.ts';
import { ParserRegistry, builtinImportParsers } from './parser-registry/index.ts';
import { resetChangeDetectionReadiness, setChangeDetectionReadiness } from './readiness.ts';

const CHANGE_DETECTION_DEBOUNCE_MS = 200;

function isSameStatus(a: Status | undefined, b: Status): boolean {
  if (!a) {
    return false;
  }

  return (
    a.storyId === b.storyId &&
    a.typeId === b.typeId &&
    a.value === b.value &&
    a.title === b.title &&
    a.description === b.description &&
    a.sidebarContextMenu === b.sidebarContextMenu &&
    deepEqual(a.data, b.data)
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bRecord = b as Record<string, unknown>;
  if (aKeys.length !== Object.keys(bRecord).length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bRecord, key)) {
      return false;
    }
    if (!deepEqual((a as Record<string, unknown>)[key], bRecord[key])) {
      return false;
    }
  }
  return true;
}

type StoryIdsByFileCacheKey = Awaited<ReturnType<StoryIndexGenerator['getIndex']>>;
const storyIdsByFileCache = new WeakMap<
  StoryIdsByFileCacheKey,
  { workingDir: string; storyIdsByFile: Map<string, Set<string>> }
>();

function getStoryIdsByAbsolutePath(
  storyIndex: StoryIdsByFileCacheKey,
  workingDir: string
): Map<string, Set<string>> {
  const cached = storyIdsByFileCache.get(storyIndex);
  if (cached && cached.workingDir === workingDir) {
    return cached.storyIdsByFile;
  }
  const storyIdsByFile = new Map<string, Set<string>>();
  Object.values(storyIndex.entries).forEach((entry) => {
    if (entry.type === 'story' && !entry.importPath.startsWith('virtual:')) {
      const filePath = normalize(join(workingDir, entry.importPath));
      const storyIds = storyIdsByFile.get(filePath) ?? new Set<string>();
      storyIds.add(entry.id);
      storyIdsByFile.set(filePath, storyIds);
    }
  });
  storyIdsByFileCache.set(storyIndex, { workingDir, storyIdsByFile });
  return storyIdsByFile;
}

export function mergeStatusValues(
  previousValue: StatusValue | undefined,
  nextValue: StatusValue
): StatusValue {
  if (previousValue === 'status-value:new' || nextValue === 'status-value:new') {
    return 'status-value:new';
  }

  if (previousValue === 'status-value:modified' || nextValue === 'status-value:modified') {
    return 'status-value:modified';
  }

  if (previousValue === 'status-value:affected' || nextValue === 'status-value:affected') {
    return 'status-value:affected';
  }

  return nextValue;
}

export function mergeChangeDetectionStatuses(
  existing: Status | undefined,
  incoming: Status
): Status {
  return {
    ...incoming,
    value: mergeStatusValues(existing?.value, incoming.value),
    title: incoming.title || existing?.title || '',
    description: incoming.description || existing?.description || '',
    sidebarContextMenu: incoming.sidebarContextMenu ?? existing?.sidebarContextMenu ?? false,
  };
}

export function buildIndexBaselineStatuses(
  storyIndex: StoryIndex,
  baselineEntryIds: Set<string>
): Map<string, Status> {
  const statuses = new Map<string, Status>();
  if (baselineEntryIds.size === 0) {
    return statuses;
  }

  for (const entryId of extractBaselineEntryIds(storyIndex)) {
    if (baselineEntryIds.has(entryId)) {
      continue;
    }

    statuses.set(entryId, {
      storyId: entryId,
      typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
      value: 'status-value:new',
      title: '',
      description: '',
      sidebarContextMenu: false,
    });
  }

  return statuses;
}

/**
 * Coordinates change detection by owning a builder-supplied {@link ChangeDetectionAdapter},
 * eagerly building a reverse-dependency index from story files at startup, applying
 * file-system events incrementally to that index, resolving git-changed files, and publishing
 * the resulting story statuses to the status store.
 */
export class ChangeDetectionService {
  private disposed = false;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private scanInFlight = false;
  private rerunAfterCurrentScan = false;
  private readinessResolved = false;
  private previousStatuses = new Map<string, Status>();
  private gitDiffProvider: GitDiffProvider | undefined;
  private indexBaselineService: IndexBaselineService | undefined;
  private readonly workingDir: string;
  private readonly debounceMs: number;
  private adapter: ChangeDetectionAdapter | undefined;
  private dependencyGraphBuilder: DependencyGraphBuilder | undefined;
  private incrementalPatcher: IncrementalPatcher | undefined;
  private reverseIndex: ReverseIndexImpl | undefined;
  private storyFiles: Set<string> = new Set();
  /**
   * Serialises file-change patches so two events touching the same dep set never interleave
   * across `await` points inside `IncrementalPatcher.patch`. The chain ignores rejections
   * (each call's failure is logged in {@link handleFileChange}).
   */
  private patchQueue: Promise<void> = Promise.resolve();
  private unsubscribeFileChange: (() => void) | undefined;
  private unsubscribeStartupFailure: (() => void) | undefined;

  constructor(
    private readonly options: {
      storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
      statusStore: StatusStoreByTypeId;
      gitDiffProvider?: GitDiffProvider;
      indexBaselineService?: IndexBaselineService;
      workingDir?: string;
      debounceMs?: number;
      /**
       * Presets instance used to resolve `experimental_importParsers` contributions from
       * framework/renderer plugins. Optional for tests that never construct the real
       * dependency-graph layer.
       */
      presets?: Presets;
    }
  ) {
    this.gitDiffProvider = options.gitDiffProvider;
    this.indexBaselineService = options.indexBaselineService;
    this.workingDir = options.workingDir ?? process.cwd();
    this.debounceMs = options.debounceMs ?? CHANGE_DETECTION_DEBOUNCE_MS;
    resetChangeDetectionReadiness();
  }

  start(adapter: ChangeDetectionAdapter | undefined, enabled: boolean | undefined): void {
    if (enabled === false) {
      logger.debug('Change detection disabled.');
      this.resolveReadiness({
        status: 'unavailable',
        reason: 'disabled',
      });
      return;
    }

    if (!adapter) {
      logger.warn('Change detection unavailable: builder does not support change detection');
      this.resolveReadiness({
        status: 'unavailable',
        reason: 'builder does not support change detection',
      });
      return;
    }

    logger.debug('Change detection enabled.');
    this.adapter = adapter;

    void this.startInternal().catch((error) => {
      if (this.disposed) {
        return;
      }
      const failure =
        error instanceof Error ? error : new ChangeDetectionFailureError(String(error));
      logger.error(`Change detection failed to start: ${failure.message}`);
      this.resolveReadiness({ status: 'error', error: failure });
      void this.dispose().catch(() => undefined);
    });
  }

  /**
   * Builds parser registry, resolver, dependency graph, and patcher; subscribes to
   * file-change events queued behind {@link patchQueue}; kicks off the baseline service
   * and initial scan.
   */
  private async startInternal(): Promise<void> {
    const adapter = this.adapter;
    if (!adapter) {
      return;
    }

    if (this.disposed) {
      return;
    }

    const resolveConfig = await adapter.getResolveConfig();
    const projectRoot = normalize(resolveConfig.projectRoot ?? this.workingDir);

    const pluginParsers = this.options.presets
      ? await this.options.presets.apply<ImportParser[]>('experimental_importParsers', [])
      : [];
    const registry = new ParserRegistry({
      defaultParsers: builtinImportParsers,
      pluginParsers,
    });
    const resolver = new ChangeDetectionResolverFactory(resolveConfig);
    const workspaceRoots = new Set<string>([normalize(getProjectRoot())]);

    const storyIndexGenerator = await this.options.storyIndexGeneratorPromise;
    const storyIndex = await storyIndexGenerator.getIndex();
    const storyIdsByFile = getStoryIdsByAbsolutePath(storyIndex, this.workingDir);
    this.storyFiles = new Set(storyIdsByFile.keys());

    if (this.disposed) {
      return;
    }

    // Shared parse/resolve cache so the patcher reuses cold-start results instead of
    // re-doing every file's parse + resolution on the first event after boot. The patcher
    // invalidates per-file entries on every change/unlink before reading.
    const cache = new ParseResolveCache({
      registry,
      resolver,
      workspaceRoots,
      projectRoot,
      logger,
    });

    this.dependencyGraphBuilder = new DependencyGraphBuilder({
      registry,
      resolver,
      workspaceRoots,
      projectRoot,
      cache,
    });
    const { reverseIndex, graph } = await this.dependencyGraphBuilder.build(this.storyFiles);
    if (this.disposed) {
      return;
    }
    this.reverseIndex = reverseIndex;

    this.incrementalPatcher = new IncrementalPatcher({
      reverseIndex,
      graph,
      registry,
      resolver,
      workspaceRoots,
      projectRoot,
      cache,
      isStoryFile: (path: string) => this.storyFiles.has(normalize(path)),
    });

    this.unsubscribeFileChange = adapter.onFileChange((event) => {
      if (this.disposed) {
        return;
      }
      // Serialise patches: chain each event behind the previous one so two events touching
      // the same dep set never interleave inside IncrementalPatcher.patch.
      this.patchQueue = this.patchQueue.then(() => this.handleFileChange(event));
    });

    if (adapter.onStartupFailure) {
      this.unsubscribeStartupFailure = adapter.onStartupFailure((event) => {
        if (this.disposed) {
          return;
        }
        logger.warn(`Change detection unavailable: ${event.reason}`);
        this.resolveReadiness({
          status: 'unavailable',
          reason: event.reason,
          error: event.error,
        });
        void this.dispose();
      });
    }

    void this.getIndexBaselineService().start();

    this.getGitDiffProvider().onGitStateChange(() => {
      if (this.disposed) {
        return;
      }

      this.scheduleScan(this.debounceMs);
      void this.getIndexBaselineService()
        .handleGitStateChange()
        .catch(() => undefined);
    });

    // Initial scan surfaces git-pending diffs immediately.
    this.scheduleScan(0);
  }

  onStoryIndexInvalidated(): void {
    if (this.disposed) {
      return;
    }
    void this.refreshStoryFiles().catch(() => undefined);
    this.scheduleScan(this.debounceMs);
  }

  /**
   * Re-reads the story index and reconciles {@link storyFiles} with stories that have
   * appeared or disappeared since startup. For each story that newly entered the index, the
   * patcher is asked to walk it (so its forward edges are recorded). For each story that
   * left the index, the patcher is asked to unlink it (so its reverse-index entries are
   * pruned). Replays are queued behind {@link patchQueue} to keep the serialised-patch
   * invariant intact.
   */
  private async refreshStoryFiles(): Promise<void> {
    if (!this.incrementalPatcher) {
      return;
    }
    const storyIndexGenerator = await this.options.storyIndexGeneratorPromise;
    const storyIndex = await storyIndexGenerator.getIndex();
    if (this.disposed) {
      return;
    }
    const storyIdsByFile = getStoryIdsByAbsolutePath(storyIndex, this.workingDir);
    const next = new Set(storyIdsByFile.keys());
    const previous = this.storyFiles;

    const added: string[] = [];
    for (const path of next) {
      if (!previous.has(path)) {
        added.push(path);
      }
    }
    const removed: string[] = [];
    for (const path of previous) {
      if (!next.has(path)) {
        removed.push(path);
      }
    }

    if (added.length === 0 && removed.length === 0) {
      return;
    }

    this.storyFiles = next;

    for (const path of added) {
      this.patchQueue = this.patchQueue.then(() => this.handleFileChange({ kind: 'add', path }));
    }
    for (const path of removed) {
      this.patchQueue = this.patchQueue.then(() => this.handleFileChange({ kind: 'unlink', path }));
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.rerunAfterCurrentScan = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.unsubscribeFileChange?.();
    this.unsubscribeFileChange = undefined;
    this.unsubscribeStartupFailure?.();
    this.unsubscribeStartupFailure = undefined;

    this.gitDiffProvider?.dispose();
    await disposeOxcParsePool().catch(() => undefined);
  }

  private async handleFileChange(event: FileChangeEvent): Promise<void> {
    if (this.disposed || !this.incrementalPatcher) {
      return;
    }
    try {
      await this.incrementalPatcher.patch(event);
    } catch (error) {
      logger.warn(
        `Change detection: failed to apply ${event.kind} for ${event.path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    if (this.disposed) {
      return;
    }
    this.scheduleScan(this.debounceMs);
  }

  private scheduleScan(delayMs: number): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.scan();
    }, delayMs);
  }

  private async scan(): Promise<void> {
    if (this.disposed || !this.reverseIndex) {
      return;
    }

    // Snapshot and drain the current patch chain before reading reverseIndex. Without this
    // await, a scan triggered mid-patch (between removeStory and the re-walk's recordEdges)
    // reads a transiently empty reverseIndex and publishes incorrect statuses.
    const patchSnapshot = this.patchQueue;
    await patchSnapshot.catch(() => undefined);

    if (this.disposed || !this.reverseIndex) {
      return;
    }

    if (this.scanInFlight) {
      this.rerunAfterCurrentScan = true;
      return;
    }

    this.scanInFlight = true;

    try {
      const nextStatuses = await this.buildStatuses(this.reverseIndex);
      if (this.disposed) {
        return;
      }

      this.applyStatusStorePatch(nextStatuses);
      this.resolveReadiness({ status: 'ready' });
    } catch (error) {
      if (this.disposed) {
        return;
      }

      if (error instanceof ChangeDetectionUnavailableError) {
        logger.warn(`Change detection unavailable: ${error.message}`);
        this.resolveReadiness({
          status: 'unavailable',
          reason: error.message,
          error,
        });
        await this.dispose();
      } else if (error instanceof ChangeDetectionFailureError) {
        logger.error(`Change detection failed: ${error.message}`);
        this.resolveReadiness({
          status: 'error',
          error,
        });
      } else {
        const failure = new ChangeDetectionFailureError(
          error instanceof Error ? error.message : String(error),
          { cause: error instanceof Error ? error : undefined }
        );
        logger.error(`Change detection failed: ${failure.message}`);
        this.resolveReadiness({
          status: 'error',
          error: failure,
        });
      }
    } finally {
      this.scanInFlight = false;

      if (!this.disposed && this.rerunAfterCurrentScan) {
        this.rerunAfterCurrentScan = false;
        void this.scan();
      }
    }
  }

  private async buildStatuses(reverseIndex: ReverseIndexImpl): Promise<Map<string, Status>> {
    const gitDiffProvider = this.getGitDiffProvider();
    const [changes, repoRoot, storyIndexGenerator, baselineEntryIds] = await Promise.all([
      gitDiffProvider.getChangedFiles(),
      gitDiffProvider.getRepoRoot(),
      this.options.storyIndexGeneratorPromise,
      this.getIndexBaselineService().getBaselineEntryIds(),
    ]);

    const changedFiles = new Set(
      Array.from(changes.changed).map((path) => normalize(join(repoRoot, path)))
    );
    const newFiles = new Set(
      Array.from(changes.new).map((path) => normalize(join(repoRoot, path)))
    );
    const scannedFiles = new Set([...changedFiles, ...newFiles]);

    const storyIndex = await storyIndexGenerator.getIndex();
    const baselineStatuses = buildIndexBaselineStatuses(storyIndex, baselineEntryIds);
    const storyIdsByFile = getStoryIdsByAbsolutePath(storyIndex, this.workingDir);
    const statuses = new Map<string, Status>();

    for (const changedFile of scannedFiles) {
      const affectedStoryFiles = reverseIndex.lookup(changedFile);
      // Include the changed file as a story-at-distance-0 if it IS a story (parity with
      // legacy trace-changed.ts:10-12).
      const allEntries = new Map(affectedStoryFiles);
      if (storyIdsByFile.has(changedFile)) {
        allEntries.set(changedFile, 0);
      }
      if (allEntries.size === 0) {
        continue;
      }
      let lowestDistance = Number.POSITIVE_INFINITY;
      for (const distance of allEntries.values()) {
        if (distance < lowestDistance) {
          lowestDistance = distance;
        }
      }

      for (const [storyFile, distance] of allEntries.entries()) {
        const storyIds = storyIdsByFile.get(storyFile);
        if (!storyIds) {
          continue;
        }

        const value: Status['value'] = newFiles.has(storyFile)
          ? 'status-value:new'
          : distance === lowestDistance
            ? 'status-value:modified'
            : 'status-value:affected';

        storyIds.forEach((storyId) => {
          const existingStatus = statuses.get(storyId);

          const nextStatus: Status = {
            storyId,
            typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
            value: mergeStatusValues(existingStatus?.value, value),
            title: '',
            description: '',
            sidebarContextMenu: false,
          };

          statuses.set(storyId, mergeChangeDetectionStatuses(existingStatus, nextStatus));
        });
      }
    }

    baselineStatuses.forEach((status, storyId) => {
      statuses.set(storyId, mergeChangeDetectionStatuses(statuses.get(storyId), status));
    });

    return statuses;
  }

  private getGitDiffProvider(): GitDiffProvider {
    this.gitDiffProvider ??= new GitDiffProvider(this.workingDir);
    return this.gitDiffProvider;
  }

  private getIndexBaselineService(): IndexBaselineService {
    this.indexBaselineService ??= new IndexBaselineService({
      storyIndexGeneratorPromise: this.options.storyIndexGeneratorPromise,
      gitDiffProvider: this.getGitDiffProvider(),
      onBaselineUpdated: () => this.scheduleScan(this.debounceMs),
    });
    return this.indexBaselineService;
  }

  private applyStatusStorePatch(nextStatuses: Map<string, Status>): void {
    const removedStoryIds = Array.from(this.previousStatuses.keys()).filter(
      (storyId) => !nextStatuses.has(storyId)
    );
    const changedStatuses = Array.from(nextStatuses.values()).filter(
      (status) => !isSameStatus(this.previousStatuses.get(status.storyId), status)
    );

    if (removedStoryIds.length === 0 && changedStatuses.length === 0) {
      return;
    }

    if (removedStoryIds.length > 0) {
      this.options.statusStore.unset(removedStoryIds);
    }

    if (changedStatuses.length > 0) {
      this.options.statusStore.set(changedStatuses);
    }

    this.previousStatuses = new Map(nextStatuses);
  }

  private resolveReadiness(
    readiness:
      | { status: 'ready' }
      | { status: 'unavailable'; reason: string; error?: Error }
      | { status: 'error'; error: Error }
  ): void {
    if (this.readinessResolved) {
      return;
    }

    this.readinessResolved = true;
    setChangeDetectionReadiness(readiness);
  }
}
