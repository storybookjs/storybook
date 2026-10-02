import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isCI } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import {
  ExecaCommandFailedError,
  PackageInstallFailedError,
} from 'storybook/internal/server-errors';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { vol } from 'memfs';

import { hasStorybookSkills, installSkills, supportsAiFeatures } from './installSkills.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock(import('storybook/internal/common'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProjectRoot: vi.fn(),
    isCI: vi.fn(),
    versions: { ...actual.versions, storybook: '10.6.0' },
  };
});

const PROJECT_ROOT = '/test/project';
const LOCK_PATH = join(PROJECT_ROOT, 'skills-lock.json');

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFile).mockImplementation(memfs.fs.promises.readFile as unknown as typeof readFile);
  vol.reset();
  vi.mocked(getProjectRoot).mockReturnValue(PROJECT_ROOT);
  vi.mocked(isCI).mockReturnValue(false);
});

describe('supportsAiFeatures', () => {
  it.each([
    [SupportedRenderer.REACT, SupportedBuilder.VITE, SupportedFramework.REACT_VITE, true],
    [SupportedRenderer.REACT, SupportedBuilder.VITE, null, true],
    [SupportedRenderer.VUE3, SupportedBuilder.VITE, SupportedFramework.VUE3_VITE, false],
    [SupportedRenderer.REACT, SupportedBuilder.WEBPACK5, SupportedFramework.REACT_WEBPACK5, false],
    [SupportedRenderer.ANGULAR, SupportedBuilder.WEBPACK5, SupportedFramework.ANGULAR, false],
    [
      SupportedRenderer.REACT,
      SupportedBuilder.VITE,
      SupportedFramework.REACT_NATIVE_WEB_VITE,
      false,
    ],
    [undefined, undefined, undefined, false],
  ])('%s on %s (%s) is %s', (renderer, builder, framework, expected) => {
    expect(supportsAiFeatures(renderer, builder, framework)).toBe(expected);
  });
});

describe('hasStorybookSkills', () => {
  const lock = (skills: Record<string, { source: string }>) =>
    vol.fromNestedJSON({ [LOCK_PATH]: JSON.stringify({ version: 1, skills }) });

  it('is true when the lock file has a skill from the Storybook skills repository', async () => {
    lock({
      'find-skills': { source: 'vercel-labs/skills' },
      stories: { source: 'storybookjs/skills' },
    });

    expect(await hasStorybookSkills()).toBe(true);
  });

  it('is true when the skills were installed through a git URL', async () => {
    lock({ stories: { source: 'git@github.com:StorybookJS/skills.git' } });

    expect(await hasStorybookSkills()).toBe(true);
  });

  it('is false when the lock file only has skills from other repositories', async () => {
    lock({ 'find-skills': { source: 'vercel-labs/skills' } });

    expect(await hasStorybookSkills()).toBe(false);
  });

  it('is false after the skills were removed', async () => {
    lock({});

    expect(await hasStorybookSkills()).toBe(false);
  });

  it('is false without a lock file', async () => {
    expect(await hasStorybookSkills()).toBe(false);
  });

  it('is false when the lock file is unreadable', async () => {
    vol.fromNestedJSON({ [LOCK_PATH]: 'not json' });

    expect(await hasStorybookSkills()).toBe(false);
  });
});

describe('installSkills', () => {
  let packageManager: JsPackageManager;

  beforeEach(() => {
    packageManager = {
      runPackageCommand: vi.fn().mockResolvedValue(undefined),
      getRemoteRunCommand: vi.fn((args: string[]) => `npx ${args.join(' ')}`),
    } as Partial<JsPackageManager> as JsPackageManager;

    vi.mocked(isTelemetryModuleEnabled).mockReturnValue(true);
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.debug).mockImplementation(() => {});
  });

  it('installs from the tag of the running Storybook version', async () => {
    const result = await installSkills({ packageManager, source: 'ai-feature' });

    expect(packageManager.runPackageCommand).toHaveBeenCalledWith({
      args: [
        'skills@latest',
        'add',
        'storybookjs/skills#v10.6.0',
        '--yes',
        '--agent',
        'claude-code',
        'universal',
        '--copy',
      ],
      useRemotePkg: true,
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: {},
      timeout: 120_000,
    });
    expect(result).toEqual({ result: 'installed', source: 'ai-feature' });
  });

  it('disables Vercel telemetry when Storybook telemetry is disabled', async () => {
    vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);

    await installSkills({ packageManager, source: 'ai-feature' });

    expect(vi.mocked(packageManager.runPackageCommand).mock.calls[0][0].env).toEqual({
      DISABLE_TELEMETRY: '1',
    });
  });

  it('prints the literal command and how to remove the skills', async () => {
    await installSkills({ packageManager, source: 'ai-feature' });

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        'npx skills@latest add storybookjs/skills#v10.6.0 --yes --agent claude-code universal --copy'
      )
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Remove the Storybook skills with: npx skills@latest remove'
    );
  });

  it('spawns nothing under CI', async () => {
    vi.mocked(isCI).mockReturnValue(true);

    const result = await installSkills({ packageManager, source: 'installed' });

    expect(packageManager.runPackageCommand).not.toHaveBeenCalled();
    expect(result).toEqual({ result: 'skipped', source: 'ci' });
  });

  it.each([
    ['npx', ExecaCommandFailedError],
    ['pnpm', PackageInstallFailedError],
  ])('warns and reports the exit code when the install fails (%s)', async (command, Err) => {
    vi.mocked(packageManager.runPackageCommand).mockRejectedValue(
      new Err({ command, args: [], exitCode: 1, logs: '' })
    );

    const result = await installSkills({ packageManager, source: 'prompt' });

    expect(result).toEqual({ result: 'failed', source: 'prompt', exitCode: 1 });
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not install the Storybook skills, continuing without them. Install them later with: npx skills@latest add storybookjs/skills'
    );
  });
});
