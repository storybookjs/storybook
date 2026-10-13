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

import { addStorybookAgentInstructions } from './agentInstructions.ts';
import {
  hasStorybookSkills,
  installSkills,
  supportsSkills,
  supportsAiSetup,
} from './installSkills.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./agentInstructions.ts', { spy: true });
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
  vi.mocked(addStorybookAgentInstructions).mockResolvedValue(['AGENTS.md']);
});

describe('supportsSkills', () => {
  it.each([
    [SupportedRenderer.REACT, SupportedFramework.REACT_VITE, true],
    [SupportedRenderer.REACT, SupportedFramework.NEXTJS, true],
    [SupportedRenderer.REACT, null, false],
    [SupportedRenderer.VUE3, SupportedFramework.VUE3_VITE, true],
    [SupportedRenderer.ANGULAR, SupportedFramework.ANGULAR_VITE, true],
    [SupportedRenderer.VUE3, SupportedFramework.NUXT, false],
    [SupportedRenderer.ANGULAR, SupportedFramework.ANGULAR, false],
    [SupportedRenderer.SVELTE, SupportedFramework.SVELTE_VITE, true],
    [SupportedRenderer.SVELTE, SupportedFramework.SVELTEKIT, true],
    [SupportedRenderer.WEB_COMPONENTS, SupportedFramework.WEB_COMPONENTS_VITE, true],
    [SupportedRenderer.HTML, SupportedFramework.HTML_VITE, false],
    [undefined, undefined, false],
  ])('%s (%s) is %s', (renderer, framework, expected) => {
    expect(supportsSkills(renderer, framework)).toBe(expected);
  });
});

describe('supportsAiSetup', () => {
  it.each([
    [SupportedRenderer.REACT, SupportedBuilder.VITE, SupportedFramework.REACT_VITE, true],
    [SupportedRenderer.VUE3, SupportedBuilder.VITE, SupportedFramework.VUE3_VITE, true],
    [SupportedRenderer.ANGULAR, SupportedBuilder.VITE, SupportedFramework.ANGULAR_VITE, true],
    [SupportedRenderer.REACT, SupportedBuilder.WEBPACK5, SupportedFramework.NEXTJS, false],
    [
      SupportedRenderer.REACT,
      SupportedBuilder.VITE,
      SupportedFramework.REACT_NATIVE_WEB_VITE,
      false,
    ],
    [SupportedRenderer.SVELTE, SupportedBuilder.VITE, SupportedFramework.SVELTE_VITE, false],
  ])('%s on %s (%s) is %s', (renderer, builder, framework, expected) => {
    expect(supportsAiSetup(renderer, builder, framework)).toBe(expected);
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
    lock({
      'find-skills': { source: 'vercel-labs/skills' },
      stories: { source: 'storybookjs/skills-fork' },
    });

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

  it('adds the section that tells agents when to use the skills', async () => {
    await installSkills({ packageManager, source: 'ai-feature' });

    expect(addStorybookAgentInstructions).toHaveBeenCalledWith(PROJECT_ROOT);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Added a Storybook section to AGENTS.md')
    );
  });

  it('leaves AGENTS.md alone on a refresh, so a removed section stays removed', async () => {
    await installSkills({ packageManager, source: 'refresh' });

    expect(addStorybookAgentInstructions).not.toHaveBeenCalled();
  });

  it('replaces the stories skill of an 11.0 prerelease on a refresh', async () => {
    vol.fromNestedJSON({
      [LOCK_PATH]: JSON.stringify({
        version: 1,
        skills: {
          stories: { source: 'storybookjs/skills' },
          'storybook-init': { source: 'storybookjs/skills' },
        },
      }),
    });

    await installSkills({ packageManager, source: 'refresh' });

    expect(vi.mocked(packageManager.runPackageCommand).mock.calls[1][0]).toMatchObject({
      args: ['skills@latest', 'remove', 'stories', '--yes'],
      cwd: PROJECT_ROOT,
    });
    expect(addStorybookAgentInstructions).toHaveBeenCalledWith(PROJECT_ROOT);
  });

  it('keeps the installed skills when removing the stories skill fails', async () => {
    vol.fromNestedJSON({
      [LOCK_PATH]: JSON.stringify({
        version: 1,
        skills: { stories: { source: 'storybookjs/skills' } },
      }),
    });
    vi.mocked(packageManager.runPackageCommand)
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('remove failed'));

    const result = await installSkills({ packageManager, source: 'refresh' });

    expect(result).toEqual({ result: 'installed', source: 'refresh' });
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not remove the replaced Storybook skills stories. Remove them with: npx skills@latest remove stories --yes'
    );
    expect(addStorybookAgentInstructions).toHaveBeenCalledWith(PROJECT_ROOT);
  });

  it('does not remove a stories skill from another repository', async () => {
    vol.fromNestedJSON({
      [LOCK_PATH]: JSON.stringify({ version: 1, skills: { stories: { source: 'acme/skills' } } }),
    });

    await installSkills({ packageManager, source: 'refresh' });

    expect(packageManager.runPackageCommand).toHaveBeenCalledTimes(1);
  });

  it('still installs when AGENTS.md cannot be written', async () => {
    vi.mocked(addStorybookAgentInstructions).mockRejectedValue(new Error('EACCES'));

    const result = await installSkills({ packageManager, source: 'ai-feature' });

    expect(result).toEqual({ result: 'installed', source: 'ai-feature' });
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not add the Storybook section for agents to AGENTS.md.'
    );
  });

  it('spawns nothing under CI', async () => {
    vi.mocked(isCI).mockReturnValue(true);

    const result = await installSkills({ packageManager, source: 'refresh' });

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

    const result = await installSkills({ packageManager, source: 'automigration' });

    expect(result).toEqual({ result: 'failed', source: 'automigration', exitCode: 1 });
    expect(addStorybookAgentInstructions).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not install the Storybook skills, continuing without them. Install them later with: npx skills@latest add storybookjs/skills#v10.6.0'
    );
  });
});
