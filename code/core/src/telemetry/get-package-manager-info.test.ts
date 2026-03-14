import { beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand as rawExecaCommand } from 'execa';
import { detect as rawDetect } from 'package-manager-detector';

import { getPackageManagerInfo } from './get-package-manager-info';

vi.mock('execa', async () => {
  return {
    execaCommand: vi.fn(),
  };
});

vi.mock('package-manager-detector', async () => {
  return {
    detect: vi.fn(),
  };
});

vi.mock('../common', async () => {
  return {
    getProjectRoot: () => '/mock/project/root',
  };
});

const execaCommand = vi.mocked(rawExecaCommand);
const detect = vi.mocked(rawDetect);

beforeEach(() => {
  execaCommand.mockReset();
  detect.mockReset();
});

describe('getPackageManagerInfo', () => {
  describe('when no package manager is detected', () => {
    it('should return undefined', async () => {
      detect.mockResolvedValue(null);

      const result = await getPackageManagerInfo();

      expect(result).toBeUndefined();
    });
  });

  describe('when yarn is detected', () => {
    beforeEach(() => {
      detect.mockResolvedValue({
        name: 'yarn',
        version: '3.6.0',
        agent: 'yarn@berry',
      });
    });

    it('should return yarn info with default nodeLinker when command fails', async () => {
      execaCommand.mockRejectedValue(new Error('Command failed'));

      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'yarn',
        version: '3.6.0',
        agent: 'yarn@berry',
        nodeLinker: 'node_modules',
      });
    });

    it('should return yarn info with node_modules nodeLinker', async () => {
      execaCommand.mockResolvedValue({
        stdout: 'node_modules\n',
      } as any);

      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'yarn',
        version: '3.6.0',
        agent: 'yarn@berry',
        nodeLinker: 'node_modules',
      });
    });

    it('should return yarn info with pnp nodeLinker', async () => {
      execaCommand.mockResolvedValue({
        stdout: 'pnp\n',
      } as any);

      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'yarn',
        version: '3.6.0',
        agent: 'yarn@berry',
        nodeLinker: 'pnp',
      });
    });
  });

  describe('when pnpm is detected', () => {
    beforeEach(() => {
      detect.mockResolvedValue({
        name: 'pnpm',
        version: '8.15.0',
        agent: 'pnpm',
      });
    });

    it('should return pnpm info with default isolated nodeLinker when command fails', async () => {
      execaCommand.mockRejectedValue(new Error('Command failed'));

      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'pnpm',
        version: '8.15.0',
        agent: 'pnpm',
        nodeLinker: 'node_modules',
      });
    });

    it('should return pnpm info with isolated nodeLinker', async () => {
      execaCommand.mockResolvedValue({
        stdout: 'isolated\n',
      } as any);

      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'pnpm',
        version: '8.15.0',
        agent: 'pnpm',
        nodeLinker: 'isolated',
      });
    });
  });

  describe('when npm is detected', () => {
    beforeEach(() => {
      detect.mockResolvedValue({
        name: 'npm',
        version: '9.8.0',
        agent: 'npm',
      });
    });

    it('should return npm info with default node_modules nodeLinker', async () => {
      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'npm',
        version: '9.8.0',
        agent: 'npm',
        nodeLinker: 'node_modules',
      });
      expect(execaCommand).not.toHaveBeenCalled();
    });
  });

  describe('when bun is detected', () => {
    beforeEach(() => {
      detect.mockResolvedValue({
        name: 'bun',
        version: '1.0.0',
        agent: 'bun',
      });
    });

    it('should return bun info with default node_modules nodeLinker', async () => {
      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'bun',
        version: '1.0.0',
        agent: 'bun',
        nodeLinker: 'node_modules',
      });
      expect(execaCommand).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      detect.mockResolvedValue({
        name: 'yarn',
        version: '3.6.0',
        agent: 'yarn',
      });
    });

    it('should handle yarn command errors gracefully', async () => {
      execaCommand.mockRejectedValue(new Error('yarn command not found'));

      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'yarn',
        version: '3.6.0',
        agent: 'yarn',
        nodeLinker: 'node_modules',
      });
    });

    it('should handle pnpm command errors gracefully', async () => {
      detect.mockResolvedValue({
        name: 'pnpm',
        version: '8.15.0',
        agent: 'pnpm',
      });
      execaCommand.mockRejectedValue(new Error('pnpm command not found'));

      const result = await getPackageManagerInfo();

      expect(result).toEqual({
        type: 'pnpm',
        version: '8.15.0',
        agent: 'pnpm',
        nodeLinker: 'node_modules',
      });
    });
  });
});
