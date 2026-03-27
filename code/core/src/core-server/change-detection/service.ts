import { resolve } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import type { Builder, ModuleGraph, Status, StatusStoreByTypeId } from 'storybook/internal/types';

import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator';
import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors';
import { GitDiffProvider } from './git-diff-provider';
import { resetChangeDetectionReadiness, setChangeDetectionReadiness } from './readiness';
import { findAffectedStoryFiles } from './trace-changed';

const CHANGE_DETECTION_DEBOUNCE_MS = 200;

export const CHANGE_DETECTION_STATUS_TYPE_ID = 'storybook/change-detection';

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
    if (entry.type !== 'story' || entry.importPath.startsWith('virtual:')) {
      return;
    }

    const absolutePath = resolve(workingDir, entry.importPath);
    // logger.info(`Story ${entry.id} absolute path: ${absolutePath}`);
    const storyIds = storyIdsByFile.get(absolutePath) ?? new Set<string>();
    storyIds.add(entry.id);
    storyIdsByFile.set(absolutePath, storyIds);
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

export class ChangeDetectionService {
  private unsubscribe: (() => void) | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private latestModuleGraph: ModuleGraph | undefined;
  private hasReceivedModuleGraph = false;
  private scanInFlight = false;
  private rerunAfterCurrentScan = false;
  private readinessResolved = false;
  private previousStatuses = new Map<string, Status>();

  constructor(
    private readonly options: {
      storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
      statusStore: StatusStoreByTypeId;
      gitDiffProvider?: Pick<GitDiffProvider, 'getChangedFiles' | 'getRepoRoot'>;
      workingDir?: string;
      debounceMs?: number;
    }
  ) {
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
    this.unsubscribe = onModuleGraphChange((moduleGraph) => {
      this.latestModuleGraph = moduleGraph;
      this.scheduleScan(this.hasReceivedModuleGraph ? this.getDebounceMs() : 0);
      this.hasReceivedModuleGraph = true;
    });
  }

  async dispose(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private getGitDiffProvider(): Pick<GitDiffProvider, 'getChangedFiles' | 'getRepoRoot'> {
    return this.options.gitDiffProvider ?? new GitDiffProvider(this.getWorkingDir());
  }

  private getWorkingDir(): string {
    return this.options.workingDir ?? process.cwd();
  }

  private getDebounceMs(): number {
    return this.options.debounceMs ?? CHANGE_DETECTION_DEBOUNCE_MS;
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
    if (!this.latestModuleGraph) {
      return;
    }

    if (this.scanInFlight) {
      this.rerunAfterCurrentScan = true;
      return;
    }

    this.scanInFlight = true;

    try {
      const nextStatuses = await this.buildStatuses(this.latestModuleGraph);
      this.applyPatch(nextStatuses);
      this.resolveReadiness({ status: 'ready' });
    } catch (error) {
      if (error instanceof ChangeDetectionUnavailableError) {
        logger.warn(`Change detection unavailable: ${error.message}`);
        this.resolveReadiness({
          status: 'unavailable',
          reason: error.message,
          error,
        });
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

      if (this.rerunAfterCurrentScan) {
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

    const changedFiles = Array.from(changes.changed).map((filePath) => resolve(repoRoot, filePath));
    const newFiles = Array.from(changes.new).map((filePath) => resolve(repoRoot, filePath));

    const storyIndex = await storyIndexGenerator.getIndex();
    const workingDir = this.getWorkingDir();
    const storyIdsByFile = getStoryIdsByAbsolutePath(storyIndex, workingDir);
    const statuses = new Map<string, Status>();

    for (const changedFile of changedFiles) {
      const affectedStoryFiles = findAffectedStoryFiles(changedFile, moduleGraph, storyIdsByFile);
      const lowestDistance = Math.min(
        ...Array.from(affectedStoryFiles.values(), ({ distance }) => distance)
      );

      for (const [storyFile, { distance }] of affectedStoryFiles.entries()) {
        const storyIds = storyIdsByFile.get(storyFile);
        if (!storyIds) {
          continue;
        }

        const value = newFiles.includes(storyFile)
          ? 'status-value:new'
          : distance === lowestDistance
            ? 'status-value:modified'
            : 'status-value:affected';

        storyIds.forEach((storyId) => {
          const existingStatus = statuses.get(storyId);
          const changedStoryFiles = new Set<string>(existingStatus?.data?.changedFiles ?? []);
          changedStoryFiles.add(changedFile.replace(`${repoRoot}/`, ''));

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

  private applyPatch(nextStatuses: Map<string, Status>): void {
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
}
