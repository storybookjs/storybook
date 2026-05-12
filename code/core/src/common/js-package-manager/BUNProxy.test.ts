import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, prompt } from 'storybook/internal/node-logger';

import { executeCommand } from '../utils/command.ts';
import { JsPackageManager } from './JsPackageManager.ts';
import { BUNProxy } from './BUNProxy.ts';
import { MinimumReleaseAgeHandledError } from './MinimumReleaseAgeHandledError.ts';

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
      mockedExecuteCommand.mockRejectedValueOnce(
        new Error('error: @storybook/react@10.4.0-alpha.17 blocked by minimum-release-age')
      );

      await expect(bunProxy.installDependencies()).rejects.toBeInstanceOf(
        MinimumReleaseAgeHandledError
      );
    });
  });

  describe('precheckStorybookPackageInstall', () => {
    it('updates minimumReleaseAgeExcludes in non-interactive mode when bun would block Storybook', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-10T00:00:00.000Z'));
      vi.spyOn(bunProxy as any, 'readBunfig').mockReturnValue('minimumReleaseAge = 3600\n');
      const updateSpy = vi.spyOn(bunProxy as any, 'updateMinimumReleaseAgeExcludes');
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
      const updateSpy = vi.spyOn(bunProxy as any, 'updateMinimumReleaseAgeExcludes');
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
  });

  describe('parseErrors', () => {
    it('formats exact-version minimum release age errors', () => {
      const parsedError = bunProxy.parseErrorFromLogs(
        'error: Version "storybook@10.4.0-alpha.17" was published within minimum release age of 9999999999 seconds'
      );

      expect(parsedError).toContain('storybook@10.4.0-alpha.17');
      expect(parsedError).toContain('minimumReleaseAgeExcludes');
      expect(parsedError).toContain('https://bun.com/docs/pm/cli/install#minimum-release-age');
    });

    it('formats ranged minimum-release-age errors', () => {
      const parsedError = bunProxy.parseErrorFromLogs(
        [
          'error: No version matching "storybook" found for specifier "^10.4.0-alpha.17" (blocked by minimum-release-age: 9999999999 seconds)',
          'error: storybook@^10.4.0-alpha.17 failed to resolve',
        ].join('\n')
      );

      expect(parsedError).toContain('storybook@^10.4.0-alpha.17');
      expect(parsedError).toContain('minimumReleaseAgeExcludes');
      expect(parsedError).toContain('https://bun.com/docs/pm/cli/install#minimum-release-age');
    });
  });
});
