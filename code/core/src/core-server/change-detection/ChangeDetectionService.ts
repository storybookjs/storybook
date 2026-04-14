import { join, relative } from 'pathe';

import { logger } from 'storybook/internal/node-logger';
import type {
  Builder,
  ModuleGraph,
  ModuleGraphChangeEvent,
  ModuleNode,
  Status,
  StatusStoreByTypeId,
} from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';

import { normalizePath } from '../../common/utils/normalize-path.ts';
import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator.ts';
import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';
import { resetChangeDetectionReadiness, setChangeDetectionReadiness } from './readiness.ts';
import { findAffectedStoryFiles } from './trace-changed.ts';

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
    JSON.stringify(a.data) === JSON.stringify(b.data)
  );
}

function getStoryIdsByAbsolutePath(
  storyIndex: Awaited<ReturnType<StoryIndexGenerator['getIndex']>>,
  workingDir: string
): Map<string, Set<string>> {
  const storyIdsByFile = new Map<string, Set<string>>();
  Object.values(storyIndex.entries).forEach((entry) => {
    if (entry.type === 'story' && !entry.importPath.startsWith('virtual:')) {
      const filePath = join(workingDir, entry.importPath);
      const storyIds = storyIdsByFile.get(filePath) ?? new Set<string>();
      storyIds.add(entry.id);
      storyIdsByFile.set(filePath, storyIds);
    }
  });
  return storyIdsByFile;
}

function mergeStatusValues(
  previousValue: Status['value'] | undefined,
  nextValue: Status['value']
): Status['value'] {
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

/**
 * Coordinates change detection by listening to builder module-graph updates, resolving changed
 * files from git, mapping those changes to affected stories, and publishing the resulting story
 * statuses to the status store.
 */
export class ChangeDetectionService {
  private disposed = false;
  private unsubscribeModuleGraph: (() => void) | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private latestModuleGraph: ModuleGraph | undefined;
  private hasReceivedModuleGraph = false;
  private scanInFlight = false;
  private rerunAfterCurrentScan = false;
  private readinessResolved = false;
  private previousStatuses = new Map<string, Status>();
  private gitDiffProvider: GitDiffProvider | undefined;
  private readonly workingDir: string;
  private readonly debounceMs: number;

  constructor(
    private readonly options: {
      storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
      statusStore: StatusStoreByTypeId;
      gitDiffProvider?: GitDiffProvider;
      workingDir?: string;
      debounceMs?: number;
    }
  ) {
    this.gitDiffProvider = options.gitDiffProvider;
    this.workingDir = options.workingDir ?? process.cwd();
    this.debounceMs = options.debounceMs ?? CHANGE_DETECTION_DEBOUNCE_MS;
    resetChangeDetectionReadiness();
  }

  start(
    onModuleGraphChange: Builder<unknown>['onModuleGraphChange'],
    enabled: boolean | undefined
  ): void {
    if (enabled === false) {
      logger.debug('Change detection disabled.');
      this.resolveReadiness({
        status: 'unavailable',
        reason: 'disabled',
      });
      return;
    }

    if (!onModuleGraphChange) {
      logger.warn('Change detection unavailable: Not supported by builder');
      this.resolveReadiness({
        status: 'unavailable',
        reason: 'builder does not support module graph',
      });
      return;
    }

    logger.debug('Change detection enabled.');
    this.unsubscribeModuleGraph = onModuleGraphChange((event) => {
      if (this.disposed) {
        return;
      }

      if (event.type === 'moduleGraph') {
        this.latestModuleGraph = event.moduleGraph;
        this.scheduleScan(this.hasReceivedModuleGraph ? this.debounceMs : 0);
        this.hasReceivedModuleGraph = true;
        return;
      }

      this.handleBuilderStartupEvent(event);
    });
    this.getGitDiffProvider().onGitStateChange(() => {
      if (!this.disposed) {
        this.scheduleScan(this.debounceMs);
      }
    });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.rerunAfterCurrentScan = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.unsubscribeModuleGraph?.();
    this.unsubscribeModuleGraph = undefined;
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
    if (this.disposed || !this.latestModuleGraph) {
      return;
    }

    if (this.scanInFlight) {
      this.rerunAfterCurrentScan = true;
      return;
    }

    this.scanInFlight = true;

    try {
      const nextStatuses = await this.buildStatuses(this.latestModuleGraph);
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

  private async buildStatuses(moduleGraph: ModuleGraph): Promise<Map<string, Status>> {
    const gitDiffProvider = this.getGitDiffProvider();
    const [changes, repoRoot, storyIndexGenerator] = await Promise.all([
      gitDiffProvider.getChangedFiles(),
      gitDiffProvider.getRepoRoot(),
      this.options.storyIndexGeneratorPromise,
    ]);

    const changedFiles = new Set(Array.from(changes.changed).map((path) => join(repoRoot, path)));
    const newFiles = new Set(Array.from(changes.new).map((path) => join(repoRoot, path)));
    const scannedFiles = new Set([...changedFiles, ...newFiles]);
    const normalizedModuleGraph = new Map<string, Set<ModuleNode>>();
    moduleGraph.forEach((nodes, filePath) => {
      const normalizedPath = normalizePath(filePath);
      const existingNodes = normalizedModuleGraph.get(normalizedPath);
      if (existingNodes) {
        nodes.forEach((node) => void existingNodes.add(node));
      } else {
        normalizedModuleGraph.set(normalizedPath, new Set(nodes));
      }
    });

    const storyIndex = await storyIndexGenerator.getIndex();
    const storyIdsByFile = getStoryIdsByAbsolutePath(storyIndex, this.workingDir);
    const statuses = new Map<string, Status>();

    for (const changedFile of scannedFiles) {
      const affectedStoryFiles = findAffectedStoryFiles(
        changedFile,
        normalizedModuleGraph,
        storyIdsByFile
      );
      const lowestDistance = Math.min(
        ...Array.from(affectedStoryFiles.values(), ({ distance }) => distance)
      );

      for (const [storyFile, { distance }] of affectedStoryFiles.entries()) {
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
          const changedStoryFiles = new Set<string>(existingStatus?.data?.changedFiles ?? []);
          changedStoryFiles.add(relative(repoRoot, changedFile));

          statuses.set(storyId, {
            storyId,
            typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
            value: mergeStatusValues(existingStatus?.value, value),
            title: '',
            description: '',
            data: {
              changedFiles: Array.from(changedStoryFiles).sort(),
            },
            sidebarContextMenu: false,
          });
        });
      }
    }

    return statuses;
  }

  private getGitDiffProvider(): GitDiffProvider {
    this.gitDiffProvider ??= new GitDiffProvider(this.workingDir);
    return this.gitDiffProvider;
  }

  private applyStatusStorePatch(nextStatuses: Map<string, Status>): void {
    const removedStoryIds = Array.from(this.previousStatuses.keys()).filter(
      (storyId) => !nextStatuses.has(storyId)
    );
    const changedStatuses = Array.from(nextStatuses.values()).filter(
      (status) => !isSameStatus(this.previousStatuses.get(status.storyId), status)
    );

    if (removedStoryIds.length > 0) {
      this.options.statusStore.unset(removedStoryIds);
    }

    if (changedStatuses.length > 0) {
      this.options.statusStore.set(changedStatuses);
    }

    this.previousStatuses = nextStatuses;
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

  private handleBuilderStartupEvent(
    event: Exclude<ModuleGraphChangeEvent, { type: 'moduleGraph' }>
  ): void {
    if (event.type === 'unavailable') {
      logger.warn(`Change detection unavailable: ${event.reason}`);
      this.resolveReadiness({
        status: 'unavailable',
        reason: event.reason,
        error: event.error,
      });
    } else {
      logger.error(`Change detection failed: ${event.error.message}`);
      this.resolveReadiness({
        status: 'error',
        error: event.error,
      });
    }

    void this.dispose();
  }
}
