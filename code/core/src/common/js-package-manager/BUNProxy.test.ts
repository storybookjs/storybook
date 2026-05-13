import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, prompt } from 'storybook/internal/node-logger';
import { MinimumReleaseAgeHandledError } from 'storybook/internal/server-errors';

import { executeCommand } from '../utils/command.ts';
import { JsPackageManager } from './JsPackageManager.ts';
import { BUNProxy } from './BUNProxy.ts';

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

const mockedExecuteCommand = vi.mocked(executeCommand);

describe('BUN Proxy', () => {
  let bunProxy: BUNProxy;

  beforeEach(() => {
    vi.useRealTimers();
    bunProxy = new BUNProxy();
    JsPackageManager.clearLatestVersionCache();
    vi.clearAllMocks();
  });

  it('type should be bun', () => {
    expect(bunProxy.type).toEqual('bun');
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
          'minimumReleaseAgeExcludes = ["storybook", "@storybook/*", "eslint-plugin-storybook", "@chromatic-com/storybook"]',
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
  });

  describe('updateMinimumReleaseAgeExcludes', () => {
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
            '  "storybook",',
            '  "@storybook/*",',
            '  "eslint-plugin-storybook",',
            '  "@chromatic-com/storybook",',
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
  });

});
