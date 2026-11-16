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

describe('ComponentMetaManager batch files', () => {
  class TestManager extends ComponentMetaManager<ReturnType<typeof createProject>> {
    addBatchFilesTo(project: ReturnType<typeof createProject>) {
      this.addBatchFiles(project);
    }

    recycle() {
      this.recycleProjectsIfHeapPressured();
    }
  }

  let root: string;
  let button: string;
  let card: string;
  let outside: string;
  let manager: TestManager;

  const createManager = (recycleHeapPressureRatio?: number) =>
    new TestManager(
      { sys: { fileExists: existsSync, directoryExists: existsSync } },
      {
        parseCommandLine: () => ({ fileNames: [button, card] }),
        createConfiguredProject: (commandLine) => ({
          ...createProject(button),
          getCommandLine: () => commandLine,
        }),
        createInferredProject: () => createProject(outside),
      },
      recycleHeapPressureRatio
    );

  beforeEach(() => {
    // The manager finds tsconfig files through the real file system.
    root = mkdtempSync(join(tmpdir(), 'component-meta-batch-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'tsconfig.json'), '{}');
    button = join(root, 'src', 'Button.ts');
    card = join(root, 'src', 'Card.ts');
    outside = join(root, 'Outside.ts');
    manager = createManager();
  });

  afterEach(() => {
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  it('gives a project the announced files that belong to it, once', () => {
    manager.setBatchFiles(
      new Map([
        [button, [button]],
        [card, [card]],
        [outside, [outside]],
      ])
    );
    const project = manager.getProjectForFile(button);

    manager.addBatchFilesTo(project);
    manager.addBatchFilesTo(project);

    expect(project.ensureFiles).toHaveBeenCalledExactlyOnceWith([button, card]);
  });

  it('stops handing out the batch once holding it forced a heap-pressure recycle', async () => {
    const { once } = await import('storybook/internal/node-logger');
    const warn = vi.spyOn(once, 'warn').mockImplementation(() => undefined);
    manager = createManager(0);
    manager.setBatchFiles(new Map([[button, [button, card]]]));
    manager.getProjectForFile(button);

    try {
      manager.recycle();
      const fresh = manager.getProjectForFile(button);
      manager.addBatchFilesTo(fresh);

      expect(fresh.ensureFiles).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
