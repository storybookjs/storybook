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

import { join, normalize, resolve } from 'pathe';

import { logger } from 'storybook/internal/node-logger';

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
  const root = resolve('/project');
  const tsconfig = join(root, 'app', 'tsconfig.json');
  const button = join(root, 'app', 'Button.ts');
  const card = join(root, 'lib', 'Card.ts');
  const icon = join(root, 'lib', 'Icon.ts');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setup = () => {
    const commandLine = { fileNames: [button] };
    const configured = { ...createProject(button), getCommandLine: () => commandLine };
    const inferred = createProject(join(root, 'none.ts'));
    const manager = new ComponentMetaManager(
      { sys: { fileExists: (file) => file === tsconfig, directoryExists: () => false } },
      {
        parseCommandLine: () => commandLine,
        createConfiguredProject: () => configured,
        createInferredProject: () => inferred,
      }
    );
    const batchFiles = manager.groupFilesByProject(
      [button, card, icon].map((file) => ({ projectFile: file, files: [file] }))
    );
    return { manager, configured, inferred, batchFiles };
  };

  it('groups the files by project without adding any of them yet', () => {
    const { configured, inferred, batchFiles } = setup();

    expect(batchFiles).toEqual(
      new Map([
        [configured, [button]],
        [inferred, [card, icon]],
      ])
    );
    expect(configured.ensureFiles).not.toHaveBeenCalled();
    expect(inferred.ensureFiles).not.toHaveBeenCalled();
  });

  it('gives a project all its files of the batch in one call, at its first lookup', () => {
    const { manager, inferred, batchFiles } = setup();

    manager.getProjectForFile(card, batchFiles);
    manager.getProjectForFile(icon, batchFiles);

    expect(inferred.ensureFiles.mock.calls).toEqual([[[card, icon]], [[card]], [[icon]]]);
    expect(batchFiles.has(inferred)).toBe(false);
  });

  it('keeps the batch of a project that has not been looked up', () => {
    const { manager, configured, batchFiles } = setup();

    manager.getProjectForFile(card, batchFiles);

    expect(configured.ensureFiles).not.toHaveBeenCalled();
    expect(batchFiles.get(configured)).toEqual([button]);
  });

  it('adds a file outside every tsconfig on its own when there is no batch', () => {
    const { manager, inferred } = setup();

    manager.getProjectForFile(card);

    expect(inferred.ensureFiles).toHaveBeenCalledExactlyOnceWith([card]);
  });

  it('groups plain files the same way as groups of one file', () => {
    const { manager, batchFiles } = setup();

    expect(manager.groupFilesByProject([button, card, icon])).toEqual(batchFiles);
  });

  it('matches a file added to a tsconfig project after an earlier lookup', () => {
    const { manager, configured, inferred } = setup();
    const chip = join(root, 'app', 'Chip.ts');
    expect(manager.getProjectForFile(chip)).toBe(inferred);

    configured.getCommandLine().fileNames.push(chip);

    expect(manager.getProjectForFile(chip)).toBe(configured);
  });

  describe('when handing a project the batch fails', () => {
    beforeEach(() => {
      vi.spyOn(logger, 'debug').mockImplementation(() => undefined);
    });

    it('returns the project and lets the extraction add its own file', () => {
      const { manager, inferred, batchFiles } = setup();
      inferred.ensureFiles.mockImplementationOnce(() => {
        throw new Error('TypeScript dropped the program');
      });

      expect(manager.getProjectForFile(card, batchFiles)).toBe(inferred);
      expect(inferred.ensureFiles).toHaveBeenLastCalledWith([card]);
      expect(logger.debug).toHaveBeenCalledOnce();
    });
  });
});
