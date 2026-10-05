import { readFile, rm, writeFile } from 'node:fs/promises';
import { posix, relative, win32 } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { fs, vol } from 'memfs';

import { automigrate, doAutomigrate, runFixes } from '../index.ts';
import * as mainConfigFile from './mainConfigFile.ts';
import type { Fix } from '../types.ts';
import { REPORT_FILE_NAME, reportFileFailures } from './failure-report.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('node:path', async (importOriginal) => {
  const path = await importOriginal<typeof import('node:path')>();
  return { ...path, relative: vi.fn(path.relative) };
});
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const stories = [
  '/project/src/A.stories.ts',
  '/project/src/B.stories.ts',
  '/project/src/C.stories.ts',
];

const renameFix: Fix = {
  id: 'rename-legacy',
  prompt: () => 'Rename legacy',
  transform: () => [
    {
      filter: { kind: ['story'] },
      handler: (code) => {
        if (code.includes('dynamic')) {
          throw new Error('legacy is computed | cannot rename');
        }
        return code.replace('legacy', 'modern');
      },
    },
  ],
};

describe('file failures', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(rm).mockImplementation(fs.promises.rm as typeof rm);
    vi.mocked(getProjectRoot).mockReturnValue('/project');
    vol.fromJSON({
      '/project/.storybook/main.ts': 'export default {};',
      [stories[0]]: 'export const legacy = 1;',
      [stories[1]]: 'export const legacy = dynamic();',
      [stories[2]]: 'export const legacy = 3;',
    });
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
    vi.mocked(rm).mockRestore();
    vi.mocked(relative).mockRestore();
  });

  it('migrates every other file and reports the failed ones in the summary file', async () => {
    const { fixResults, fileFailures } = await runFixes({
      fixes: [renameFix],
      yes: true,
      configDir: '/project/.storybook',
      packageManager: {} as JsPackageManager,
      mainConfig: { stories: [] },
      mainConfigPath: '/project/.storybook/main.ts',
      storybookVersion: '11.0.0',
      storiesPaths: stories,
    });
    await reportFileFailures(fileFailures, ['rename-legacy']);

    expect(fixResults).toEqual({ 'rename-legacy': 'succeeded' });
    expect(fs.readFileSync(stories[0], 'utf8')).toBe('export const modern = 1;');
    expect(fs.readFileSync(stories[1], 'utf8')).toBe('export const legacy = dynamic();');
    expect(fs.readFileSync(stories[2], 'utf8')).toBe('export const modern = 3;');
    expect(fs.readFileSync(`/project/${REPORT_FILE_NAME}`, 'utf8')).toMatchInlineSnapshot(`
      "# Automigrations summary

      These files could not be migrated automatically.
      Update them by hand.
      A section disappears once its migration runs again without failures.
      Delete this file when you are done.

      ## rename-legacy

      | File | Reason |
      | ---- | ------ |
      | \`src/B.stories.ts\` | legacy is computed \\| cannot rename |
      "
    `);
  });

  const project = {
    configDir: '/project/.storybook',
    packageManager: {} as JsPackageManager,
    mainConfig: { stories: [] },
    mainConfigPath: '/project/.storybook/main.ts',
    storybookVersion: '11.0.0',
    storiesPaths: stories,
  };

  it('drops the section of a fix once the user fixed its files by hand', async () => {
    const options = { ...project, fixes: [renameFix], yes: true, hideMigrationSummary: true };
    await automigrate({ ...options, isUpgrade: false, isLatest: false });
    fs.writeFileSync(stories[1], 'export const modern = 2;');

    await automigrate({ ...options, isUpgrade: false, isLatest: false });

    expect(fs.existsSync(`/project/${REPORT_FILE_NAME}`)).toBe(false);
  });

  it('ends the summary with a warning instead of a success when files were skipped', async () => {
    await automigrate({
      ...project,
      fixes: [renameFix],
      yes: true,
      isUpgrade: false,
      isLatest: false,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'Migrations ran, but 1 file could not be migrated automatically'
    );
    expect(logger.step).not.toHaveBeenCalledWith(expect.stringContaining('ran successfully'));
  });

  it('makes storybook automigrate fail while files are left to migrate by hand', async () => {
    vi.spyOn(mainConfigFile, 'getStorybookData').mockResolvedValue({
      ...project,
      versionInstalled: '11.0.0',
    } as never);

    await expect(
      doAutomigrate({
        configDir: project.configDir,
        fixes: [renameFix],
        yes: true,
        skipInstall: true,
        skipDoctor: true,
      })
    ).rejects.toMatchObject({ data: { errors: [expect.stringContaining('1 file skipped')] } });
  });

  it('removes the sections of fixes that ran cleanly, and the file once none is left', async () => {
    await reportFileFailures(
      [{ fixId: 'rename-legacy', file: stories[1], kind: 'story', message: 'legacy is computed' }],
      ['rename-legacy']
    );

    await reportFileFailures([], ['rename-legacy']);

    expect(fs.existsSync(`/project/${REPORT_FILE_NAME}`)).toBe(false);
  });

  it('keeps the sections of fixes that did not run again', async () => {
    await reportFileFailures(
      [{ fixId: 'swap-framework', file: stories[0], kind: 'story', message: 'unreadable' }],
      ['swap-framework']
    );

    await reportFileFailures(
      [{ fixId: 'rename-legacy', file: stories[1], kind: 'story', message: 'legacy is computed' }],
      ['rename-legacy']
    );

    expect(fs.readFileSync(`/project/${REPORT_FILE_NAME}`, 'utf8')).toMatchInlineSnapshot(`
      "# Automigrations summary

      These files could not be migrated automatically.
      Update them by hand.
      A section disappears once its migration runs again without failures.
      Delete this file when you are done.

      ## swap-framework

      | File | Reason |
      | ---- | ------ |
      | \`src/A.stories.ts\` | unreadable |

      ## rename-legacy

      | File | Reason |
      | ---- | ------ |
      | \`src/B.stories.ts\` | legacy is computed |
      "
    `);
  });

  describe.each([
    { platform: 'POSIX', relativePath: posix.relative },
    { platform: 'Windows', relativePath: win32.relative },
  ])('with $platform path semantics', ({ relativePath }) => {
    beforeEach(() => {
      vi.mocked(relative).mockImplementation(relativePath);
    });

    it('shows paths inside the project relative to its root, in the reason too', async () => {
      await reportFileFailures(
        [
          {
            fixId: 'rename-legacy',
            file: stories[1],
            kind: 'story',
            message: `EACCES: permission denied, open '${stories[1]}'`,
          },
        ],
        ['rename-legacy']
      );

      expect(fs.readFileSync(`/project/${REPORT_FILE_NAME}`, 'utf8')).toContain(
        "| `src/B.stories.ts` | EACCES: permission denied, open 'src/B.stories.ts' |"
      );
    });
  });

  it('makes paths with backslash separators relative in the reason', async () => {
    await reportFileFailures(
      [
        {
          fixId: 'rename-legacy',
          file: stories[1],
          kind: 'story',
          message: "EACCES: permission denied, open '/project\\src\\B.stories.ts'",
        },
      ],
      ['rename-legacy']
    );

    expect(fs.readFileSync(`/project/${REPORT_FILE_NAME}`, 'utf8')).toContain(
      "| `src/B.stories.ts` | EACCES: permission denied, open 'src/B.stories.ts' |"
    );
  });
});
