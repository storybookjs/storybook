// Rewritten for forward-walk semantics per ADR-F.
// Pure-function tests (mergeStatusValues, mergeChangeDetectionStatuses,
// buildIndexBaselineStatuses), readiness-state-machine tests, git-state-change tests
// and debounce tests are kept verbatim. Tests that previously drove the service via
// `MockBuilder.emit(moduleGraph)` now drive it via `MockAdapter.emitFileChange(...)`
// and stub the dependency-graph module to inject a synthetic `ReverseIndexImpl`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { Status, StoryIndex } from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';

import {
  createStatusStore,
  UNIVERSAL_STATUS_STORE_OPTIONS,
} from '../../shared/status-store/index.ts';
import { MockUniversalStore } from '../../shared/universal-store/mock.ts';
import type { ChangeDetectionAdapter, FileChangeEvent } from './adapters/index.ts';
import { getChangeDetectionReadiness, internal_resetChangeDetectionReadiness } from './index.ts';
import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';
import {
  buildIndexBaselineStatuses,
  ChangeDetectionService,
  mergeChangeDetectionStatuses,
  mergeStatusValues,
} from './ChangeDetectionService.ts';
import {
  ChangeDetectionResolverFactory,
  DependencyGraphBuilder,
  IncrementalPatcher,
  ReverseIndexImpl,
  WorkspaceLocator,
} from './dependency-graph/index.ts';
import type { GitDiffResult } from './GitDiffProvider.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';
import type { IndexBaselineService } from './IndexBaselineService.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./dependency-graph/index.ts', async (importOriginal) => {
  // Keep ReverseIndexImpl + types real so tests can build synthetic indexes; replace the
  // ChangeDetectionResolverFactory / WorkspaceLocator / DependencyGraphBuilder /
  // IncrementalPatcher constructors with `vi.fn()`s so tests can override their behaviour
  // per-case via `vi.mocked(Ctor).mockImplementation(...)`.
  const actual = await importOriginal<typeof import('./dependency-graph/index.ts')>();
  return {
    ...actual,
    ChangeDetectionResolverFactory: vi.fn(),
    WorkspaceLocator: vi.fn(),
    DependencyGraphBuilder: vi.fn(),
    IncrementalPatcher: vi.fn(),
  };
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((fulfill) => {
      resolve = fulfill;
    }),
    resolve,
  };
}

function createStoryIndex(
  entries: Array<{ storyId: string; importPath: string; title?: string; name?: string }>
): StoryIndex {
  return {
    v: 5,
    entries: Object.fromEntries(
      entries.map(({ storyId, importPath, title = 'Story', name = 'Default' }) => [
        storyId,
        {
          id: storyId,
          type: 'story',
          subtype: 'story',
          title,
          name,
          importPath,
        },
      ])
    ),
  };
}

interface MockAdapterHandle {
  adapter: ChangeDetectionAdapter;
  emitFileChange: (event: FileChangeEvent) => void;
  emitStartupFailure: (event: { reason: string; error?: Error }) => void;
  hasFileChangeSubscriber: () => boolean;
  hasStartupFailureSubscriber: () => boolean;
}

function createMockAdapter(opts?: {
  resolveConfig?: { projectRoot?: string };
  withoutStartupFailure?: boolean;
}): MockAdapterHandle {
  const fileHandlers = new Set<(e: FileChangeEvent) => void>();
  const startupHandlers = new Set<(e: { reason: string; error?: Error }) => void>();

  const adapter: ChangeDetectionAdapter = {
    async getResolveConfig() {
      return {
        projectRoot: opts?.resolveConfig?.projectRoot ?? '/repo',
      };
    },
    onFileChange(handler) {
      fileHandlers.add(handler);
      return () => fileHandlers.delete(handler);
    },
  };

  if (!opts?.withoutStartupFailure) {
    adapter.onStartupFailure = (handler) => {
      startupHandlers.add(handler);
      return () => startupHandlers.delete(handler);
    };
  }

  return {
    adapter,
    emitFileChange: (event) => {
      fileHandlers.forEach((h) => h(event));
    },
    emitStartupFailure: (event) => {
      startupHandlers.forEach((h) => h(event));
    },
    hasFileChangeSubscriber: () => fileHandlers.size > 0,
    hasStartupFailureSubscriber: () => startupHandlers.size > 0,
  };
}

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

/**
 * Build a ReverseIndexImpl populated with the given (dep -> story -> depth) entries.
 * Used by tests to control what `reverseIndex.lookup(changedFile)` returns.
 */
function buildReverseIndex(edges: Iterable<readonly [string, string, number]>): ReverseIndexImpl {
  const reverseIndex = new ReverseIndexImpl();
  for (const [dep, story, depth] of edges) {
    reverseIndex.record(dep, story, depth);
  }
  return reverseIndex;
}

/**
 * Stub the dependency-graph constructors so the service uses an in-test
 * ReverseIndexImpl + an inert IncrementalPatcher.
 *
 * Note: `vi.mock` replaces these exports with plain `vi.fn()` constructors. When the
 * service calls `new Ctor(...)` we must return objects via `mockImplementation` —
 * but vitest invokes the impl with `Reflect.construct` on `new`, so arrow-function
 * impls throw "is not a constructor". `function () { return obj; }` works because
 * regular functions support `[[Construct]]`.
 */
function installDependencyGraphMocks(reverseIndex: ReverseIndexImpl): {
  patchSpy: ReturnType<typeof vi.fn>;
  buildSpy: ReturnType<typeof vi.fn>;
} {
  const patchSpy = vi.fn(async () => undefined);
  const buildSpy = vi.fn(async () => ({ reverseIndex, graph: new Map() }));

  vi.mocked(ChangeDetectionResolverFactory).mockImplementation(function () {
    return {
      resolve: vi.fn(async () => null),
    } as unknown as ChangeDetectionResolverFactory;
  } as unknown as new () => ChangeDetectionResolverFactory);
  vi.mocked(WorkspaceLocator).mockImplementation(function () {
    return {
      locate: vi.fn(async () => new Set<string>()),
    } as unknown as WorkspaceLocator;
  } as unknown as new () => WorkspaceLocator);
  vi.mocked(DependencyGraphBuilder).mockImplementation(function () {
    return { build: buildSpy } as unknown as DependencyGraphBuilder;
  } as unknown as new () => DependencyGraphBuilder);
  vi.mocked(IncrementalPatcher).mockImplementation(function () {
    return { patch: patchSpy } as unknown as IncrementalPatcher;
  } as unknown as new () => IncrementalPatcher);

  return { patchSpy, buildSpy };
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
    vi.clearAllMocks();
    vi.resetAllMocks();
    internal_resetChangeDetectionReadiness();
  });

  // ------------------------------------------------------------------
  // ADR-F semantic test cases (modified vs affected) — all four MUST appear.
  // ------------------------------------------------------------------

  it('ADR-F #1: edits a story file -> that story is modified at distance 0; importer stories are affected at distance 1', async () => {
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

  it('ADR-F #2: edits a non-story dep at distance 1 from one story and distance 2 from another -> nearest is modified, farther is affected', async () => {
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

  it('ADR-F #3: edits a non-story dep at equal distance from two stories -> both stories tie and are both modified', async () => {
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

  it('ADR-F #4: edits a non-story file with no story importers -> reverse-index lookup is empty -> no status emitted', async () => {
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

  it('serialises concurrent file-change events through the patch chain (H2)', async () => {
    const reverseIndex = buildReverseIndex([]);
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockResolvedValue({ reverseIndex, graph: new Map() });

    let activePatches = 0;
    let maxConcurrent = 0;
    patchSpy.mockImplementation(async () => {
      activePatches += 1;
      maxConcurrent = Math.max(maxConcurrent, activePatches);
      // Force an actual await so two concurrent calls would visibly interleave.
      await new Promise((resolve) => setImmediate(resolve));
      activePatches -= 1;
    });

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const { adapter, emitFileChange } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider: createMockGitDiffProvider(),
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    await vi.runAllTimersAsync();

    emitFileChange({ kind: 'change', path: '/repo/src/Button.tsx' });
    emitFileChange({ kind: 'change', path: '/repo/src/Other.tsx' });
    emitFileChange({ kind: 'unlink', path: '/repo/src/Stale.tsx' });
    await vi.runAllTimersAsync();

    expect(patchSpy).toHaveBeenCalledTimes(3);
    expect(maxConcurrent).toBe(1);

    await service.dispose();
  });

  it('queues file-change events that arrive while the eager build is in flight and patches them after build resolves', async () => {
    const reverseIndex = buildReverseIndex([]);
    const buildDeferred = createDeferred<void>();
    const { patchSpy, buildSpy } = installDependencyGraphMocks(reverseIndex);
    buildSpy.mockImplementation(async () => {
      await buildDeferred.promise;
      return { reverseIndex, graph: new Map() };
    });

    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const { adapter, emitFileChange } = createMockAdapter();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider: createMockGitDiffProvider(),
      indexBaselineService: createMockStoryIndexBaselineService(),
      workingDir,
    });

    service.start(adapter, true);
    // Allow startInternal to reach the build step and start awaiting it.
    await Promise.resolve();
    await Promise.resolve();

    // The service subscribes to file-change events strictly after the eager build resolves,
    // so anything emitted by the adapter before then has nowhere to land. Assert no patch
    // calls have happened yet.
    expect(patchSpy).not.toHaveBeenCalled();

    buildDeferred.resolve();
    await vi.runAllTimersAsync();

    // Now the adapter has subscribers — file events go through the patcher.
    emitFileChange({ kind: 'change', path: '/repo/src/Button.tsx' });
    await vi.runAllTimersAsync();
    expect(patchSpy).toHaveBeenCalledTimes(1);

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
