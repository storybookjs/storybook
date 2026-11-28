import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, prompt } from 'storybook/internal/node-logger';
import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import { executeCommand } from '../utils/command.ts';
import { JsPackageManager } from './JsPackageManager.ts';
import { BUNProxy } from './BUNProxy.ts';
import { STORYBOOK_PACKAGE_PATTERNS, STORYBOOK_PACKAGE_NAMES } from './util.ts';

vi.mock('storybook/internal/node-logger', () => ({
  prompt: {
    executeTaskWithSpinner: vi.fn(),
    getPreferredStdio: vi.fn(() => 'inherit'),
    select: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock(import('../utils/command.ts'), { spy: true });
vi.mock(import('node:os'), { spy: true });

const mockedExecuteCommand = vi.mocked(executeCommand);

describe('BUN Proxy', () => {
  let bunProxy: BUNProxy;

  beforeEach(() => {
    vi.useRealTimers();
    bunProxy = new BUNProxy();
    JsPackageManager.clearLatestVersionCache();
    vi.clearAllMocks();
    vi.mocked(homedir).mockReturnValue(join(tmpdir(), 'storybook-bun-proxy-missing-home'));
    vi.stubEnv('XDG_CONFIG_HOME', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('type should be bun', () => {
    expect(bunProxy.type).toEqual('bun');
  });

  describe('getRegistryURL', () => {
    it('uses npm 12-compatible workspace flags', async () => {
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValueOnce({
        stdout: 'https://registry.npmjs.org/',
      } as Awaited<ReturnType<typeof executeCommand>>);

      await expect(bunProxy.getRegistryURL()).resolves.toBe('https://registry.npmjs.org/');

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['config', 'get', 'registry', '--workspaces=false', '--include-workspace-root'],
        })
      );
    });
  });

  describe('installDependencies', () => {
    it('should run `bun install`', async () => {
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      const executeCommandSpy = mockedExecuteCommand.mockResolvedValue({ stdout: '' } as any);

      await bunProxy.installDependencies();

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'bun', args: ['install'] })
      );
    });

    it('should rethrow minimum-release-age install errors as handled errors', async () => {
      vi.mocked(prompt.executeTaskWithSpinner).mockImplementationOnce(async (fn: any) => {
        await Promise.resolve(fn());
      });
      const originalError = new Error(
        'error: @storybook/react@10.4.0-alpha.17 blocked by minimum-release-age'
      );
      mockedExecuteCommand.mockRejectedValueOnce(originalError);

      const error = await bunProxy.installDependencies().then(
        () => null,
        (caughtError) => caughtError
      );

      expect(error).toBeInstanceOf(MinimumReleaseAgeHandledError);
      expect(error).toMatchObject({ cause: originalError });
      expect(error?.message).toContain('minimumReleaseAge');
      expect(error?.message).toContain('minimumReleaseAgeExcludes');
    });
  });

  describe('precheckStorybookPackageInstall', () => {
    it('updates minimumReleaseAgeExcludes in non-interactive mode when bun would block Storybook', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-10T00:00:00.000Z'));
      vi.spyOn(bunProxy as any, 'readBunfig').mockReturnValue('minimumReleaseAge = 3600\n');
      const updateSpy = vi
        .spyOn(bunProxy as any, 'updateMinimumReleaseAgeExcludes')
        .mockImplementation(() => undefined);
      mockedExecuteCommand.mockResolvedValueOnce({
        stdout: JSON.stringify({
          '10.4.0-alpha.17': '2025-01-09T23:30:00.000Z',
          '10.3.9': '2025-01-09T20:00:00.000Z',
        }),
      } as any);

      await bunProxy.precheckStorybookPackageInstall({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: true,
        installContext: 'create',
      });

      expect(updateSpy).toHaveBeenCalled();
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        expect.stringContaining('minimumReleaseAgeExcludes')
      );
    });

    it('lets the user update minimumReleaseAgeExcludes interactively', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-10T00:00:00.000Z'));
      vi.spyOn(bunProxy as any, 'readBunfig').mockReturnValue('minimumReleaseAge = 3600\n');
      const updateSpy = vi
        .spyOn(bunProxy as any, 'updateMinimumReleaseAgeExcludes')
        .mockImplementation(() => undefined);
      mockedExecuteCommand.mockResolvedValueOnce({
        stdout: JSON.stringify({
          '10.4.0-alpha.17': '2025-01-09T23:30:00.000Z',
          '10.3.9': '2025-01-09T20:00:00.000Z',
        }),
      } as any);
      vi.mocked(prompt.select).mockResolvedValueOnce('exclude');

      await bunProxy.precheckStorybookPackageInstall({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: false,
        installContext: 'create',
      });

      expect(updateSpy).toHaveBeenCalled();
    });

    it('throws rerun guidance when the user chooses rerun', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-10T00:00:00.000Z'));
      vi.spyOn(bunProxy as any, 'readBunfig').mockReturnValue('minimumReleaseAge = 3600\n');
      mockedExecuteCommand.mockResolvedValueOnce({
        stdout: JSON.stringify({
          '10.4.0-alpha.17': '2025-01-09T23:30:00.000Z',
          '10.3.9': '2025-01-09T20:00:00.000Z',
        }),
      } as any);
      vi.mocked(prompt.select).mockResolvedValueOnce('rerun');

      const error = await bunProxy
        .precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'upgrade',
        })
        .then(
          () => null,
          (caughtError) => caughtError
        );

      expect(error).toBeInstanceOf(MinimumReleaseAgeHandledError);
      expect(error?.message).toContain('npx storybook@10.3.9 upgrade');
    });

    it('skips the precheck when Storybook packages are already excluded', async () => {
      vi.spyOn(bunProxy as any, 'readBunfig').mockReturnValue(
        [
          '[install]',
          'minimumReleaseAge = 3600',
          `minimumReleaseAgeExcludes = ${JSON.stringify(STORYBOOK_PACKAGE_NAMES)}`,
          '',
        ].join('\n')
      );
      const updateSpy = vi.spyOn(bunProxy as any, 'updateMinimumReleaseAgeExcludes');

      await expect(
        bunProxy.precheckStorybookPackageInstall({
          storybookVersion: '10.4.0-alpha.17',
          nonInteractive: false,
          installContext: 'upgrade',
        })
      ).resolves.toBeUndefined();

      expect(mockedExecuteCommand).not.toHaveBeenCalled();
      expect(vi.mocked(prompt.select)).not.toHaveBeenCalled();
      expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('does not count a glob pattern as an exclusion, because Bun matches exact names', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-10T00:00:00.000Z'));
      vi.spyOn(bunProxy as any, 'readBunfig').mockReturnValue(
        `minimumReleaseAge = 3600\nminimumReleaseAgeExcludes = ${JSON.stringify(STORYBOOK_PACKAGE_PATTERNS)}\n`
      );
      const updateSpy = vi
        .spyOn(bunProxy as any, 'updateMinimumReleaseAgeExcludes')
        .mockImplementation(() => undefined);
      mockedExecuteCommand.mockResolvedValueOnce({
        stdout: JSON.stringify({ '10.4.0-alpha.17': '2025-01-09T23:30:00.000Z' }),
      } as any);

      await bunProxy.precheckStorybookPackageInstall({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: true,
        installContext: 'upgrade',
      });

      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('updateMinimumReleaseAgeExcludes', () => {
    const storybookEntries = (indent: string) =>
      STORYBOOK_PACKAGE_NAMES.map((name) => `${indent}  "${name}",`);

    it.each([
      {
        form: 'indented settings',
        bunfig: [
          '[install]',
          '  minimumReleaseAge = 86400',
          '  minimumReleaseAgeExcludes = ["react"]',
        ],
        expected: [
          '[install]',
          '  minimumReleaseAge = 86400',
          '  minimumReleaseAgeExcludes = [',
          '    "react",',
          ...storybookEntries('  '),
          '  ]',
        ],
      },
      {
        form: 'dotted keys',
        bunfig: ['install.minimumReleaseAge = 86400'],
        expected: [
          'install.minimumReleaseAge = 86400',
          'install.minimumReleaseAgeExcludes = [',
          ...storybookEntries(''),
          ']',
        ],
      },
      {
        form: 'a list with a bracket in a comment',
        bunfig: [
          '[install]',
          'minimumReleaseAge = 86_400',
          'minimumReleaseAgeExcludes = [',
          '  "react", # reviewed [react]',
          ']',
        ],
        expected: [
          '[install]',
          'minimumReleaseAge = 86_400',
          'minimumReleaseAgeExcludes = [',
          '  "react",',
          ...storybookEntries(''),
          ']',
        ],
      },
      {
        form: 'a single quoted list',
        bunfig: ['[install]', 'minimumReleaseAge = 86400', "minimumReleaseAgeExcludes = ['react']"],
        expected: [
          '[install]',
          'minimumReleaseAge = 86400',
          'minimumReleaseAgeExcludes = [',
          '  "react",',
          ...storybookEntries(''),
          ']',
        ],
      },
    ])('edits $form in place, keeping their entries', ({ bunfig, expected }) => {
      const tempDir = mkdtempSync(join(tmpdir(), 'storybook-bun-proxy-'));
      const bunfigPath = join(tempDir, 'bunfig.toml');
      writeFileSync(join(tempDir, 'package.json'), '{}\n');
      writeFileSync(bunfigPath, [...bunfig, ''].join('\n'));

      try {
        const proxy = new BUNProxy({ cwd: tempDir }) as unknown as {
          updateMinimumReleaseAgeExcludes(): void;
        };
        proxy.updateMinimumReleaseAgeExcludes();

        expect(readFileSync(bunfigPath, 'utf-8')).toBe([...expected, ''].join('\n'));
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('adds minimumReleaseAgeExcludes inside the install section', () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'storybook-bun-proxy-'));
      const bunfigPath = join(tempDir, 'bunfig.toml');

      writeFileSync(join(tempDir, 'package.json'), '{}\n');
      const tempBunProxy = new BUNProxy({ cwd: tempDir });
      writeFileSync(
        bunfigPath,
        ['[install]', 'minimumReleaseAge = 900000', '[test]', 'coverageThreshold = 0.9', ''].join(
          '\n'
        )
      );

      try {
        (tempBunProxy as any).updateMinimumReleaseAgeExcludes();

        expect(readFileSync(bunfigPath, 'utf-8')).toBe(
          [
            '[install]',
            'minimumReleaseAge = 900000',
            'minimumReleaseAgeExcludes = [',
            ...STORYBOOK_PACKAGE_NAMES.map((name) => `  "${name}",`),
            ']',
            '[test]',
            'coverageThreshold = 0.9',
            '',
          ].join('\n')
        );
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('keeps the entries that are already listed, in either quote style', () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'storybook-bun-proxy-'));
      const bunfigPath = join(tempDir, 'bunfig.toml');

      writeFileSync(join(tempDir, 'package.json'), '{}\n');
      const tempBunProxy = new BUNProxy({ cwd: tempDir });
      writeFileSync(
        bunfigPath,
        [
          '[install]',
          'minimumReleaseAge = 900000',
          `minimumReleaseAgeExcludes = ['internal-package', "@storybook/*"]`,
          '',
        ].join('\n')
      );

      try {
        (tempBunProxy as any).updateMinimumReleaseAgeExcludes();

        expect(readFileSync(bunfigPath, 'utf-8')).toBe(
          [
            '[install]',
            'minimumReleaseAge = 900000',
            'minimumReleaseAgeExcludes = [',
            '  "internal-package",',
            '  "@storybook/*",',
            ...STORYBOOK_PACKAGE_NAMES.map((name) => `  "${name}",`),
            ']',
            '',
          ].join('\n')
        );
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('findInstallations', () => {
    it('finds a package that only another package depends on', async () => {
      mockedExecuteCommand.mockResolvedValue({
        stdout: JSON.stringify({
          dependencies: {
            'qa-wrapper': {
              version: '1.0.0',
              dependencies: { '@storybook/test-runner': { version: '0.24.0' } },
            },
          },
        }),
      } as any);

      const installations = await bunProxy.findInstallations(['@storybook/test-runner']);

      expect(installations?.dependencies).toEqual({
        '@storybook/test-runner': [{ version: '0.24.0', location: '' }],
      });
    });

    it('lists the version the project depends on before the versions its dependencies bring in', async () => {
      mockedExecuteCommand.mockResolvedValue({
        stdout: JSON.stringify({
          dependencies: {
            chalk: {
              version: '4.1.2',
              dependencies: { 'supports-color': { version: '7.2.0' } },
            },
            'supports-color': { version: '9.4.0' },
          },
        }),
      } as any);

      const installations = await bunProxy.findInstallations(['supports-color']);

      expect(installations?.dependencies).toEqual({
        'supports-color': [
          { version: '9.4.0', location: '' },
          { version: '7.2.0', location: '' },
        ],
      });
    });
  });

  describe('getReleaseAgeGate', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'storybook-bun-proxy-'));
      writeFileSync(join(tempDir, 'package.json'), '{}\n');
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    describe('when bunfig sets minimumReleaseAge', () => {
      beforeEach(() => {
        writeFileSync(
          join(tempDir, 'bunfig.toml'),
          [
            '[install]',
            'minimumReleaseAge = 86400',
            'minimumReleaseAgeExcludes = ["storybook", "@storybook/*", "@storybook/react@11.0.0-rc.0"]',
            '',
          ].join('\n')
        );
      });

      it('returns a strict gate in minutes', async () => {
        mockedExecuteCommand.mockResolvedValueOnce({ stdout: '1.4.5\n' } as any);

        const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

        expect(gate?.strict).toBe(true);
        expect(gate?.getMinutes('@storybook/react')).toBe(24 * 60);
      });

      it('excludes exact names only, since bun has no globs', async () => {
        mockedExecuteCommand.mockResolvedValueOnce({ stdout: '1.4.5\n' } as any);

        const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

        expect(gate?.isExcluded('storybook', '11.0.0-rc.0')).toBe(true);
        expect(gate?.isExcluded('@storybook/react-native', '11.0.0-next.2')).toBe(false);
      });

      it('excludes exact versions from bun 1.4.4', async () => {
        mockedExecuteCommand.mockResolvedValueOnce({ stdout: '1.4.4\n' } as any);

        const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

        expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(true);
        expect(gate?.isExcluded('@storybook/react', '11.0.0-beta.5')).toBe(false);
        expect(mockedExecuteCommand).toHaveBeenCalledWith(
          expect.objectContaining({ command: 'bun', args: ['--version'] })
        );
      });

      it('ignores exact versions before bun 1.4.4', async () => {
        mockedExecuteCommand.mockResolvedValueOnce({ stdout: '1.4.3\n' } as any);

        const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

        expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(false);
      });

      it('returns null when the bun version cannot be read', async () => {
        mockedExecuteCommand.mockRejectedValueOnce(new Error('bun is missing'));

        await expect(new BUNProxy({ cwd: tempDir }).getReleaseAgeGate()).resolves.toBeNull();
      });
    });

    describe('when there is no bunfig', () => {
      it('returns no gate', async () => {
        const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

        expect(gate?.getMinutes('@storybook/react')).toBe(0);
        expect(mockedExecuteCommand).not.toHaveBeenCalled();
      });
    });

    it.each([
      { form: 'a trailing comment', bunfig: '[install]\nminimumReleaseAge = 86400 # one day\n' },
      { form: 'digit separators', bunfig: '[install]\nminimumReleaseAge = 86_400\n' },
      { form: 'a dotted key', bunfig: 'install.minimumReleaseAge = 86400\n' },
    ])('reads minimumReleaseAge written with $form like bun', async ({ bunfig }) => {
      writeFileSync(join(tempDir, 'bunfig.toml'), bunfig);

      const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

      expect(gate?.getMinutes('@storybook/react')).toBe(24 * 60);
    });

    it.each([
      { form: 'single quotes', list: "['@storybook/react']" },
      {
        form: 'several lines with comments',
        list: '[\n  "storybook", # sb\n  "@storybook/react",\n]',
      },
      {
        form: 'a bracket in a comment',
        list: '[\n  "storybook", # reviewed [sb]\n  "@storybook/react",\n]',
      },
    ])('reads minimumReleaseAgeExcludes written with $form like bun', async ({ list }) => {
      writeFileSync(
        join(tempDir, 'bunfig.toml'),
        `[install]\nminimumReleaseAge = 86400\nminimumReleaseAgeExcludes = ${list}\n`
      );

      const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

      expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(true);
    });

    it('reads a dotted minimumReleaseAgeExcludes like bun', async () => {
      writeFileSync(
        join(tempDir, 'bunfig.toml'),
        'install.minimumReleaseAge = 86400\ninstall.minimumReleaseAgeExcludes = ["@storybook/react"]\n'
      );

      const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

      expect(gate?.isExcluded('@storybook/react', '11.0.0-rc.0')).toBe(true);
    });

    it.each([
      {
        form: 'an inline table',
        bunfig: 'install = { minimumReleaseAgeExcludes = ["storybook"] }\n',
      },
      {
        form: 'an entry that is not a string',
        bunfig: '[install]\nminimumReleaseAgeExcludes = ["storybook", 42]\n',
      },
    ])('returns null when minimumReleaseAgeExcludes is $form', async ({ bunfig }) => {
      writeFileSync(join(tempDir, 'bunfig.toml'), bunfig);

      await expect(new BUNProxy({ cwd: tempDir }).getReleaseAgeGate()).resolves.toBeNull();
    });

    it('ignores a minimumReleaseAge that is commented out', async () => {
      writeFileSync(join(tempDir, 'bunfig.toml'), '[install]\n# minimumReleaseAge = 86400\n');

      const gate = await new BUNProxy({ cwd: tempDir }).getReleaseAgeGate();

      expect(gate?.getMinutes('@storybook/react')).toBe(0);
    });

    it('returns null when bunfig sets minimumReleaseAge in a form it cannot read', async () => {
      writeFileSync(join(tempDir, 'bunfig.toml'), 'install = { minimumReleaseAge = 86400 }\n');

      await expect(new BUNProxy({ cwd: tempDir }).getReleaseAgeGate()).resolves.toBeNull();
    });

    it('returns null when a global bunfig sets minimumReleaseAge, which bun 1.4 reads', async () => {
      const home = mkdtempSync(join(tmpdir(), 'storybook-bun-proxy-home-'));
      writeFileSync(join(home, '.bunfig.toml'), '[install]\nminimumReleaseAge = 86400\n');
      vi.mocked(homedir).mockReturnValue(home);

      try {
        await expect(new BUNProxy({ cwd: tempDir }).getReleaseAgeGate()).resolves.toBeNull();
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    });
  });

  describe('getPublishedManifest', () => {
    const published = {
      version: '11.0.0-next.2',
      versions: ['11.0.0-next.1', '11.0.0-next.2'],
      time: { '11.0.0-next.2': '2026-11-15T10:00:00.000Z' },
      dependencies: { '@storybook/react': '^11.0.0-beta.3' },
      peerDependencies: { storybook: '^11.0.0-beta.1' },
    };
    const readManifest = () =>
      bunProxy.getPublishedManifest('@storybook/react-native', '11.0.0-next.2');

    describe('when the package manager prints the manifest', () => {
      beforeEach(() => {
        mockedExecuteCommand.mockResolvedValue({
          stdout: JSON.stringify({ name: '@storybook/react-native', ...published }),
        } as any);
      });

      it('reads it through the package manager', async () => {
        await expect(readManifest()).resolves.toEqual(published);
        expect(mockedExecuteCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'npm',
            args: ['info', '@storybook/react-native@11.0.0-next.2', '--json'],
          })
        );
      });

      it('reads the latest version when no version is given', async () => {
        await expect(bunProxy.getPublishedManifest('@storybook/react-native')).resolves.toEqual(
          published
        );
        expect(mockedExecuteCommand).toHaveBeenCalledWith(
          expect.objectContaining({ args: ['info', '@storybook/react-native', '--json'] })
        );
      });
    });

    describe('when the lookup fails', () => {
      beforeEach(() => {
        mockedExecuteCommand.mockRejectedValue(new Error('401 Unauthorized'));
      });

      it('returns null', async () => {
        await expect(readManifest()).resolves.toBeNull();
      });
    });
  });
});
