import {
  type FSWatcher,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { getHeapStatistics } from 'node:v8';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';

import { join, normalize } from 'pathe';

import { ComponentMetaManager } from './ComponentMetaManager.ts';
import type { ComponentMetaProjectBase, FileChange } from './types.ts';

const isWindows = process.platform === 'win32';

const createProject = (trackedFile: string) =>
  ({
    getCommandLine: () => ({ fileNames: [trackedFile] }),
    hasSourceFile: (fileName: string) => fileName === trackedFile,
    ensureFiles: vi.fn(),
    onFilesChanged: vi.fn<(changes: FileChange[]) => void>(),
    getSourceFilePaths: () => [],
    dispose: vi.fn(),
  }) satisfies ComponentMetaProjectBase;

/**
 * Exercises the real `fs.watch` of the host platform: each test records the raw events the OS
 * reports for a newly written file next to what the manager makes of them.
 */
describe('ComponentMetaManager file watching', () => {
  let root: string;
  let newFile: string;
  let project: ReturnType<typeof createProject>;
  let manager: ComponentMetaManager<ReturnType<typeof createProject>>;
  let rawWatcher: FSWatcher;
  let rawEvents: { eventType: string; filename: string | null }[];

  beforeEach(() => {
    // This uses real FS tests because we're testing the OS's actual file watching behavior.
    // Using mocks would defeat the purpose of the test.
    root = mkdtempSync(join(tmpdir(), 'component-meta-watch-'));
    const trackedFile = join(root, 'src', 'Button.ts');
    newFile = join(root, 'src', 'Card.ts');
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'tsconfig.json'), '{}');
    writeFileSync(trackedFile, 'export const Button = 1;');

    project = createProject(trackedFile);
    manager = new ComponentMetaManager(
      { sys: { fileExists: existsSync, directoryExists: existsSync } },
      {
        parseCommandLine: () => project.getCommandLine(),
        createConfiguredProject: () => project,
        createInferredProject: () => createProject(trackedFile),
      }
    );
    manager.startWatching();
    manager.getProjectForFile(trackedFile);

    rawEvents = [];
    rawWatcher = watch(root, { recursive: true }, (eventType, filename) => {
      rawEvents.push({ eventType, filename });
    });
  });

  afterEach(() => {
    rawWatcher.close();
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  const expectCreatedReported = () =>
    vi.waitFor(
      () =>
        expect(project.onFilesChanged).toHaveBeenCalledWith([
          { filePath: newFile, type: 'created' },
        ]),
      { timeout: 5000 }
    );

  it.runIf(isWindows)(
    'reports a new file as created although Windows follows its rename with a change',
    async () => {
      writeFileSync(newFile, 'export const Card = 1;');

      await expectCreatedReported();
      await vi.waitFor(() => {
        // Windows reports `src\Card.ts`.
        const cardEvents = rawEvents
          .filter(({ filename }) => filename && normalize(filename) === 'src/Card.ts')
          .map(({ eventType }) => eventType);
        expect(cardEvents).toEqual(expect.arrayContaining(['rename', 'change']));
      });
    }
  );

  it.skipIf(isWindows)('reports a new file as created from its rename event', async () => {
    writeFileSync(newFile, 'export const Card = 1;');

    await expectCreatedReported();
    // macOS and Linux on Node 24 and older report a lone `rename`. Linux on Node 26 follows it
    // with a `change`, like Windows does.
    const cardEvents = rawEvents
      .filter(({ filename }) => filename === 'src/Card.ts')
      .map(({ eventType }) => eventType);
    expect(cardEvents).toContain('rename');
  });
});

describe('ComponentMetaManager heap-pressure recycle', () => {
  class RecyclingManager extends ComponentMetaManager<ReturnType<typeof createProject>> {
    recycleIfHeapPressured = () => this.recycleProjectsIfHeapPressured();
  }

  const file = '/project/src/Button.ts';
  const createManager = () =>
    new RecyclingManager(
      { sys: { fileExists: () => false, directoryExists: () => false } },
      {
        parseCommandLine: () => ({ fileNames: [file] }),
        createConfiguredProject: () => createProject(file),
        createInferredProject: () => createProject(file),
      }
    );

  const recycleAtHeapLimitFraction = (manager: RecyclingManager, fraction: number) => {
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: getHeapStatistics().heap_size_limit * fraction,
    } as NodeJS.MemoryUsage);
    return manager.recycleIfHeapPressured();
  };

  const recyclesAtHeapLimitFractions = (fractions: number[]) => {
    const manager = createManager();
    return fractions.map((fraction) => {
      manager.getProjectForFile(file);
      return recycleAtHeapLimitFraction(manager, fraction);
    });
  };

  beforeEach(() => {
    vi.spyOn(once, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recycles once the heap passes 70% of the limit', () => {
    expect(recyclesAtHeapLimitFractions([0.6, 0.8])).toEqual([false, true]);
  });

  it('keeps rebuilt projects that fill the heap past the threshold on their own', () => {
    expect(recyclesAtHeapLimitFractions([0.8, 0.8, 0.82, 0.85])).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('recycles again once the heap grows 30% of the way from the rebuilt projects to the limit', () => {
    expect(recyclesAtHeapLimitFractions([0.8, 0.8, 0.87])).toEqual([true, false, true]);
  });

  it('measures the rebuilt projects from the lowest heap seen since the recycle', () => {
    expect(recyclesAtHeapLimitFractions([0.9, 0.9, 0.8, 0.87])).toEqual([true, false, false, true]);
  });

  it('measures the rebuilt projects at the first check that has projects', () => {
    const manager = createManager();
    manager.getProjectForFile(file);

    expect(recycleAtHeapLimitFraction(manager, 0.8)).toBe(true);
    expect(recycleAtHeapLimitFraction(manager, 0.99)).toBe(false);
    manager.getProjectForFile(file);
    expect(recycleAtHeapLimitFraction(manager, 0.8)).toBe(false);
  });

  it('recycles at 70% of the limit again after the heap dropped below it', () => {
    expect(recyclesAtHeapLimitFractions([0.8, 0.8, 0.5, 0.8])).toEqual([true, false, false, true]);
    expect(recyclesAtHeapLimitFractions([0.8, 0.5, 0.8])).toEqual([true, false, true]);
  });
});
