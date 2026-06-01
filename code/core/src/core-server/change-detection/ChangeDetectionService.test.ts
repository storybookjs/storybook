import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { Status, StoryIndex } from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';

import {
  createStatusStore,
  UNIVERSAL_STATUS_STORE_OPTIONS,
} from '../../shared/status-store/index.ts';
import { MockUniversalStore } from '../../shared/universal-store/mock.ts';
import * as oxcParser from 'storybook/internal/oxc-parser';

import {
  buildReverseIndex,
  createDeferred,
  createMockAdapter,
  createStoryIndex,
  installDependencyGraphMocks,
} from './change-detection.test-helpers.ts';
import {
  buildIndexBaselineStatuses,
  ChangeDetectionService,
  mergeChangeDetectionStatuses,
  mergeStatusValues,
} from './ChangeDetectionService.ts';
import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';
import { getChangeDetectionReadiness, internal_resetChangeDetectionReadiness } from './index.ts';
import type { GitDiffResult } from './GitDiffProvider.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';
import type { IndexBaselineService } from './IndexBaselineService.ts';
import type { StoryDependencyGraphService } from './StoryDependencyGraphService.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./dependency-graph/index.ts', async (importOriginal) => {
  // Keep ReverseIndexImpl + types real so tests can build synthetic indexes; replace the
  // ChangeDetectionResolverFactory / DependencyGraphBuilder / IncrementalPatcher constructors
  // with `vi.fn()`s so tests can override their behaviour per-case via
  // `vi.mocked(Ctor).mockImplementation(...)`.
  const actual = await importOriginal<typeof import('./dependency-graph/index.ts')>();
  return {
    ...actual,
    ChangeDetectionResolverFactory: vi.fn(),
    DependencyGraphBuilder: vi.fn(),
    IncrementalPatcher: vi.fn(),
  };
});

class MockGitDiffProvider extends GitDiffProvider {
  readonly getChangedFilesMock = vi.fn(
    async (): Promise<GitDiffResult> => ({
      changed: new Set(),
      new: new Set(),
    })
  );

  readonly getRepoRootMock = vi.fn(async (): Promise<string> => '/repo');

  readonly onGitStateChangeMock = vi.fn<(callback: () => void) => void>((callback) => {
    void callback;
  });
  readonly isWorkingTreeCleanMock = vi.fn(async (): Promise<boolean> => true);
  readonly getHeadCommitMock = vi.fn(async (): Promise<string> => 'mock-sha');
  readonly disposeMock = vi.fn(() => undefined);

  constructor() {
    super('/repo');
  }

  override getChangedFiles(): Promise<GitDiffResult> {
    return this.getChangedFilesMock();
  }

  override getRepoRoot(): Promise<string> {
    return this.getRepoRootMock();
  }

  override onGitStateChange(callback: () => void): void {
    this.onGitStateChangeMock(callback);
  }

  override isWorkingTreeClean(): Promise<boolean> {
    return this.isWorkingTreeCleanMock();
  }

  override getHeadCommit(): Promise<string> {
    return this.getHeadCommitMock();
  }

  override dispose(): void {
    this.disposeMock();
  }
}

function createMockGitDiffProvider(configure?: (provider: MockGitDiffProvider) => void) {
  const provider = new MockGitDiffProvider();
  configure?.(provider);
  return provider;
}

function createMockStoryIndexBaselineService(
  entryIds: Set<string> = new Set()
): IndexBaselineService {
  return {
    start: vi.fn(async () => undefined),
    getBaselineEntryIds: vi.fn(async () => new Set(entryIds)),
    handleGitStateChange: vi.fn(async () => undefined),
  } as unknown as IndexBaselineService;
}

function createStatus(value: Status['value'], data?: Status['data']): Status {
  return {
    storyId: 'story-1',
    typeId: 'storybook/change-detection',
    value,
    title: '',
    description: '',
    ...(data ? { data } : {}),
    sidebarContextMenu: false,
  };
}

describe('ChangeDetectionService', () => {
  const workingDir = '/repo';

  beforeEach(() => {
    vi.useFakeTimers();
    internal_resetChangeDetectionReadiness();
    vi.mocked(logger.info).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
    vi.mocked(logger.error).mockImplementation(() => undefined);
    vi.mocked(logger.debug).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    internal_resetChangeDetectionReadiness();
  });

  it('edits a story file -> that story is modified at distance 0; importer stories are affected at distance 1', async () => {
    // Story A is the changed file (distance 0). Story B imports A (distance 1).
    // Reverse index models forward-walk depths: A reaches itself at 0; B reaches A at 1.
    const reverseIndex = buildReverseIndex([
      ['/repo/src/A.stories.tsx', '/repo/src/A.stories.tsx', 0],
      ['/repo/src/A.stories.tsx', '/repo/src/B.stories.tsx', 1],
      ['/repo/src/B.stories.tsx', '/repo/src/B.stories.tsx', 0],
    ]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      { storyId: 'a--default', importPath: './src/A.stories.tsx', title: 'A' },
      { storyId: 'b--default', importPath: './src/B.stories.tsx', title: 'B' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockResolvedValue({
        changed: new Set(['src/A.stories.tsx']),
        new: new Set(),
      });
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'a--default': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'a--default',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:modified',
          title: '',
          description: '',
          sidebarContextMenu: false,
        },
      },
      'b--default': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'b--default',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:affected',
          title: '',
          description: '',
          sidebarContextMenu: false,
        },
      },
    });
    await service.dispose();
  });

  it('edits a non-story dep at distance 1 from one story and distance 2 from another -> nearest is modified, farther is affected', async () => {
    // Button.tsx is imported by Button.stories.tsx (distance 1) and by Compositions.stories.tsx
    // transitively via the Button story chain (distance 2).
    const reverseIndex = buildReverseIndex([
      ['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1],
      ['/repo/src/Button.tsx', '/repo/src/Compositions.stories.tsx', 2],
    ]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      {
        storyId: 'button--primary',
        importPath: './src/Button.stories.tsx',
        title: 'Button',
      },
      {
        storyId: 'compositions--default',
        importPath: './src/Compositions.stories.tsx',
        title: 'Compositions',
      },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockResolvedValue({
        changed: new Set(['src/Button.tsx']),
        new: new Set(),
      });
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    const all = getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll();
    expect(all['button--primary'][CHANGE_DETECTION_STATUS_TYPE_ID].value).toBe(
      'status-value:modified'
    );
    expect(all['compositions--default'][CHANGE_DETECTION_STATUS_TYPE_ID].value).toBe(
      'status-value:affected'
    );
    await service.dispose();
  });

  it('edits a non-story dep at equal distance from two stories -> both stories tie and are both modified', async () => {
    // Both Button.stories.tsx and Header.stories.tsx import shared.ts at distance 1.
    const reverseIndex = buildReverseIndex([
      ['/repo/src/shared.ts', '/repo/src/Button.stories.tsx', 1],
      ['/repo/src/shared.ts', '/repo/src/Header.stories.tsx', 1],
    ]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
      { storyId: 'header--default', importPath: './src/Header.stories.tsx', title: 'Header' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockResolvedValue({
        changed: new Set(['src/shared.ts']),
        new: new Set(),
      });
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    const all = getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll();
    expect(all['button--primary'][CHANGE_DETECTION_STATUS_TYPE_ID].value).toBe(
      'status-value:modified'
    );
    expect(all['header--default'][CHANGE_DETECTION_STATUS_TYPE_ID].value).toBe(
      'status-value:modified'
    );
    await service.dispose();
  });

  it('edits a non-story file with no story importers -> reverse-index lookup is empty -> no status emitted', async () => {
    // orphan.ts is in neither the reverse index nor the story index.
    const reverseIndex = buildReverseIndex([
      ['/repo/src/Button.tsx', '/repo/src/Button.stories.tsx', 1],
    ]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockResolvedValue({
        changed: new Set(['src/orphan.ts']),
        new: new Set(),
      });
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({});
    expect(await getChangeDetectionReadiness()).toEqual({ status: 'ready' });
    await service.dispose();
  });

  // ------------------------------------------------------------------
  // Orchestration / merge-status / readiness / git-state / debounce tests.
  // ------------------------------------------------------------------

  it('marks new story files from the git new set and unsets them after they are reverted', async () => {
    installDependencyGraphMocks(buildReverseIndex([]));

    const storyIndex = createStoryIndex([
      {
        storyId: 'new-button--primary',
        importPath: './src/NewButton.stories.tsx',
        title: 'NewButton',
      },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock
        .mockResolvedValueOnce({
          changed: new Set(),
          new: new Set(['src/NewButton.stories.tsx']),
        })
        .mockResolvedValueOnce({
          changed: new Set(),
          new: new Set(),
        });
    });
    let onGitStateChange: (() => void) | undefined;
    gitDiffProvider.onGitStateChangeMock.mockImplementation((callback: () => void) => {
      onGitStateChange = callback;
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 10,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'new-button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'new-button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:new',
          title: '',
          description: '',
          sidebarContextMenu: false,
        },
      },
    });

    onGitStateChange?.();
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'new-button--primary': {},
    });
    await service.dispose();
  });

  it('replaces prior scan status data instead of cumulatively merging with store state', async () => {
    const reverseIndex = buildReverseIndex([
      ['/repo/src/depB.ts', '/repo/src/Button.stories.tsx', 1],
      ['/repo/src/depA.ts', '/repo/src/Button.stories.tsx', 1],
    ]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock
        .mockResolvedValueOnce({
          changed: new Set(),
          new: new Set(['src/Button.stories.tsx']),
        })
        .mockResolvedValueOnce({
          changed: new Set(['src/depB.ts']),
          new: new Set(),
        });
    });
    let onGitStateChange: (() => void) | undefined;
    gitDiffProvider.onGitStateChangeMock.mockImplementation((callback: () => void) => {
      onGitStateChange = callback;
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 10,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:new',
          title: '',
          description: '',
          sidebarContextMenu: false,
        },
      },
    });

    onGitStateChange?.();
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:modified',
          title: '',
          description: '',
          sidebarContextMenu: false,
        },
      },
    });
    await service.dispose();
  });

  it('rescans on git state changes using the normal debounce', async () => {
    const reverseIndex = buildReverseIndex([
      ['/repo/src/Button.stories.tsx', '/repo/src/Button.stories.tsx', 0],
    ]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    let onGitStateChange: (() => void) | undefined;
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockResolvedValue({
        changed: new Set(['src/Button.stories.tsx']),
        new: new Set(),
      });
      provider.onGitStateChangeMock.mockImplementation((callback: () => void) => {
        onGitStateChange = callback;
      });
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 10,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    expect(gitDiffProvider.onGitStateChangeMock).toHaveBeenCalledTimes(1);
    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(1);

    onGitStateChange?.();
    await vi.advanceTimersByTimeAsync(9);

    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(2);

    await service.dispose();
  });

  it('debounces consecutive file-change events into a single scan', async () => {
    installDependencyGraphMocks(buildReverseIndex([]));

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider();
    const { adapter, emitFileChange } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 50,
    });

    service.start(adapter, true);
    // First scan from initial start — debounce 0 runs synchronously.
    await vi.runAllTimersAsync();
    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(1);

    // Three file-change events within the debounce window collapse to one scan.
    emitFileChange({ kind: 'change', path: '/repo/src/A.ts' });
    await vi.advanceTimersByTimeAsync(10);
    emitFileChange({ kind: 'change', path: '/repo/src/B.ts' });
    await vi.advanceTimersByTimeAsync(10);
    emitFileChange({ kind: 'change', path: '/repo/src/C.ts' });
    await vi.advanceTimersByTimeAsync(10);

    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(50);

    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(2);

    await service.dispose();
  });

  it('does not subscribe to git state when change detection is disabled', async () => {
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider();
    const { adapter, hasFileChangeSubscriber } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn(),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, false);

    expect(hasFileChangeSubscriber()).toBe(false);
    expect(gitDiffProvider.onGitStateChangeMock).not.toHaveBeenCalled();
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'unavailable',
      reason: 'disabled',
    });
    await service.dispose();
  });

  it('acts as a consumer when an external graph is injected', async () => {
    const graph = {
      start: vi.fn(),
      dispose: vi.fn(async () => undefined),
      whenSettled: vi.fn(async () => undefined),
      hasGraph: vi.fn(() => false),
      lookup: vi.fn(() => new Map<string, number>()),
    } as unknown as StoryDependencyGraphService;
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const service = new ChangeDetectionService({
      graph,
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn(),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider: createMockGitDiffProvider(),
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(undefined, false);
    await service.dispose();

    expect(graph.start).not.toHaveBeenCalled();
    expect(graph.dispose).not.toHaveBeenCalled();
  });

  it('logs unavailability when the builder does not provide an adapter', async () => {
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn(),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider: createMockGitDiffProvider(),
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(undefined, true);

    expect(logger.warn).toHaveBeenCalledWith(
      'Change detection unavailable: builder does not support change detection'
    );
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'unavailable',
      reason: 'builder does not support change detection',
    });
    await service.dispose();
  });

  it('resolves readiness as unavailable when the adapter reports a startup failure', async () => {
    // Park git lookup so the initial scan never resolves to 'ready' before we emit the failure.
    const gitDeferred = createDeferred<GitDiffResult>();
    installDependencyGraphMocks(buildReverseIndex([]));

    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockImplementation(() => gitDeferred.promise);
    });
    const { adapter, emitStartupFailure } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(createStoryIndex([])),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    // Let startInternal subscribe before emitting the failure (initial scan parked on git).
    await vi.runAllTimersAsync();

    emitStartupFailure({ reason: 'vite warmup failed', error: new Error('warmup failed') });
    await vi.runAllTimersAsync();

    expect(logger.warn).toHaveBeenCalledWith('Change detection unavailable: vite warmup failed');
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'unavailable',
      reason: 'vite warmup failed',
      error: expect.objectContaining({ message: 'warmup failed' }),
    });
    // Unblock the parked git call so dispose can drain.
    gitDeferred.resolve({ changed: new Set(), new: new Set() });
    await service.dispose();
  });

  it('resolves readiness as error when the eager build throws', async () => {
    const { buildSpy } = installDependencyGraphMocks(buildReverseIndex([]));
    buildSpy.mockImplementation(async () => {
      throw new ChangeDetectionFailureError('graph build blew up');
    });

    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(createStoryIndex([])),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider: createMockGitDiffProvider(),
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    expect(logger.error).toHaveBeenCalledWith(
      'Change detection failed to start: graph build blew up'
    );
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'error',
      error: expect.objectContaining({ message: 'graph build blew up' }),
    });
    await service.dispose();
  });

  it('disposes the pool when startInternal throws', async () => {
    // The startInternal pipeline throws after startup. Without the dispose() call in the
    // catch handler disposeOxcParsePool would not be called.
    const { buildSpy } = installDependencyGraphMocks(buildReverseIndex([]));
    buildSpy.mockImplementation(async () => {
      throw new ChangeDetectionFailureError('graph build blew up');
    });

    const disposePoolSpy = vi.spyOn(oxcParser, 'disposeOxcParsePool').mockResolvedValue(undefined);

    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(createStoryIndex([])),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider: createMockGitDiffProvider(),
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    // dispose() must have been called, which calls disposeOxcParsePool exactly once.
    expect(disposePoolSpy).toHaveBeenCalledTimes(1);

    await service.dispose();
  });

  it('keeps the previous statuses when a live rescan fails', async () => {
    const reverseIndex = buildReverseIndex([
      ['/repo/src/Button.stories.tsx', '/repo/src/Button.stories.tsx', 0],
    ]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock
        .mockResolvedValueOnce({
          changed: new Set(['src/Button.stories.tsx']),
          new: new Set(),
        })
        .mockRejectedValueOnce(new ChangeDetectionFailureError('scan blew up'));
    });
    let onGitStateChange: (() => void) | undefined;
    gitDiffProvider.onGitStateChangeMock.mockImplementation((callback: () => void) => {
      onGitStateChange = callback;
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 10,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    onGitStateChange?.();
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:modified',
          title: '',
          description: '',
          sidebarContextMenu: false,
        },
      },
    });
    expect(logger.error).toHaveBeenCalledWith('Change detection failed: scan blew up');
    await service.dispose();
  });

  it('does not apply scan results or rerun after disposal', async () => {
    const reverseIndex = buildReverseIndex([
      ['/repo/src/Button.stories.tsx', '/repo/src/Button.stories.tsx', 0],
    ]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const changedFilesDeferred = createDeferred<{
      changed: Set<string>;
      new: Set<string>;
    }>();
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockImplementation(() => changedFilesDeferred.promise);
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 0,
    });

    service.start(adapter, true);
    await vi.advanceTimersByTimeAsync(0);
    await service.dispose();

    changedFilesDeferred.resolve({
      changed: new Set(['src/Button.stories.tsx']),
      new: new Set(),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({});
    await expect(
      Promise.race([
        getChangeDetectionReadiness().then(() => 'resolved'),
        Promise.resolve('pending'),
      ])
    ).resolves.toBe('pending');
  });

  it('tears down after a permanently unavailable scan result', async () => {
    installDependencyGraphMocks(buildReverseIndex([]));

    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockRejectedValue(
        new ChangeDetectionUnavailableError('not a git repository')
      );
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(createStoryIndex([])),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 0,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Change detection unavailable: not a git repository');
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'unavailable',
      reason: 'not a git repository',
      error: expect.any(ChangeDetectionUnavailableError),
    });
    await service.dispose();
  });

  it('scan waits for the current patch to settle before reading reverseIndex', async () => {
    // Without the patchSnapshot await in scan(), a git-state-change that fires scheduleScan
    // while a patch is mid-rewalk (reverseIndex transiently empty) reads the empty index
    // and publishes no statuses even though the patch will eventually add entries back.
    const reverseIndex = buildReverseIndex([]);
    const patchDeferred = createDeferred<void>();
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockResolvedValue({ reverseIndex, graph: new Map() });

    // The first patch call blocks; during that block a scan is scheduled. After the patch
    // resolves, reverseIndex has a real entry that the scan should see.
    patchSpy.mockImplementationOnce(async () => {
      await patchDeferred.promise;
      reverseIndex.record('/repo/src/Button.stories.tsx', '/repo/src/Button.stories.tsx', 0);
    });

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockResolvedValue({
        changed: new Set(['src/Button.stories.tsx']),
        new: new Set(),
      });
    });
    let triggerGitStateChange: (() => void) | undefined;
    gitDiffProvider.onGitStateChangeMock.mockImplementation((callback: () => void) => {
      triggerGitStateChange = callback;
    });
    const { adapter, emitFileChange } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 0,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    // Start a patch that will block, then immediately schedule a scan mid-patch.
    emitFileChange({ kind: 'change', path: '/repo/src/Button.stories.tsx' });
    triggerGitStateChange?.();

    // Unblock the patch — now the reverseIndex has the entry.
    patchDeferred.resolve();
    await vi.runAllTimersAsync();

    // The scan that ran after the patch settled should have seen the populated reverseIndex.
    const all = getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll();
    expect(all['button--primary']?.[CHANGE_DETECTION_STATUS_TYPE_ID]?.value).toBe(
      'status-value:modified'
    );

    await service.dispose();
  });

  it('calls gitDiffProvider.dispose() on service dispose when a git watcher was installed', async () => {
    // Watcher leak: onGitStateChange installs FS watchers; without dispose() the watchers
    // survive the service lifetime and fire stale callbacks on long-lived processes.
    installDependencyGraphMocks(buildReverseIndex([]));

    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      // Simulate having called onGitStateChange (watcher installed).
      provider.onGitStateChangeMock.mockImplementation(() => undefined);
    });
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(createStoryIndex([])),
      } as never),
      statusStore: createStatusStore({
        universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
        environment: 'server',
      }).getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    await service.dispose();

    expect(gitDiffProvider.disposeMock).toHaveBeenCalledTimes(1);
  });

  it('does not call gitDiffProvider.dispose() when the provider was never constructed by the service', async () => {
    // If gitDiffProvider is never passed in and start() exits early (disabled), the service
    // never lazily constructs a provider, so dispose() must not create one just to tear it down.
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn(),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      // No gitDiffProvider injected — service would lazily create one, but start(false) exits
      // before getGitDiffProvider() is called.
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(undefined, false);
    // Should not throw and should not attempt to call dispose on an unconstructed provider.
    await expect(service.dispose()).resolves.toBeUndefined();
  });

  it('rescans the working tree when the story index is invalidated', async () => {
    // Graph-side reconciliation (replaying add/unlink, the refreshInFlight guard) is covered by
    // StoryDependencyGraphService.test.ts; here we assert the status side of the seam: an index
    // invalidation re-runs the git-diff scan.
    const reverseIndex = buildReverseIndex([]);
    installDependencyGraphMocks(reverseIndex);

    const storyIndex = createStoryIndex([
      { storyId: 'a--default', importPath: './src/A.stories.tsx', title: 'A' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider();
    const { adapter } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
      debounceMs: 10,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();
    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(1);

    service.onGraphChange();
    await vi.runAllTimersAsync();
    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(2);

    await service.dispose();
  });
});

describe('mergeStatusValues', () => {
  it('prioritizes status-value:new over modified and affected', () => {
    expect(mergeStatusValues('status-value:modified', 'status-value:new')).toBe('status-value:new');
    expect(mergeStatusValues('status-value:new', 'status-value:affected')).toBe('status-value:new');
  });

  it('prioritizes status-value:modified over affected', () => {
    expect(mergeStatusValues('status-value:affected', 'status-value:modified')).toBe(
      'status-value:modified'
    );
  });
});

describe('mergeChangeDetectionStatuses', () => {
  it('keeps status-value:new when later status is modified', () => {
    const existing = createStatus('status-value:new');
    const incoming = createStatus('status-value:modified');

    const result = mergeChangeDetectionStatuses(existing, incoming);

    expect(result.value).toBe('status-value:new');
  });

  it('prefers incoming data without merging previous payloads', () => {
    const existing = createStatus('status-value:new', { source: 'previous' });
    const incoming = createStatus('status-value:modified', { source: 'next' });

    const result = mergeChangeDetectionStatuses(existing, incoming);

    expect(result.data).toEqual({ source: 'next' });
  });
});

describe('buildIndexBaselineStatuses', () => {
  it('creates status-value:new for entries not present in baseline', () => {
    const storyIndex: StoryIndex = {
      v: 5,
      entries: {
        a: {
          id: 'a',
          type: 'story',
          subtype: 'story',
          title: 'A',
          name: 'A',
          importPath: './a.stories.ts',
        },
        b: {
          id: 'b',
          type: 'docs',
          title: 'B',
          name: 'B',
          importPath: './b.mdx',
          storiesImports: [],
        },
      },
    };

    const statuses = buildIndexBaselineStatuses(storyIndex, new Set(['a']));

    expect(statuses.get('b')).toMatchObject({
      storyId: 'b',
      value: 'status-value:new',
    });
    expect(statuses.has('a')).toBe(false);
  });
});
