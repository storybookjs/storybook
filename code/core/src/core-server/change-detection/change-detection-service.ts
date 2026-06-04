import { join, normalize } from 'pathe';

import { dequal } from 'dequal';
import { logger } from 'storybook/internal/node-logger';
import type {
  Status,
  StatusStoreByTypeId,
  StatusValue,
  StoryIndex,
} from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';

import { getService } from '../../shared/open-service/server.ts';
import { moduleGraphServiceDef } from '../../shared/open-service/services/module-graph/definition.ts';
import type { ChangeDetectionAdapter } from '../../shared/open-service/services/module-graph/engine/adapters/types.ts';
import { registerModuleGraphLifecycleConsumer } from '../../shared/open-service/services/module-graph/lifecycle-consumer.ts';
import { getStoryIdsByAbsolutePath } from '../../shared/open-service/services/module-graph/story-files.ts';
import { storyIndexPathToAbsolutePath } from '../../shared/open-service/services/module-graph/types.ts';
import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator.ts';
import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';
import { extractBaselineEntryIds, IndexBaselineService } from './IndexBaselineService.ts';
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
    dequal(a.data, b.data)
  );
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
 * Publishes change-detection story statuses to the status store. It resolves git-changed files,
 * maps them to affected stories through the `core/module-graph` open service, and emits
 * `modified`/`affected`/`new` statuses (plus index-baseline `new` entries).
 */
export class ChangeDetectionService {
  private disposed = false;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private scanInFlight = false;
  private rerunAfterCurrentScan = false;
  private readinessResolved = false;
  private statusPipelineStarted = false;
  private changeDetectionEnabled = false;
  private previousStatuses = new Map<string, Status>();
  private gitDiffProvider: GitDiffProvider | undefined;
  private indexBaselineService: IndexBaselineService | undefined;
  private readonly workingDir: string;
  private readonly debounceMs: number;

  constructor(
    private readonly options: {
      storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
      statusStore: StatusStoreByTypeId;
      gitDiffProvider?: GitDiffProvider;
      indexBaselineService?: IndexBaselineService;
      workingDir?: string;
      debounceMs?: number;
    }
  ) {
    this.gitDiffProvider = options.gitDiffProvider;
    this.indexBaselineService = options.indexBaselineService;
    this.workingDir = options.workingDir ?? process.cwd();
    this.debounceMs = options.debounceMs ?? CHANGE_DETECTION_DEBOUNCE_MS;
    resetChangeDetectionReadiness();
  }

  private getModuleGraph() {
    return getService<typeof moduleGraphServiceDef>('core/module-graph');
  }

  /** True while the service is live and change-detection status publishing is enabled. */
  private isActive(): boolean {
    return !this.disposed && this.changeDetectionEnabled;
  }

  onGraphReady(): void {
    if (!this.isActive()) {
      return;
    }

    this.startStatusPipeline();
  }

  onGraphChange(): void {
    if (!this.isActive()) {
      return;
    }

    this.scheduleScan(this.debounceMs);
  }

  onGraphError(error: Error): void {
    if (!this.isActive()) {
      return;
    }

    this.resolveReadiness({ status: 'error', error });
    void this.dispose().catch(() => undefined);
  }

  onGraphUnavailable(reason: string, error?: Error): void {
    if (!this.isActive()) {
      return;
    }

    logger.warn(`Change detection unavailable: ${reason}`);
    this.resolveReadiness({ status: 'unavailable', reason, error });
    void this.dispose();
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
    this.changeDetectionEnabled = true;

    registerModuleGraphLifecycleConsumer({
      onReady: () => this.onGraphReady(),
      onChange: () => this.onGraphChange(),
      onError: (error) => this.onGraphError(error),
      onUnavailable: (reason, error) => this.onGraphUnavailable(reason, error),
    });

    void this.getModuleGraph()
      .queries.getReady.loaded(undefined)
      .then((ready) => {
        if (ready) {
          this.onGraphReady();
        }
      })
      .catch((error) => {
        this.onGraphError(error instanceof Error ? error : new Error(String(error)));
      });
  }

  /**
   * Wires the git-diff-driven status pipeline. Runs once the dependency graph is ready (so the
   * initial scan and every git-state-change scan read a populated reverse index).
   */
  private startStatusPipeline(): void {
    if (this.disposed || this.statusPipelineStarted) {
      return;
    }
    this.statusPipelineStarted = true;

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

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.rerunAfterCurrentScan = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.gitDiffProvider?.dispose();
    registerModuleGraphLifecycleConsumer(undefined);
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
    if (this.disposed) {
      return;
    }

    // Drain the graph's patch chain before reading it. Without this, a scan triggered mid-patch
    // (between a story's removeStory and the re-walk's recordEdges) reads a transiently empty
    // reverse index and publishes incorrect statuses.
    const moduleGraph = this.getModuleGraph();
    const ready = await moduleGraph.queries.getReady.loaded(undefined);

    if (this.disposed || !ready) {
      return;
    }

    if (this.scanInFlight) {
      this.rerunAfterCurrentScan = true;
      return;
    }

    this.scanInFlight = true;

    try {
      const nextStatuses = await this.buildStatuses();
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

  private async buildStatuses(): Promise<Map<string, Status>> {
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
    const scannedFilesArray = [...scannedFiles];
    const moduleGraph = this.getModuleGraph();
    const lookupResults = await moduleGraph.queries.getStoriesForFiles.loaded({
      files: scannedFilesArray,
    });

    for (let i = 0; i < scannedFilesArray.length; i++) {
      const changedFile = scannedFilesArray[i];
      const allEntries = new Map<string, number>();
      for (const { storyFile, depth } of lookupResults[i]) {
        allEntries.set(storyIndexPathToAbsolutePath(storyFile, this.workingDir), depth);
      }
      // Include the changed file as a story-at-distance-0 if it IS a story.
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
