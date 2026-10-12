import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';

import { fs, vol } from 'memfs';

import { runFixes } from './index.ts';
import {
  collectAutomigrationsAcrossProjects,
  promptForAutomigrations,
  runAutomigrationsForProjects,
} from './multi-project.ts';
import type { Fix } from './types.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const project = {
  configDir: '/project/.storybook',
  mainConfigPath: '/project/.storybook/main.ts',
  storiesPaths: ['/project/src/A.stories.ts'],
  packageManager: {} as JsPackageManager,
  mainConfig: { stories: [] },
  storybookVersion: '11.0.0',
};

const renameImports = (id: string, run?: () => Promise<void | false>): Fix => ({
  id,
  prompt: () => id,
  transform: () => [
    {
      filter: { kind: ['main', 'story'] },
      handler: (code) => code.replaceAll(`${id}-old`, `${id}-new`),
    },
  ],
  ...(run ? { run } : {}),
});

const failingSwap = renameImports('swap', async () => {
  throw new Error('registry unreachable');
});
const healthy = renameImports('healthy');

describe('a fix whose run fails', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vol.fromJSON({
      [project.mainConfigPath]: "import 'swap-old'; import 'healthy-old';",
      [project.storiesPaths[0]]: "import 'swap-old'; import 'healthy-old';",
    });
  });

  it('leaves none of its file edits behind in a single-project run', async () => {
    const { fixResults } = await runFixes({ ...project, fixes: [failingSwap, healthy], yes: true });

    expect(fixResults).toEqual({ swap: 'failed', healthy: 'succeeded' });
    expect(vol.toJSON()).toEqual({
      [project.mainConfigPath]: "import 'swap-old'; import 'healthy-new';",
      [project.storiesPaths[0]]: "import 'swap-old'; import 'healthy-new';",
    });
  });

  it('shows why it failed in the project task log', async () => {
    const detected = await collectAutomigrationsAcrossProjects({
      fixes: [failingSwap],
      projects: [{ ...project, beforeVersion: '10.0.0' }],
      taskLog: { message: () => {}, error: () => {}, success: () => {} } as never,
    });

    const projectLog = { message: vi.fn(), success: vi.fn(), error: vi.fn() };
    vi.mocked(prompt.taskLog).mockReturnValueOnce(projectLog as never);

    await runAutomigrationsForProjects(detected, { automigrations: detected, yes: true } as never);

    expect(projectLog.message).toHaveBeenCalledWith('registry unreachable');
  });

  it('leaves none of its file edits behind in a multi-project run', async () => {
    const projectData = { ...project, beforeVersion: '10.0.0' };
    const detected = await collectAutomigrationsAcrossProjects({
      fixes: [failingSwap, healthy],
      projects: [projectData],
      taskLog: { message: () => {}, error: () => {}, success: () => {} } as never,
    });

    const results = await runAutomigrationsForProjects(detected, {
      automigrations: detected,
      yes: true,
    } as never);

    expect(results[project.configDir].automigrationStatuses).toEqual({
      swap: 'failed',
      healthy: 'succeeded',
    });
    expect(vol.toJSON()).toEqual({
      [project.mainConfigPath]: "import 'swap-old'; import 'healthy-new';",
      [project.storiesPaths[0]]: "import 'swap-old'; import 'healthy-new';",
    });
  });
});

describe('a fix whose run declines', () => {
  const declining = renameImports('swap', async () => false);

  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vol.fromJSON({
      [project.mainConfigPath]: "import 'swap-old'; import 'healthy-old';",
      [project.storiesPaths[0]]: "import 'swap-old'; import 'healthy-old';",
    });
  });

  it('is skipped and applies none of its hooks in a single-project run', async () => {
    const { fixResults } = await runFixes({ ...project, fixes: [declining, healthy], yes: true });

    expect(fixResults).toEqual({ swap: 'skipped', healthy: 'succeeded' });
    expect(vol.toJSON()).toEqual({
      [project.mainConfigPath]: "import 'swap-old'; import 'healthy-new';",
      [project.storiesPaths[0]]: "import 'swap-old'; import 'healthy-new';",
    });
  });

  it('is skipped and applies none of its hooks in a multi-project run', async () => {
    const detected = await collectAutomigrationsAcrossProjects({
      fixes: [declining, healthy],
      projects: [{ ...project, beforeVersion: '10.0.0' }],
      taskLog: { message: () => {}, error: () => {}, success: () => {} } as never,
    });

    const results = await runAutomigrationsForProjects(detected, {
      automigrations: detected,
      yes: true,
    } as never);

    expect(results[project.configDir].automigrationStatuses).toEqual({
      swap: 'skipped',
      healthy: 'succeeded',
    });
    expect(vol.toJSON()).toEqual({
      [project.mainConfigPath]: "import 'swap-old'; import 'healthy-new';",
      [project.storiesPaths[0]]: "import 'swap-old'; import 'healthy-new';",
    });
  });
});

describe('a fix that fails during detection', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vol.fromJSON({ [project.mainConfigPath]: 'export default {};' });
  });

  it('is still offered, and reports nothing when the user does not select it', async () => {
    const optIn: Fix = {
      id: 'opt-in',
      prompt: () => 'opt-in',
      defaultSelected: false,
      transform: () => [
        {
          filter: { kind: ['main'] },
          handler: () => {
            throw new Error('cannot edit this main config');
          },
        },
      ],
    };
    const detected = await collectAutomigrationsAcrossProjects({
      fixes: [optIn],
      projects: [{ ...project, beforeVersion: '10.0.0' }],
      taskLog: { message: () => {}, error: () => {}, success: () => {} } as never,
    });
    const selected = await promptForAutomigrations(detected, { yes: true } as never);

    const results = await runAutomigrationsForProjects(selected, {
      automigrations: detected,
      yes: true,
    } as never);

    expect(detected[0].reports[0].status).toBe('check_succeeded');
    expect(results[project.configDir]).toMatchObject({
      automigrationStatuses: { 'opt-in': 'skipped' },
      fileFailures: [],
    });
  });
});

describe('a fix whose hooks cannot migrate its files', () => {
  const failOn = (id: string, kind: 'main' | 'story', run?: () => Promise<void>): Fix => ({
    id,
    prompt: () => id,
    transform: () => [
      {
        filter: { kind: [kind] },
        handler: () => {
          throw new Error(`cannot migrate this ${kind}`);
        },
      },
    ],
    ...(run ? { run } : {}),
  });

  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vol.fromJSON({
      [project.mainConfigPath]: "import 'healthy-old';",
      [project.storiesPaths[0]]: "import 'healthy-old';",
    });
  });

  it('succeeds and reports the files it could not migrate outside the main config', async () => {
    const { fixResults, fileFailures } = await runFixes({
      ...project,
      fixes: [failOn('stories', 'story'), healthy],
      yes: true,
    });

    expect(fixResults).toEqual({ stories: 'succeeded', healthy: 'succeeded' });
    expect(fileFailures).toEqual([
      {
        fixId: 'stories',
        file: project.storiesPaths[0],
        kind: 'story',
        message: 'cannot migrate this story',
      },
    ]);
  });

  it('leaves its other files alone when it fails on the main config', async () => {
    const mainFirst: Fix = {
      id: 'main-first',
      prompt: () => 'main-first',
      transform: () => [
        {
          filter: { kind: ['main'] },
          handler: () => {
            throw new Error('cannot migrate this main');
          },
        },
        {
          filter: { kind: ['story'] },
          handler: (code) => code.replace('healthy-old', 'main-first-new'),
        },
      ],
    };

    const { fixResults } = await runFixes({ ...project, fixes: [mainFirst], yes: true });

    expect(fixResults).toEqual({ 'main-first': 'failed' });
    expect(vol.toJSON()[project.storiesPaths[0]]).toBe("import 'healthy-old';");
  });

  it('fails before its run changes anything when it cannot migrate the main config', async () => {
    const swapDependencies = vi.fn(async () => {});

    const detected = await collectAutomigrationsAcrossProjects({
      fixes: [failOn('swap', 'main', swapDependencies), healthy],
      projects: [{ ...project, beforeVersion: '10.0.0' }],
      taskLog: { message: () => {}, error: () => {}, success: () => {} } as never,
    });
    const results = await runAutomigrationsForProjects(detected, {
      automigrations: detected,
      yes: true,
    } as never);

    expect(swapDependencies).not.toHaveBeenCalled();
    expect(results[project.configDir]).toMatchObject({
      automigrationStatuses: { swap: 'failed', healthy: 'succeeded' },
      fileFailures: [{ fixId: 'swap', kind: 'main', message: 'cannot migrate this main' }],
    });
  });
});

describe('a fix whose check read a file that an earlier fix changed', () => {
  const setupFile = '/project/vitest.setup.ts';

  const appendOnRun = (id: string, { skipWhen }: { skipWhen?: string } = {}): Fix<string> => ({
    id,
    prompt: () => id,
    check: async ({ files }) => {
      const source = await files.read(setupFile);
      return skipWhen && source.includes(skipWhen) ? null : source;
    },
    run: async ({ result, files }) => {
      files.write(setupFile, `${result}+${id}`);
    },
  });

  const runMultiProject = async (fixes: Fix[]) => {
    const detected = await collectAutomigrationsAcrossProjects({
      fixes,
      projects: [{ ...project, beforeVersion: '10.0.0' }],
      taskLog: { message: () => {}, error: () => {}, success: () => {} } as never,
    });
    const results = await runAutomigrationsForProjects(detected, {
      automigrations: detected,
      yes: true,
    } as never);
    return results[project.configDir].automigrationStatuses;
  };

  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vol.fromJSON({ [project.mainConfigPath]: 'export default {};', [setupFile]: 'setup' });
  });

  it('checks again before it runs, keeping the earlier edit in a single-project run', async () => {
    const { fixResults } = await runFixes({
      ...project,
      fixes: [appendOnRun('first'), appendOnRun('second')],
      yes: true,
    });

    expect(fixResults).toEqual({ first: 'succeeded', second: 'succeeded' });
    expect(vol.toJSON()[setupFile]).toBe('setup+first+second');
  });

  it('checks again before it runs, keeping the earlier edit in a multi-project run', async () => {
    const statuses = await runMultiProject([appendOnRun('first'), appendOnRun('second')]);

    expect(statuses).toEqual({ first: 'succeeded', second: 'succeeded' });
    expect(vol.toJSON()[setupFile]).toBe('setup+first+second');
  });

  it('changes nothing once its check no longer applies', async () => {
    const statuses = await runMultiProject([
      appendOnRun('first'),
      appendOnRun('second', { skipWhen: '+first' }),
    ]);

    expect(statuses).toEqual({ first: 'succeeded', second: 'succeeded' });
    expect(vol.toJSON()[setupFile]).toBe('setup+first');
  });
});
