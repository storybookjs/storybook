import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execa, execaCommandSync } from 'execa';

import { executeCommand, executeCommandSync } from './command';

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

const mockedExeca = vi.mocked(execa);
const mockedExecaCommandSync = vi.mocked(execaCommandSync);

describe('command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('should try .cmd first for pnpm and succeed', async () => {
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

    it('should try .exe after .cmd fails with "not recognized" error for pnpm', async () => {
      // First call fails with "not recognized" error
      mockedExeca.mockRejectedValueOnce({
        stderr:
          "'pnpm.cmd' is not recognized as an internal or external command,\r\noperable program or batch file.",
        message: 'Command failed: pnpm.cmd --version',
      });

      // Second call succeeds
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledTimes(2);
      expect(mockedExeca).toHaveBeenNthCalledWith(1, 'pnpm.cmd', ['--version'], expect.anything());
      expect(mockedExeca).toHaveBeenNthCalledWith(2, 'pnpm.exe', ['--version'], expect.anything());
    });

    it('should try .ps1 after .exe fails with "not recognized" error for pnpm', async () => {
      // First two calls fail with "not recognized" error
      mockedExeca.mockRejectedValueOnce({
        stderr: "'pnpm.cmd' is not recognized as an internal or external command",
        message: 'Command failed',
      });

      mockedExeca.mockRejectedValueOnce({
        stderr: "'pnpm.exe' is not recognized as an internal or external command",
        message: 'Command failed',
      });

      // Third call succeeds
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledTimes(3);
      expect(mockedExeca).toHaveBeenNthCalledWith(1, 'pnpm.cmd', ['--version'], expect.anything());
      expect(mockedExeca).toHaveBeenNthCalledWith(2, 'pnpm.exe', ['--version'], expect.anything());
      expect(mockedExeca).toHaveBeenNthCalledWith(3, 'pnpm.ps1', ['--version'], expect.anything());
    });

    it('should try bare command after all extensions fail with "not recognized" error', async () => {
      // First three calls fail with "not recognized" error
      mockedExeca.mockRejectedValueOnce({
        stderr: "'pnpm.cmd' is not recognized as an internal or external command",
        message: 'Command failed',
      });

      mockedExeca.mockRejectedValueOnce({
        stderr: "'pnpm.exe' is not recognized as an internal or external command",
        message: 'Command failed',
      });

      mockedExeca.mockRejectedValueOnce({
        stderr: "'pnpm.ps1' is not recognized as an internal or external command",
        message: 'Command failed',
      });

      // Fourth call succeeds
      mockedExeca.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedExeca).toHaveBeenCalledTimes(4);
      expect(mockedExeca).toHaveBeenNthCalledWith(4, 'pnpm', ['--version'], expect.anything());
    });

    it('should throw error immediately if first call fails with non-"not recognized" error', async () => {
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

    it('should throw error on last variation if all fail with "not recognized" error', async () => {
      const error = {
        stderr: "'pnpm' is not recognized as an internal or external command",
        message: 'Command failed',
      };

      mockedExeca.mockRejectedValue(error);

      await expect(
        executeCommand({
          command: 'pnpm',
          args: ['--version'],
        })
      ).rejects.toEqual(error);

      expect(mockedExeca).toHaveBeenCalledTimes(4); // .exe, .cmd, .ps1, bare command
    });

    it('should work for npm command', async () => {
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
      // First call fails
      mockedExecaCommandSync.mockImplementationOnce(() => {
        throw {
          stderr: "'pnpm.cmd' is not recognized as an internal or external command",
          message: 'Command failed',
        };
      });

      // Second call succeeds
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
    it('should suppress errors when ignoreError is true for executeCommand', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('Command failed'));

      const promise = executeCommand({
        command: 'pnpm',
        args: ['--version'],
        ignoreError: true,
      });

      // Should not throw
      await expect(promise).resolves.toBeUndefined();
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
