import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import { join, relative } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import waitOn from 'wait-on';

import { prepareSandbox } from './prepare-sandbox.ts';
import { ROOT_DIRECTORY, SANDBOX_DIRECTORY } from './utils/constants.ts';
import { exec } from './utils/exec.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('./utils/exec.ts', { spy: true });
vi.mock('wait-on', { spy: true });

const KEY = 'react-vite/default-ts';
const CACHE = join(ROOT_DIRECTORY, 'sandbox', 'react-vite-default-ts');
const SANDBOX = join(SANDBOX_DIRECTORY, 'react-vite-default-ts');
const STORY = 'src/stories/Button.stories.ts';

// memfs drops the drive letter from the paths it lists on Windows, so they are made relative to
// the folder's path as memfs writes it.
const files = (dir: string) => {
  const root = dir.replace(/^[A-Za-z]:/, '');
  return Object.fromEntries(
    Object.entries(vol.toJSON(dir)).map(([path, content]) => [
      relative(root, path.replace(/^[A-Za-z]:/, '')),
      content,
    ])
  );
};

beforeEach(() => {
  vol.reset();
  vi.mocked(exec).mockResolvedValue(undefined as never);
  vi.mocked(waitOn).mockResolvedValue(undefined as never);
  vi.mocked(fs.existsSync).mockImplementation(memfs.fs.existsSync as never);
  for (const name of ['cp', 'readFile', 'readdir', 'rm'] as const) {
    vi.mocked(fsp[name]).mockImplementation(memfs.fs.promises[name] as never);
  }
  // As NX runs every task.
  vi.stubEnv('NX_TASK_TARGET_PROJECT', KEY);
  vol.fromNestedJSON({
    [CACHE]: {
      'package.json': '{"name":"sandbox"}',
      'yarn.lock': 'lockfile',
      [STORY]: 'export const Primary = {};',
      'storybook-static/index.html': 'built',
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const installs = () =>
  vi.mocked(exec).mock.calls.filter(([command]) => String(command).startsWith('yarn install'));

describe('prepareSandbox', () => {
  it('installs a sandbox the agent has not prepared before', async () => {
    await prepareSandbox({ key: KEY, link: false });

    expect(files(SANDBOX)).toEqual(files(CACHE));
    expect(installs()).toHaveLength(1);
  });

  it('undoes what an earlier task on the agent changed, and keeps its node_modules', async () => {
    await prepareSandbox({ key: KEY, link: false });
    vol.fromNestedJSON({
      [SANDBOX]: {
        'node_modules/storybook/package.json': '{}',
        // What the onboarding E2E test and `yarn task dev` leave behind.
        [STORY]: 'export const Primary = {};\nexport const TestAbc = {};',
        '.git/HEAD': 'ref: refs/heads/main',
      },
    });
    vi.mocked(exec).mockClear();

    await prepareSandbox({ key: KEY, link: false });

    expect(files(SANDBOX)).toEqual({
      ...files(CACHE),
      'node_modules/storybook/package.json': '{}',
    });
    expect(installs()).toHaveLength(0);
  });

  it('installs again when the cached sandbox has another lockfile than the installed one', async () => {
    vol.fromNestedJSON({
      [SANDBOX]: {
        'package.json': '{"name":"sandbox"}',
        'yarn.lock': 'an older lockfile',
        'node_modules/storybook/package.json': '{}',
      },
    });

    await prepareSandbox({ key: KEY, link: false });

    expect(files(SANDBOX)).toEqual(files(CACHE));
    expect(installs()).toHaveLength(1);
  });
});
