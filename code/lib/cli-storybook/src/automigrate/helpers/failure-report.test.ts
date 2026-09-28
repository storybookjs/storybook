import { readFile, rm, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { runFixes } from '../index.ts';
import type { Fix } from '../types.ts';
import { REPORT_FILE_NAME, renderFailureReport, reportFileFailures } from './failure-report.ts';

vi.mock('node:fs/promises', { spy: true });
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
    await reportFileFailures(fileFailures);

    expect(fixResults).toEqual({ 'rename-legacy': 'succeeded' });
    expect(fs.readFileSync(stories[0], 'utf8')).toBe('export const modern = 1;');
    expect(fs.readFileSync(stories[1], 'utf8')).toBe('export const legacy = dynamic();');
    expect(fs.readFileSync(stories[2], 'utf8')).toBe('export const modern = 3;');
    expect(fs.readFileSync(`/project/${REPORT_FILE_NAME}`, 'utf8')).toMatchInlineSnapshot(`
      "# Automigrations summary

      These files could not be migrated automatically.
      Update them by hand, then run \`npx storybook automigrate\` to check that nothing is left.

      ## rename-legacy

      | File | Reason |
      | ---- | ------ |
      | \`src/B.stories.ts\` | legacy is computed \\| cannot rename |
      "
    `);
  });

  it('only logs the summary on a dry run', async () => {
    await reportFileFailures(
      [{ fixId: 'rename-legacy', file: stories[1], message: 'legacy is computed' }],
      { dryRun: true }
    );

    expect(fs.existsSync(`/project/${REPORT_FILE_NAME}`)).toBe(false);
  });

  it('removes a summary left by an earlier run once nothing fails', async () => {
    fs.writeFileSync(`/project/${REPORT_FILE_NAME}`, '# stale');

    await reportFileFailures([]);

    expect(fs.existsSync(`/project/${REPORT_FILE_NAME}`)).toBe(false);
  });

  it('shows paths inside the project relative to its root, in the reason too', () => {
    const report = renderFailureReport(
      [
        {
          fixId: 'rename-legacy',
          file: stories[1],
          message: `EACCES: permission denied, open '${stories[1]}'`,
        },
      ],
      '/project'
    );

    expect(report).toContain(
      "| `src/B.stories.ts` | EACCES: permission denied, open 'src/B.stories.ts' |"
    );
  });
});
