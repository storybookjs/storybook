import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

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
