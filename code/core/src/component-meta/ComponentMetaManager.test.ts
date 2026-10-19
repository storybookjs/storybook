import { type FSWatcher, existsSync, watch } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComponentMetaManager } from './ComponentMetaManager.ts';
import type { ComponentMetaProjectBase, FileChange } from './types.ts';

vi.mock(import('fs'), { spy: true });

type WatchListener = (eventType: string, filename: string | null) => void;

const createProject = () =>
  ({
    getCommandLine: () => ({ fileNames: ['/repo/src/Button.ts'] }),
    hasSourceFile: (fileName: string) => fileName.endsWith('/repo/src/Button.ts'),
    ensureFiles: vi.fn(),
    onFilesChanged: vi.fn<(changes: FileChange[]) => void>(),
    getSourceFilePaths: () => [],
    dispose: vi.fn(),
  }) satisfies ComponentMetaProjectBase;

describe('ComponentMetaManager file watching', () => {
  let listener: WatchListener;
  let project: ReturnType<typeof createProject>;
  let manager: ComponentMetaManager<ReturnType<typeof createProject>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(watch).mockImplementation(((_dir: string, _options: unknown, cb: WatchListener) => {
      listener = cb;
      return { close: vi.fn(), unref: vi.fn() } as unknown as FSWatcher;
    }) as typeof watch);
    vi.mocked(existsSync).mockReturnValue(true);

    project = createProject();
    manager = new ComponentMetaManager(
      {
        sys: {
          fileExists: (path) => path.endsWith('/repo/tsconfig.json'),
          directoryExists: () => true,
        },
      },
      {
        parseCommandLine: () => project.getCommandLine(),
        createConfiguredProject: () => project,
        createInferredProject: createProject,
      }
    );
    manager.startWatching();
    manager.getProjectForFile('/repo/src/Button.ts');
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports a new file as created when a change event follows its rename event', () => {
    // Windows reports writing a new file as `rename` followed by `change`.
    listener('rename', 'src/Card.ts');
    listener('change', 'src/Card.ts');
    vi.advanceTimersByTime(50);

    expect(project.onFilesChanged).toHaveBeenCalledExactlyOnceWith([
      { filePath: expect.stringMatching(/\/repo\/src\/Card\.ts$/), type: 'created' },
    ]);
  });

  it('reports an edit to a tracked file as changed', () => {
    listener('change', 'src/Button.ts');
    vi.advanceTimersByTime(50);

    expect(project.onFilesChanged).toHaveBeenCalledExactlyOnceWith([
      { filePath: expect.stringMatching(/\/repo\/src\/Button\.ts$/), type: 'changed' },
    ]);
  });
});
