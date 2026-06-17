import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execa, execaCommandSync } from 'execa';

import { executeCommand, executeCommandSync } from './command.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  prompt: {
    getPreferredStdio: vi.fn(() => 'pipe'),
  },
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
  execaCommandSync: vi.fn(),
  execaNode: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

const mockedExeca = vi.mocked(execa);
const mockedExecaCommandSync = vi.mocked(execaCommandSync);
const mockedExistsSync = vi.mocked(existsSync);

describe('command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no executables found in PATH
    mockedExistsSync.mockReturnValue(false);
  });

  describe('executeCommand on Windows', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should use .cmd when found in PATH for pnpm', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('pnpm.cmd'));
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledTimes(1);
      expect(mockedExeca).toHaveBeenCalledWith(
        'pnpm.cmd',
        ['--version'],
        expect.objectContaining({
          encoding: 'utf8',
          cleanup: true,
        })
      );
    });

    it('should use .exe when .cmd not found but .exe exists in PATH', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('pnpm.exe'));
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledTimes(1);
      expect(mockedExeca).toHaveBeenCalledWith(
        'pnpm.exe',
        ['--version'],
        expect.objectContaining({
          encoding: 'utf8',
          cleanup: true,
        })
      );
    });

    it('should use .ps1 when neither .cmd nor .exe found but .ps1 exists in PATH', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('pnpm.ps1'));
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledTimes(1);
      expect(mockedExeca).toHaveBeenCalledWith(
        'pnpm.ps1',
        ['--version'],
        expect.objectContaining({
          encoding: 'utf8',
          cleanup: true,
        })
      );
    });

    it('should fall back to bare command when no variation found in PATH', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledTimes(1);
      expect(mockedExeca).toHaveBeenCalledWith('pnpm', ['--version'], expect.anything());
    });

    it('should prefer .cmd over .exe when both exist in PATH', async () => {
      mockedExistsSync.mockImplementation(
        (p) => String(p).endsWith('pnpm.exe') || String(p).endsWith('pnpm.cmd')
      );
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledTimes(1);
      expect(mockedExeca).toHaveBeenCalledWith('pnpm.cmd', ['--version'], expect.anything());
    });

    it('should propagate errors from the resolved command', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedExeca.mockRejectedValueOnce({
        stderr: 'Some other error',
        message: 'Command failed with different error',
      });

      await expect(
        executeCommand({
          command: 'pnpm',
          args: ['--version'],
        })
      ).rejects.toEqual({
        stderr: 'Some other error',
        message: 'Command failed with different error',
      });

      expect(mockedExeca).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors when resolved command is not found', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('pnpm.cmd'));
      const error = {
        stderr: "'pnpm.cmd' is not recognized as an internal or external command",
        message: 'Command failed',
      };
      mockedExeca.mockRejectedValueOnce(error);

      await expect(
        executeCommand({
          command: 'pnpm',
          args: ['--version'],
        })
      ).rejects.toEqual(error);

      expect(mockedExeca).toHaveBeenCalledTimes(1);
    });

    it('should work for npm command', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('npm.cmd'));
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'npm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledWith('npm.cmd', ['--version'], expect.anything());
    });

    it('should work for yarn command', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('yarn.cmd'));
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'yarn',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledWith('yarn.cmd', ['--version'], expect.anything());
    });

    it('should not modify unknown commands on Windows', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'git',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledWith('git', ['--version'], expect.anything());
    });
  });

  describe('executeCommand on non-Windows', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should use command as-is for pnpm on Linux', async () => {
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledWith('pnpm', ['--version'], expect.anything());
    });

    it('should use command as-is for npm on macOS', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'npm',
        args: ['install'],
      });

      expect(mockedExeca).toHaveBeenCalledWith('npm', ['install'], expect.anything());
    });
  });

  describe('executeCommandSync on Windows', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should try .cmd first for pnpm and succeed', () => {
      mockedExecaCommandSync.mockReturnValueOnce({
        stdout: '10.0.0',
        stderr: '',
      } as any);

      const result = executeCommandSync({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(result).toBe('10.0.0');
      expect(mockedExecaCommandSync).toHaveBeenCalledTimes(1);
      expect(mockedExecaCommandSync).toHaveBeenCalledWith(
        'pnpm.cmd --version',
        expect.objectContaining({
          encoding: 'utf8',
          cleanup: true,
        })
      );
    });

    it('should try .exe after .cmd fails with "not recognized" error', () => {
      // First call (.cmd) fails
      mockedExecaCommandSync.mockImplementationOnce(() => {
        throw {
          stderr: "'pnpm.cmd' is not recognized as an internal or external command",
          message: 'Command failed',
        };
      });

      // Second call (.exe) succeeds
      mockedExecaCommandSync.mockReturnValueOnce({
        stdout: '10.0.0',
        stderr: '',
      } as any);

      const result = executeCommandSync({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(result).toBe('10.0.0');
      expect(mockedExecaCommandSync).toHaveBeenCalledTimes(2);
      expect(mockedExecaCommandSync).toHaveBeenNthCalledWith(
        1,
        'pnpm.cmd --version',
        expect.anything()
      );
      expect(mockedExecaCommandSync).toHaveBeenNthCalledWith(
        2,
        'pnpm.exe --version',
        expect.anything()
      );
    });

    it('should throw error immediately if first call fails with non-"not recognized" error', () => {
      mockedExecaCommandSync.mockImplementationOnce(() => {
        throw {
          stderr: 'Some other error',
          message: 'Command failed with different error',
        };
      });

      expect(() =>
        executeCommandSync({
          command: 'pnpm',
          args: ['--version'],
        })
      ).toThrow();

      expect(mockedExecaCommandSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeCommandSync on non-Windows', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should use command as-is for pnpm on Linux', () => {
      mockedExecaCommandSync.mockReturnValueOnce({
        stdout: '10.0.0',
        stderr: '',
      } as any);

      const result = executeCommandSync({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(result).toBe('10.0.0');
      expect(mockedExecaCommandSync).toHaveBeenCalledWith('pnpm --version', expect.anything());
    });
  });

  describe('ignoreError option', () => {
    it('should not throw unhandled rejection when ignoreError is true for executeCommand', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('Command failed'));

      const promise = executeCommand({
        command: 'pnpm',
        args: ['--version'],
        ignoreError: true,
      });

      // The .catch() handler in executeCommand prevents unhandled rejection warnings,
      // but the returned promise still rejects since it's the original ResultPromise
      await expect(promise).rejects.toThrow('Command failed');
    });

    it('should return empty string when ignoreError is true for executeCommandSync', () => {
      mockedExecaCommandSync.mockImplementationOnce(() => {
        throw new Error('Command failed');
      });

      const result = executeCommandSync({
        command: 'pnpm',
        args: ['--version'],
        ignoreError: true,
      });

      expect(result).toBe('');
    });
  });
});
