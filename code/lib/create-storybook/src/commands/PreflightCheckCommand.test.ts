import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JsPackageManagerFactory,
  PackageManagerName,
  invalidateProjectRootCache,
} from 'storybook/internal/common';

import * as scaffoldModule from '../scaffold-new-project';
import { PreflightCheckCommand } from './PreflightCheckCommand';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('../scaffold-new-project', { spy: true });

describe('PreflightCheckCommand', () => {
  let command: PreflightCheckCommand;
  let mockPackageManager: any;

  beforeEach(() => {
    command = new PreflightCheckCommand();
    mockPackageManager = {
      installDependencies: vi.fn(),
      latestVersion: vi.fn().mockResolvedValue('8.0.0'),
      type: PackageManagerName.NPM,
    };

    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue(mockPackageManager);
    vi.mocked(JsPackageManagerFactory.getPackageManagerType).mockReturnValue(
      PackageManagerName.NPM
    );
    vi.mocked(scaffoldModule.scaffoldNewProject).mockResolvedValue(undefined);
    vi.mocked(invalidateProjectRootCache).mockImplementation(() => {});
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should return package manager for non-empty directory', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);

      const result = await command.execute({ force: false } as any);

      expect(result.packageManager).toBe(mockPackageManager);
      expect(result.isEmptyProject).toBe(false);
      expect(scaffoldModule.scaffoldNewProject).not.toHaveBeenCalled();
      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should scaffold new project when directory is empty', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      const result = await command.execute({ force: false, skipInstall: true } as any);

      expect(scaffoldModule.scaffoldNewProject).toHaveBeenCalledWith('npm', {
        force: false,
        skipInstall: true,
      });
      expect(invalidateProjectRootCache).toHaveBeenCalled();
      expect(result.isEmptyProject).toBe(true);
    });

    it('should install dependencies for empty project when not skipping install', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      await command.execute({ force: false, skipInstall: false } as any);

      expect(mockPackageManager.installDependencies).toHaveBeenCalled();
    });

    it('should not install dependencies when skipInstall is true', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      await command.execute({ force: false, skipInstall: true } as any);

      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should use npm instead of yarn1 for empty directory', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);
      vi.mocked(JsPackageManagerFactory.getPackageManagerType).mockReturnValue(
        PackageManagerName.YARN1
      );

      await command.execute({ force: false, skipInstall: true } as any);

      expect(scaffoldModule.scaffoldNewProject).toHaveBeenCalledWith('npm', expect.any(Object));
    });

    it('should skip scaffolding when force is true', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(true);

      const result = await command.execute({ force: true } as any);

      expect(scaffoldModule.scaffoldNewProject).not.toHaveBeenCalled();
      expect(result.isEmptyProject).toBe(false);
    });

    it('should use provided package manager', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);

      await command.execute({ packageManager: 'yarn' } as any);

      expect(JsPackageManagerFactory.getPackageManager).toHaveBeenCalledWith({
        force: 'yarn',
      });
    });
  });
});
