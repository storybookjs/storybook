import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCommand, executeCommandSync } from './command.ts';
import { spawnSubprocess, spawnSubprocessSync } from './subprocess.ts';
import { ExecaCommandFailedError } from '../../server-errors.ts';

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

vi.mock('./subprocess.ts', () => ({
  spawnSubprocess: vi.fn(),
  spawnSubprocessSync: vi.fn(),
  spawnNodeSubprocess: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

const mockedSpawn = vi.mocked(spawnSubprocess);
const mockedSpawnSync = vi.mocked(spawnSubprocessSync);
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
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenCalledWith(
        'pnpm.cmd',
        ['--version'],
        expect.objectContaining({
          cleanup: true,
        })
      );
    });

    it('should use .exe when .cmd not found but .exe exists in PATH', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('pnpm.exe'));
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenCalledWith(
        'pnpm.exe',
        ['--version'],
        expect.objectContaining({
          cleanup: true,
        })
      );
    });

    it('should use .ps1 when neither .cmd nor .exe found but .ps1 exists in PATH', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('pnpm.ps1'));
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenCalledWith(
        'pnpm.ps1',
        ['--version'],
        expect.objectContaining({
          cleanup: true,
        })
      );
    });

    it('should fall back to bare command when no variation found in PATH', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenCalledWith('pnpm', ['--version'], expect.anything());
    });

    it('should prefer .cmd over .exe when both exist in PATH', async () => {
      mockedExistsSync.mockImplementation(
        (p) => String(p).endsWith('pnpm.exe') || String(p).endsWith('pnpm.cmd')
      );
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      expect(mockedSpawn).toHaveBeenCalledWith('pnpm.cmd', ['--version'], expect.anything());
    });

    it('should propagate categorized errors from the resolved command', async () => {
      mockedExistsSync.mockReturnValue(false);
      mockedSpawn.mockRejectedValueOnce({
        stderr: 'Some other error',
        message: 'Command failed with different error',
        exitCode: 1,
      });

      await expect(
        executeCommand({
          command: 'pnpm',
          args: ['--version'],
        })
      ).rejects.toBeInstanceOf(ExecaCommandFailedError);

      expect(mockedSpawn).toHaveBeenCalledTimes(1);
    });

    it('should preserve subprocess methods like on after attaching categorized errors', async () => {
      const on = vi.fn();
      mockedSpawn.mockReturnValueOnce(
        Object.assign(Promise.resolve({ stdout: 'success', stderr: '' }), { on }) as any
      );

      const process = executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      process.on('exit', on);
      await process;

      expect(on).toHaveBeenCalledWith('exit', expect.any(Function));
    });

    it('should propagate categorized errors when resolved command is not found', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('pnpm.cmd'));
      const error = {
        stderr: "'pnpm.cmd' is not recognized as an internal or external command",
        message: 'Command failed',
        exitCode: 1,
      };
      mockedSpawn.mockRejectedValueOnce(error);

      await expect(
        executeCommand({
          command: 'pnpm',
          args: ['--version'],
        })
      ).rejects.toMatchObject({
        name: expect.stringContaining('PackageManagerBinaryNotFoundError'),
      });

      expect(mockedSpawn).toHaveBeenCalledTimes(1);
    });

    it('should work for npm command', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('npm.cmd'));
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'npm',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledWith('npm.cmd', ['--version'], expect.anything());
    });

    it('should work for yarn command', async () => {
      mockedExistsSync.mockImplementation((p) => String(p).endsWith('yarn.cmd'));
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'yarn',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledWith('yarn.cmd', ['--version'], expect.anything());
    });

    it('should not modify unknown commands on Windows', async () => {
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'git',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledWith('git', ['--version'], expect.anything());
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
      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(mockedSpawn).toHaveBeenCalledWith('pnpm', ['--version'], expect.anything());
    });

    it('should use command as-is for npm on macOS', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      mockedSpawn.mockResolvedValueOnce({
        stdout: 'success',
        stderr: '',
      } as any);

      await executeCommand({
        command: 'npm',
        args: ['install'],
      });

      expect(mockedSpawn).toHaveBeenCalledWith('npm', ['install'], expect.anything());
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
      mockedSpawnSync.mockReturnValueOnce({
        stdout: '10.0.0',
        stderr: '',
      } as any);

      const result = executeCommandSync({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(result).toBe('10.0.0');
      expect(mockedSpawnSync).toHaveBeenCalledTimes(1);
      expect(mockedSpawnSync).toHaveBeenCalledWith(
        'pnpm.cmd',
        ['--version'],
        expect.objectContaining({
          cleanup: true,
        })
      );
    });

    it('should try .exe after .cmd fails with "not recognized" error', () => {
      // First call (.cmd) fails
      mockedSpawnSync.mockImplementationOnce(() => {
        throw {
          stderr: "'pnpm.cmd' is not recognized as an internal or external command",
          message: 'Command failed',
        };
      });

      // Second call (.exe) succeeds
      mockedSpawnSync.mockReturnValueOnce({
        stdout: '10.0.0',
        stderr: '',
      } as any);

      const result = executeCommandSync({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(result).toBe('10.0.0');
      expect(mockedSpawnSync).toHaveBeenCalledTimes(2);
      expect(mockedSpawnSync).toHaveBeenNthCalledWith(
        1,
        'pnpm.cmd',
        ['--version'],
        expect.anything()
      );
      expect(mockedSpawnSync).toHaveBeenNthCalledWith(
        2,
        'pnpm.exe',
        ['--version'],
        expect.anything()
      );
    });

    it('should throw categorized error immediately if first call fails with non-"not recognized" error', () => {
      mockedSpawnSync.mockImplementationOnce(() => {
        throw {
          stderr: 'Some other error',
          message: 'Command failed with different error',
          exitCode: 1,
        };
      });

      expect(() =>
        executeCommandSync({
          command: 'pnpm',
          args: ['--version'],
        })
      ).toThrow(ExecaCommandFailedError);

      expect(mockedSpawnSync).toHaveBeenCalledTimes(1);
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
      mockedSpawnSync.mockReturnValueOnce({
        stdout: '10.0.0',
        stderr: '',
      } as any);

      const result = executeCommandSync({
        command: 'pnpm',
        args: ['--version'],
      });

      expect(result).toBe('10.0.0');
      expect(mockedSpawnSync).toHaveBeenCalledWith('pnpm', ['--version'], expect.anything());
    });
  });

  describe('ignoreError option', () => {
    it('should not throw unhandled rejection when ignoreError is true for executeCommand', async () => {
      mockedSpawn.mockRejectedValueOnce(new Error('Command failed'));

      const promise = executeCommand({
        command: 'pnpm',
        args: ['--version'],
        ignoreError: true,
      });

      // The .catch() handler in executeCommand prevents unhandled rejection warnings,
      // but the returned promise still rejects since it's the original subprocess
      await expect(promise).rejects.toThrow('Command failed');
    });

    it('should return empty string when ignoreError is true for executeCommandSync', () => {
      mockedSpawnSync.mockImplementationOnce(() => {
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
