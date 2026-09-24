import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { executeCommand, getProjectRoot, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { ExecaCommandFailedError } from 'storybook/internal/server-errors';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';

import { vol } from 'memfs';

import { _clearGlobalSettings } from './globalSettings.ts';
import { decideSkillsInstall, installSkills } from './installSkills.ts';

const versionHolder = vi.hoisted(() => ({ storybook: '10.6.0' }));

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock(import('storybook/internal/common'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProjectRoot: vi.fn(),
    isCI: vi.fn(),
    executeCommand: vi.fn(),
    get versions() {
      return { ...actual.versions, storybook: versionHolder.storybook };
    },
  };
});

const PROJECT_ROOT = '/test/project';
const SETTINGS_PATH = join(homedir(), '.storybook', 'settings.json');
const INSTALL_ARGS = (ref: string) => [
  'skills@latest',
  'add',
  `storybookjs/skills#${ref}`,
  '-y',
  '-a',
  'claude-code',
  'universal',
  '--copy',
];

const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const setStdoutIsTTY = (value: boolean) =>
  Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true });

const settingsFile = () => JSON.parse(vol.toJSON()[SETTINGS_PATH] as string);
const seedSettings = (agentSkills?: Record<string, boolean>) =>
  vol.fromNestedJSON({
    [SETTINGS_PATH]: JSON.stringify({ version: 1, userSince: 1, agentSkills }),
  });
const tagFound = () =>
  vi.mocked(executeCommand).mockResolvedValue({ stdout: 'abc\trefs/tags/v10.6.0\n' } as never);
const tagMissing = () => vi.mocked(executeCommand).mockResolvedValue({ stdout: '' } as never);

describe('decideSkillsInstall', () => {
  const base = { isCI: false, isInteractive: true, yes: false, agent: false };

  it.each([
    [
      '--skills wins over everything',
      { ...base, skillsFlag: true, isCI: true, remembered: false },
      { action: 'install', source: 'flag' },
    ],
    [
      '--no-skills wins over a remembered true',
      { ...base, skillsFlag: false, remembered: true, agent: true },
      { action: 'skip', source: 'flag' },
    ],
    [
      'CI skips even with -y and an agent',
      { ...base, isCI: true, isInteractive: false, yes: true, agent: true, remembered: true },
      { action: 'skip', source: 'ci' },
    ],
    [
      'a remembered true installs',
      { ...base, remembered: true },
      { action: 'install', source: 'settings' },
    ],
    [
      'a remembered false skips even for an agent',
      { ...base, remembered: false, agent: true, yes: true },
      { action: 'skip', source: 'settings' },
    ],
    [
      'an agent installs',
      { ...base, agent: true, yes: true },
      { action: 'install', source: 'agent' },
    ],
    ['-y installs', { ...base, yes: true }, { action: 'install', source: 'yes' }],
    ['interactive asks', { ...base }, { action: 'ask', source: 'prompt' }],
    [
      'non-interactive without -y takes the default',
      { ...base, isInteractive: false },
      { action: 'install', source: 'default' },
    ],
  ] as const)('%s', (_, input, expected) => {
    expect(decideSkillsInstall(input)).toEqual(expected);
  });
});

describe('installSkills', () => {
  let packageManager: JsPackageManager;

  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(mkdir).mockImplementation(memfs.fs.promises.mkdir as unknown as typeof mkdir);
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof writeFile
    );
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof readFile
    );
    vol.reset();
    _clearGlobalSettings();
    versionHolder.storybook = '10.6.0';

    packageManager = {
      runPackageCommand: vi.fn().mockResolvedValue(undefined),
      getRemoteRunCommand: vi.fn((args: string[]) => `npx ${args.join(' ')}`),
    } as Partial<JsPackageManager> as JsPackageManager;

    vi.mocked(getProjectRoot).mockReturnValue(PROJECT_ROOT);
    vi.mocked(isCI).mockReturnValue(false);
    vi.mocked(isTelemetryModuleEnabled).mockReturnValue(true);
    vi.mocked(prompt.confirm).mockResolvedValue(true);
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.debug).mockImplementation(() => {});
    setStdoutIsTTY(true);
    tagFound();
  });

  afterEach(() => {
    if (originalIsTTY) {
      Object.defineProperty(process.stdout, 'isTTY', originalIsTTY);
    } else {
      delete (process.stdout as { isTTY?: boolean }).isTTY;
    }
    vol.reset();
  });

  describe('the command', () => {
    it('installs from the version tag when it exists', async () => {
      const result = await installSkills({ packageManager, yes: true });

      expect(packageManager.runPackageCommand).toHaveBeenCalledWith({
        args: INSTALL_ARGS('v10.6.0'),
        useRemotePkg: true,
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        env: { npm_config_yes: 'true' },
      });
      expect(result).toEqual({ result: 'installed', source: 'yes', refType: 'tag' });
    });

    it('falls back to main for a release without a tag', async () => {
      tagMissing();

      const result = await installSkills({ packageManager, yes: true });

      expect(vi.mocked(packageManager.runPackageCommand).mock.calls[0][0].args).toEqual(
        INSTALL_ARGS('main')
      );
      expect(result.refType).toBe('branch');
    });

    it('falls back to next for a prerelease without a tag', async () => {
      versionHolder.storybook = '11.0.0-alpha.1';
      tagMissing();

      await installSkills({ packageManager, yes: true });

      expect(vi.mocked(packageManager.runPackageCommand).mock.calls[0][0].args).toEqual(
        INSTALL_ARGS('next')
      );
    });

    it('treats a failing tag lookup as a missing tag', async () => {
      vi.mocked(executeCommand).mockRejectedValue(new Error('no network'));

      const result = await installSkills({ packageManager, yes: true });

      expect(vi.mocked(packageManager.runPackageCommand).mock.calls[0][0].args).toEqual(
        INSTALL_ARGS('main')
      );
      expect(result).toEqual({ result: 'installed', source: 'yes', refType: 'branch' });
    });

    it.each([
      ['a prerelease', '11.0.0-alpha.1', true],
      ['disabled Storybook telemetry', '10.6.0', false],
    ])('disables Vercel telemetry for %s', async (_, version, telemetryEnabled) => {
      versionHolder.storybook = version;
      vi.mocked(isTelemetryModuleEnabled).mockReturnValue(telemetryEnabled);

      await installSkills({ packageManager, yes: true });

      expect(vi.mocked(packageManager.runPackageCommand).mock.calls[0][0].env).toEqual({
        npm_config_yes: 'true',
        DISABLE_TELEMETRY: '1',
      });
    });

    it('prints the literal command and the skip line', async () => {
      await installSkills({ packageManager, yes: true });

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'npx skills@latest add storybookjs/skills#v10.6.0 -y -a claude-code universal --copy'
        )
      );
      expect(logger.log).toHaveBeenCalledWith(
        'Skip this next time with --no-skills. Remove them with: npx skills@latest remove'
      );
    });
  });

  describe('failure', () => {
    it('warns, keeps the settings untouched and reports the exit code', async () => {
      vi.mocked(packageManager.runPackageCommand).mockRejectedValue(
        new ExecaCommandFailedError({ command: 'npx', args: [], exitCode: 1, logs: '' })
      );

      const result = await installSkills({ packageManager, yes: true });

      expect(result).toEqual({ result: 'failed', source: 'yes', refType: 'tag', exitCode: 1 });
      expect(logger.warn).toHaveBeenCalledWith(
        'Could not install the Storybook skills, continuing without them.'
      );
      expect(settingsFile().agentSkills).toBeUndefined();
    });
  });

  describe('the settings', () => {
    it('refreshes silently when the project remembered true', async () => {
      seedSettings({ [PROJECT_ROOT]: true });

      const result = await installSkills({ packageManager });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'installed', source: 'settings', refType: 'tag' });
    });

    it('skips silently when the project remembered false', async () => {
      seedSettings({ [PROJECT_ROOT]: false });

      const result = await installSkills({ packageManager, yes: true, agent: true });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(packageManager.runPackageCommand).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'skipped', source: 'settings' });
    });

    it('asks when another project is remembered but this one is not', async () => {
      seedSettings({ '/other/project': true });

      await installSkills({ packageManager });

      expect(prompt.confirm).toHaveBeenCalled();
    });

    it('treats an unreadable settings file as no answer', async () => {
      vol.fromNestedJSON({ [SETTINGS_PATH]: 'not json' });

      await installSkills({ packageManager });

      expect(prompt.confirm).toHaveBeenCalled();
    });

    it.each([
      ['Yes in the prompt', {}],
      ['-y', { yes: true }],
      ['an agent', { agent: true }],
      ['--skills', { skillsFlag: true }],
    ])('remembers true after %s', async (_, options) => {
      await installSkills({ packageManager, ...options });

      expect(settingsFile().agentSkills).toEqual({ [PROJECT_ROOT]: true });
    });

    it('lets --skills replace a remembered false', async () => {
      seedSettings({ [PROJECT_ROOT]: false });

      const result = await installSkills({ packageManager, skillsFlag: true });

      expect(result).toEqual({ result: 'installed', source: 'flag', refType: 'tag' });
      expect(settingsFile().agentSkills).toEqual({ [PROJECT_ROOT]: true });
    });

    it('remembers false after --no-skills', async () => {
      const result = await installSkills({ packageManager, skillsFlag: false });

      expect(packageManager.runPackageCommand).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'skipped', source: 'flag' });
      expect(settingsFile().agentSkills).toEqual({ [PROJECT_ROOT]: false });
    });

    it('writes nothing under CI', async () => {
      vi.mocked(isCI).mockReturnValue(true);

      const result = await installSkills({ packageManager, yes: true, agent: true });

      expect(packageManager.runPackageCommand).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'skipped', source: 'ci' });
      expect(settingsFile().agentSkills).toBeUndefined();
    });
  });

  describe('the prompt', () => {
    it('installs on Yes', async () => {
      const result = await installSkills({ packageManager });

      expect(prompt.confirm).toHaveBeenCalledWith({
        message:
          'Install the official Storybook skills for AI agents (Claude Code, Codex, Cursor) into this project?',
        initialValue: true,
      });
      expect(result).toEqual({ result: 'installed', source: 'prompt', refType: 'tag' });
    });

    it('declines on No, remembers false and spawns nothing', async () => {
      vi.mocked(prompt.confirm).mockResolvedValue(false);

      const result = await installSkills({ packageManager });

      expect(packageManager.runPackageCommand).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'declined', source: 'prompt' });
      expect(settingsFile().agentSkills).toEqual({ [PROJECT_ROOT]: false });
    });

    it('takes the default without asking when stdout is not a terminal', async () => {
      setStdoutIsTTY(false);

      const result = await installSkills({ packageManager });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'installed', source: 'default', refType: 'tag' });
    });
  });
});
