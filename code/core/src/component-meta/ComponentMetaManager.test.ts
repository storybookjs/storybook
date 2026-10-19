import {
  type FSWatcher,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { join } from 'pathe';

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
  let rawEvents: string[];

  beforeEach(() => {
    // This uses real FS tests because we're testing the OS's actual file watching behavior.
    // Using mocks would defeat the purpose of the test.
    root = realpathSync.native(mkdtempSync(join(tmpdir(), 'component-meta-watch-')));
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
      if (filename?.replaceAll('\\', '/') === 'src/Card.ts') {
        rawEvents.push(eventType);
      }
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
      await vi.waitFor(() =>
        expect(rawEvents).toEqual(expect.arrayContaining(['rename', 'change']))
      );
    }
  );

  it.skipIf(isWindows)('reports a new file as created from its lone rename event', async () => {
    writeFileSync(newFile, 'export const Card = 1;');

    await expectCreatedReported();
    expect(rawEvents).toContain('rename');
    expect(rawEvents).not.toContain('change');
  });
});
