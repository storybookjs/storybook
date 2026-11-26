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
    getSourceFilePaths: vi.fn(() => []),
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
  type Project = ReturnType<typeof createProject>;

  class RecyclingManager extends ComponentMetaManager<Project> {
    recycleIfHeapPressured = (batchProjects?: Iterable<Project>) =>
      this.recycleProjectsIfHeapPressured(batchProjects);
  }

  const tsconfig = '/project/tsconfig.json';
  const file = '/project/src/Button.ts';

  const setup = ({ sharesParsedFiles }: { sharesParsedFiles: boolean }) => {
    const createConfiguredProject = vi.fn(() => createProject(file));
    const manager = new RecyclingManager(
      { sys: { fileExists: (path) => normalize(path) === tsconfig, directoryExists: () => true } },
      {
        parseCommandLine: () => ({ fileNames: [file] }),
        createConfiguredProject,
        createInferredProject: () => createProject(file),
        sharesParsedFiles,
      }
    );
    return { manager, createConfiguredProject, project: manager.getProjectForFile(file) };
  };

  const setHeapUsed = (heapUsed: number) =>
    vi.spyOn(process, 'memoryUsage').mockReturnValue({ heapUsed } as NodeJS.MemoryUsage);

  beforeEach(() => {
    vi.spyOn(once, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the projects while the heap is below the threshold', () => {
    const { manager, project } = setup({ sharesParsedFiles: true });
    setHeapUsed(0);

    expect(manager.recycleIfHeapPressured([project])).toBe(false);
    expect(project.dispose).not.toHaveBeenCalled();
    expect(manager.getProjectForFile(file)).toBe(project);
  });

  it('builds the replacement of a batch project before it disposes the project', () => {
    const { manager, project } = setup({ sharesParsedFiles: true });
    setHeapUsed(Number.POSITIVE_INFINITY);

    expect(manager.recycleIfHeapPressured([project])).toBe(true);

    const replacement = manager.getProjectForFile(file);
    expect(replacement).not.toBe(project);
    expect(replacement.getSourceFilePaths.mock.invocationCallOrder[0]).toBeLessThan(
      project.dispose.mock.invocationCallOrder[0]
    );
  });

  it('disposes a batch project whose replacement fails to build', () => {
    const { manager, project, createConfiguredProject } = setup({ sharesParsedFiles: true });
    createConfiguredProject.mockImplementationOnce(() => ({
      ...createProject(file),
      getSourceFilePaths: vi.fn(() => {
        throw new Error('The program failed to build');
      }),
    }));
    setHeapUsed(Number.POSITIVE_INFINITY);

    expect(manager.recycleIfHeapPressured([project])).toBe(true);
    expect(project.dispose).toHaveBeenCalledOnce();
  });

  it('disposes a project the batch did not use without a replacement', () => {
    const { manager, project, createConfiguredProject } = setup({ sharesParsedFiles: true });
    setHeapUsed(Number.POSITIVE_INFINITY);

    manager.recycleIfHeapPressured([]);

    expect(project.dispose).toHaveBeenCalledOnce();
    expect(createConfiguredProject).toHaveBeenCalledOnce();
  });

  it('disposes a batch project without a replacement when projects share no parsed files', () => {
    const { manager, project, createConfiguredProject } = setup({ sharesParsedFiles: false });
    setHeapUsed(Number.POSITIVE_INFINITY);

    manager.recycleIfHeapPressured([project]);

    expect(project.dispose).toHaveBeenCalledOnce();
    expect(createConfiguredProject).toHaveBeenCalledOnce();
  });
});
