import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { Builder, ModuleGraph, ModuleNode, StoryIndex } from 'storybook/internal/types';

import { createStatusStore, UNIVERSAL_STATUS_STORE_OPTIONS } from '../../shared/status-store';
import { MockUniversalStore } from '../../shared/universal-store/mock';
import { getChangeDetectionReadiness, internal_resetChangeDetectionReadiness } from './index';
import { ChangeDetectionFailureError } from './errors';
import { CHANGE_DETECTION_STATUS_TYPE_ID, ChangeDetectionService } from './service';

vi.mock('storybook/internal/node-logger', { spy: true });

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
  let onModuleGraphChange: ((moduleGraph: ModuleGraph) => void) | undefined;

  const builder = {
    onModuleGraphChange: vi.fn((callback: (moduleGraph: ModuleGraph) => void) => {
      onModuleGraphChange = callback;
      return vi.fn(() => {
        onModuleGraphChange = undefined;
      });
    }),
  } as unknown as Builder<unknown>;

  return {
    builder,
    emit(moduleGraph: ModuleGraph) {
      onModuleGraphChange?.(moduleGraph);
    },
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
    const gitDiffProvider = {
      getChangedFiles: vi.fn().mockResolvedValue({
        changed: new Set(['src/Button.module.css']),
        new: new Set(),
      }),
      getRepoRoot: vi.fn().mockResolvedValue(workingDir),
    };
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
    const gitDiffProvider = {
      getChangedFiles: vi
        .fn()
        .mockResolvedValueOnce({
          changed: new Set(),
          new: new Set(['src/NewButton.stories.tsx']),
        })
        .mockResolvedValueOnce({
          changed: new Set(),
          new: new Set(),
        }),
      getRepoRoot: vi.fn().mockResolvedValue(workingDir),
    };
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
      gitDiffProvider: {
        getChangedFiles: vi.fn(),
        getRepoRoot: vi.fn(),
      },
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

  it('keeps the previous statuses when a live rescan fails', async () => {
    const storyIndex = createStoryIndex([
      { storyId: 'button--primary', importPath: './src/Button.stories.tsx', title: 'Button' },
    ]);
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore: new MockUniversalStore(UNIVERSAL_STATUS_STORE_OPTIONS),
      environment: 'server',
    });
    const gitDiffProvider = {
      getChangedFiles: vi
        .fn()
        .mockResolvedValueOnce({
          changed: new Set(['src/Button.stories.tsx']),
          new: new Set(),
        })
        .mockRejectedValueOnce(new ChangeDetectionFailureError('scan blew up')),
      getRepoRoot: vi.fn().mockResolvedValue(workingDir),
    };
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
    const gitDiffProvider = {
      getChangedFiles: vi.fn().mockResolvedValue({
        changed: new Set(['src/direct.ts', 'src/indirect.ts']),
        new: new Set(),
      }),
      getRepoRoot: vi.fn().mockResolvedValue(workingDir),
    };
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
    const gitDiffProvider = {
      getChangedFiles: vi.fn().mockResolvedValue({
        changed: new Set(['src/Button.module.css']),
        new: new Set(),
      }),
      getRepoRoot: vi.fn().mockResolvedValue(workingDir),
    };
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
