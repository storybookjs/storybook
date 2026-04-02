import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type {
  Builder,
  ModuleGraph,
  ModuleGraphChangeEvent,
  ModuleNode,
  StoryIndex,
} from 'storybook/internal/types';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from 'storybook/internal/types';

import {
  createStatusStore,
  UNIVERSAL_STATUS_STORE_OPTIONS,
} from '../../shared/status-store/index.ts';
import { MockUniversalStore } from '../../shared/universal-store/mock.ts';
import { getChangeDetectionReadiness, internal_resetChangeDetectionReadiness } from './index.ts';
import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';
import { ChangeDetectionService } from './ChangeDetectionService.ts';
import type { GitDiffResult } from './GitDiffProvider.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((fulfill) => {
      resolve = fulfill;
    }),
    resolve,
  };
}

function createModuleNode(file: string): ModuleNode {
  return {
    file,
    type: 'js',
    importers: new Set(),
    importedModules: new Set(),
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

function createBuilder() {
  let onModuleGraphChange: ((event: ModuleGraphChangeEvent) => void) | undefined;

  const builder = {
    onModuleGraphChange: vi.fn((callback: (event: ModuleGraphChangeEvent) => void) => {
      onModuleGraphChange = callback;
      return vi.fn(() => {
        onModuleGraphChange = undefined;
      });
    }),
  } as unknown as Builder<unknown>;

  return {
    builder,
    emit(moduleGraph: ModuleGraph) {
      onModuleGraphChange?.({ type: 'moduleGraph', moduleGraph });
    },
    emitUnavailable(reason: string, error?: Error) {
      onModuleGraphChange?.({ type: 'unavailable', reason, error });
    },
    emitError(error: Error) {
      onModuleGraphChange?.({ type: 'error', error });
    },
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
}

function createMockGitDiffProvider(configure?: (provider: MockGitDiffProvider) => void) {
  const provider = new MockGitDiffProvider();
  configure?.(provider);
  return provider;
}

describe('ChangeDetectionService', () => {
  const workingDir = '/repo';

  beforeEach(() => {
    vi.useFakeTimers();
    internal_resetChangeDetectionReadiness();
    vi.mocked(logger.info).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
    vi.mocked(logger.error).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    internal_resetChangeDetectionReadiness();
  });

  it('marks only the nearest stories as modified', async () => {
    const buttonCss = createModuleNode('/repo/src/Button.module.css');
    const buttonComponent = createModuleNode('/repo/src/Button.tsx');
    const buttonStory = createModuleNode('/repo/src/Button.stories.tsx');
    const headerComponent = createModuleNode('/repo/src/Header.tsx');
    const headerStory = createModuleNode('/repo/src/Header.stories.tsx');

    buttonCss.importers.add(buttonComponent);
    buttonComponent.importers.add(buttonStory);
    buttonComponent.importers.add(headerComponent);
    headerComponent.importers.add(headerStory);

    const moduleGraph: ModuleGraph = new Map([
      ['/repo/src/Button.module.css', new Set([buttonCss])],
      ['/repo/src/Button.tsx', new Set([buttonComponent])],
      ['/repo/src/Button.stories.tsx', new Set([buttonStory])],
      ['/repo/src/Header.tsx', new Set([headerComponent])],
      ['/repo/src/Header.stories.tsx', new Set([headerStory])],
    ]);
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
        changed: new Set(['src/Button.module.css']),
        new: new Set(),
      });
    });
    const { builder, emit } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
    });

    service.start(builder.onModuleGraphChange, true);
    emit(moduleGraph);
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:modified',
          title: '',
          description: '',
          data: {
            changedFiles: ['src/Button.module.css'],
          },
          sidebarContextMenu: false,
        },
      },
      'header--default': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'header--default',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:affected',
          title: '',
          description: '',
          data: {
            changedFiles: ['src/Button.module.css'],
          },
          sidebarContextMenu: false,
        },
      },
    });
    expect(await getChangeDetectionReadiness()).toEqual({ status: 'ready' });
    await service.dispose();
  });

  it('marks new story files from the git new set and unsets them after they are reverted', async () => {
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
    const { builder, emit } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
      debounceMs: 10,
    });

    service.start(builder.onModuleGraphChange, true);
    emit(new Map());
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'new-button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'new-button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:new',
          title: '',
          description: '',
          data: {
            changedFiles: ['src/NewButton.stories.tsx'],
          },
          sidebarContextMenu: false,
        },
      },
    });

    emit(new Map());
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'new-button--primary': {},
    });
    await service.dispose();
  });

  it('rescans on git state changes using the normal debounce', async () => {
    const buttonStory = createModuleNode('/repo/src/Button.stories.tsx');
    const moduleGraph: ModuleGraph = new Map([
      ['/repo/src/Button.stories.tsx', new Set([buttonStory])],
    ]);
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
    const { builder, emit } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
      debounceMs: 10,
    });

    service.start(builder.onModuleGraphChange, true);
    emit(moduleGraph);
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

  it('does not subscribe to git state when change detection is disabled', async () => {
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider();
    const { builder } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn(),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
    });

    service.start(builder.onModuleGraphChange, false);

    expect(builder.onModuleGraphChange).not.toHaveBeenCalled();
    expect(gitDiffProvider.onGitStateChangeMock).not.toHaveBeenCalled();
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'unavailable',
      reason: 'disabled',
    });
    await service.dispose();
  });

  it('logs unavailability when the builder does not expose module graph changes', async () => {
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
      workingDir,
    });

    service.start(undefined, true);

    expect(logger.warn).toHaveBeenCalledWith(
      'Change detection unavailable: Not supported by builder'
    );
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'unavailable',
      reason: 'builder does not support module graph',
    });
    await service.dispose();
  });

  it('resolves readiness when the builder reports change detection startup failure', async () => {
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider();
    const { builder, emitError } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn(),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
    });

    service.start(builder.onModuleGraphChange, true);
    emitError(new Error('module graph warmup failed'));
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      'Change detection failed: module graph warmup failed'
    );
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'error',
      error: expect.objectContaining({ message: 'module graph warmup failed' }),
    });
    expect(gitDiffProvider.getChangedFilesMock).not.toHaveBeenCalled();
    await service.dispose();
  });

  it('keeps the previous statuses when a live rescan fails', async () => {
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
    const { builder, emit } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
      debounceMs: 10,
    });

    service.start(builder.onModuleGraphChange, true);
    emit(new Map());
    await vi.runAllTimersAsync();
    emit(new Map());
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:modified',
          title: '',
          description: '',
          data: {
            changedFiles: ['src/Button.stories.tsx'],
          },
          sidebarContextMenu: false,
        },
      },
    });
    expect(logger.error).toHaveBeenCalledWith('Change detection failed: scan blew up');
    await service.dispose();
  });

  it('does not apply scan results or rerun after disposal', async () => {
    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const buttonStory = createModuleNode('/repo/src/Button.stories.tsx');
    const moduleGraph: ModuleGraph = new Map([
      ['/repo/src/Button.stories.tsx', new Set([buttonStory])],
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
    const { builder, emit } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
      debounceMs: 0,
    });

    service.start(builder.onModuleGraphChange, true);
    emit(moduleGraph);
    await vi.advanceTimersByTimeAsync(0);
    emit(moduleGraph);
    await vi.advanceTimersByTimeAsync(0);
    await service.dispose();

    changedFilesDeferred.resolve({
      changed: new Set(['src/Button.stories.tsx']),
      new: new Set(),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(1);
    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({});
    await expect(
      Promise.race([
        getChangeDetectionReadiness().then(() => 'resolved'),
        Promise.resolve('pending'),
      ])
    ).resolves.toBe('pending');
  });

  it('tears down after a permanently unavailable scan result', async () => {
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockRejectedValue(
        new ChangeDetectionUnavailableError('not a git repository')
      );
    });
    const { builder, emit } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn(),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
      debounceMs: 0,
    });

    service.start(builder.onModuleGraphChange, true);
    emit(new Map());
    await vi.advanceTimersByTimeAsync(0);
    emit(new Map());
    await vi.advanceTimersByTimeAsync(0);

    expect(gitDiffProvider.getChangedFilesMock).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Change detection unavailable: not a git repository');
    expect(await getChangeDetectionReadiness()).toEqual({
      status: 'unavailable',
      reason: 'not a git repository',
      error: expect.any(ChangeDetectionUnavailableError),
    });
    await service.dispose();
  });

  it('prefers modified over affected when the same story is reached by multiple changed files', async () => {
    const shared = createModuleNode('/repo/src/shared.ts');
    const closeComponent = createModuleNode('/repo/src/Close.tsx');
    const farComponent = createModuleNode('/repo/src/Far.tsx');
    const story = createModuleNode('/repo/src/Button.stories.tsx');

    shared.importers.add(closeComponent);
    shared.importers.add(farComponent);
    closeComponent.importers.add(story);
    farComponent.importers.add(closeComponent);

    const directChange = createModuleNode('/repo/src/direct.ts');
    const indirectChange = createModuleNode('/repo/src/indirect.ts');
    directChange.importers.add(closeComponent);
    indirectChange.importers.add(farComponent);

    const moduleGraph: ModuleGraph = new Map([
      ['/repo/src/shared.ts', new Set([shared])],
      ['/repo/src/Close.tsx', new Set([closeComponent])],
      ['/repo/src/Far.tsx', new Set([farComponent])],
      ['/repo/src/Button.stories.tsx', new Set([story])],
      ['/repo/src/direct.ts', new Set([directChange])],
      ['/repo/src/indirect.ts', new Set([indirectChange])],
    ]);
    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockResolvedValue({
        changed: new Set(['src/direct.ts', 'src/indirect.ts']),
        new: new Set(),
      });
    });
    const { builder, emit } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
    });

    service.start(builder.onModuleGraphChange, true);
    emit(moduleGraph);
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:modified',
          title: '',
          description: '',
          data: {
            changedFiles: ['src/direct.ts', 'src/indirect.ts'],
          },
          sidebarContextMenu: false,
        },
      },
    });
    await service.dispose();
  });

  it('stores changed files as normalized repo-relative paths', async () => {
    const buttonCss = createModuleNode(join(workingDir, 'src', 'Button.module.css'));
    const buttonComponent = createModuleNode(join(workingDir, 'src', 'Button.tsx'));
    const buttonStory = createModuleNode(join(workingDir, 'src', 'Button.stories.tsx'));

    buttonCss.importers.add(buttonComponent);
    buttonComponent.importers.add(buttonStory);

    const moduleGraph: ModuleGraph = new Map([
      [join(workingDir, 'src', 'Button.module.css'), new Set([buttonCss])],
      [join(workingDir, 'src', 'Button.tsx'), new Set([buttonComponent])],
      [join(workingDir, 'src', 'Button.stories.tsx'), new Set([buttonStory])],
    ]);
    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = createMockGitDiffProvider((provider) => {
      provider.getChangedFilesMock.mockResolvedValue({
        changed: new Set(['src/Button.module.css']),
        new: new Set(),
      });
    });
    const { builder, emit } = createBuilder();
    const service = new ChangeDetectionService({
      storyIndexGeneratorPromise: Promise.resolve({
        getIndex: vi.fn().mockResolvedValue(storyIndex),
      } as never),
      statusStore: getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID),
      gitDiffProvider,
      workingDir,
    });

    service.start(builder.onModuleGraphChange, true);
    emit(moduleGraph);
    await vi.runAllTimersAsync();

    expect(getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll()).toEqual({
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          typeId: CHANGE_DETECTION_STATUS_TYPE_ID,
          value: 'status-value:modified',
          title: '',
          description: '',
          data: {
            changedFiles: ['src/Button.module.css'],
          },
          sidebarContextMenu: false,
        },
      },
    });
    await service.dispose();
  });
});
