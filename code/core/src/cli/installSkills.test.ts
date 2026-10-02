import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import {
  ExecaCommandFailedError,
  PackageInstallFailedError,
} from 'storybook/internal/server-errors';
import { isTelemetryModuleEnabled } from 'storybook/internal/telemetry';

import { vol } from 'memfs';

import { _clearGlobalSettings } from './globalSettings.ts';
import { decideSkillsInstall, installSkills } from './installSkills.ts';

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
const SETTINGS_PATH = join(homedir(), '.storybook', 'settings.json');
const INSTALL_ARGS = (ref: string) => [
  'skills@latest',
  'add',
  `storybookjs/skills#${ref}`,
  '--yes',
  '--agent',
  'claude-code',
  'universal',
  '--copy',
];

const terminalStreams = [process.stdin, process.stdout];
const originalIsTTY = terminalStreams.map((stream) =>
  Object.getOwnPropertyDescriptor(stream, 'isTTY')
);
const setIsTTY = (stream: NodeJS.ReadStream | NodeJS.WriteStream, value: boolean) =>
  Object.defineProperty(stream, 'isTTY', { value, configurable: true });

const settingsFile = () => JSON.parse(vol.readFileSync(SETTINGS_PATH, 'utf8') as string);
const seedSettings = (agentSkills?: Record<string, boolean>) =>
  vol.fromNestedJSON({
    [SETTINGS_PATH]: JSON.stringify({ version: 1, userSince: 1, agentSkills }),
  });

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
    setIsTTY(process.stdin, true);
    setIsTTY(process.stdout, true);
  });

  afterEach(() => {
    terminalStreams.forEach((stream, index) => {
      const original = originalIsTTY[index];
      if (original) {
        Object.defineProperty(stream, 'isTTY', original);
      } else {
        delete (stream as { isTTY?: boolean }).isTTY;
      }
    });
    vol.reset();
  });

  describe('the command', () => {
    it('installs from the tag of the running Storybook version', async () => {
      const result = await installSkills({ packageManager, yes: true });

      expect(packageManager.runPackageCommand).toHaveBeenCalledWith({
        args: INSTALL_ARGS('v10.6.0'),
        useRemotePkg: true,
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        env: {},
        timeout: 120_000,
      });
      expect(result).toEqual({ result: 'installed', source: 'yes' });
    });

    it('disables Vercel telemetry when Storybook telemetry is disabled', async () => {
      vi.mocked(isTelemetryModuleEnabled).mockReturnValue(false);

      await installSkills({ packageManager, yes: true });

      expect(vi.mocked(packageManager.runPackageCommand).mock.calls[0][0].env).toEqual({
        DISABLE_TELEMETRY: '1',
      });
    });

    it('prints the literal command and the skip line', async () => {
      await installSkills({ packageManager, yes: true });

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'npx skills@latest add storybookjs/skills#v10.6.0 --yes --agent claude-code universal --copy'
        )
      );
      expect(logger.log).toHaveBeenCalledWith(
        'Skip this next time with --no-skills. Remove them with: npx skills@latest remove'
      );
    });
  });

  describe('failure', () => {
    it.each([
      ['npx', ExecaCommandFailedError],
      ['pnpm', PackageInstallFailedError],
    ])(
      'warns, keeps the settings untouched and reports the exit code (%s)',
      async (command, Err) => {
        vi.mocked(packageManager.runPackageCommand).mockRejectedValue(
          new Err({ command, args: [], exitCode: 1, logs: '' })
        );

        const result = await installSkills({ packageManager, yes: true });

        expect(result).toEqual({ result: 'failed', source: 'yes', exitCode: 1 });
        expect(logger.warn).toHaveBeenCalledWith(
          'Could not install the Storybook skills, continuing without them.'
        );
        expect(settingsFile().agentSkills).toBeUndefined();
      }
    );
  });

  describe('the settings', () => {
    it('refreshes silently when the project remembered true', async () => {
      seedSettings({ [PROJECT_ROOT]: true });

      const result = await installSkills({ packageManager });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'installed', source: 'settings' });
    });

    it('skips silently when the project remembered false', async () => {
      seedSettings({ [PROJECT_ROOT]: false });

      const result = await installSkills({ packageManager, yes: true, agent: true });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(packageManager.runPackageCommand).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'skipped', source: 'settings' });
    });

    it('asks when another project is remembered but this one is not, and keeps both answers', async () => {
      seedSettings({ '/other/project': false });

      await installSkills({ packageManager });

      expect(prompt.confirm).toHaveBeenCalled();
      expect(settingsFile().agentSkills).toEqual({
        '/other/project': false,
        [PROJECT_ROOT]: true,
      });
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

      expect(result).toEqual({ result: 'installed', source: 'flag' });
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

      expect(prompt.confirm).toHaveBeenCalledWith(
        {
          message: 'Install the official Storybook skills for AI agents into this project?',
          initialValue: true,
        },
        expect.anything()
      );
      expect(result).toEqual({ result: 'installed', source: 'prompt' });
    });

    it('declines on No, remembers false and spawns nothing', async () => {
      vi.mocked(prompt.confirm).mockResolvedValue(false);

      const result = await installSkills({ packageManager });

      expect(packageManager.runPackageCommand).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'declined', source: 'prompt' });
      expect(settingsFile().agentSkills).toEqual({ [PROJECT_ROOT]: false });
    });

    it('declines without remembering when the prompt is canceled', async () => {
      vi.mocked(prompt.confirm).mockImplementation(async (_, promptOptions) => {
        await promptOptions?.onCancel?.();
        return true;
      });

      const result = await installSkills({ packageManager });

      expect(packageManager.runPackageCommand).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'declined', source: 'prompt' });
      expect(settingsFile().agentSkills).toBeUndefined();
    });

    it.each([
      ['stdout', process.stdout],
      ['stdin', process.stdin],
    ])('takes the default without asking when %s is not a terminal', async (_, stream) => {
      setIsTTY(stream, false);

      const result = await installSkills({ packageManager });

      expect(prompt.confirm).not.toHaveBeenCalled();
      expect(result).toEqual({ result: 'installed', source: 'default' });
    });
  });
});
