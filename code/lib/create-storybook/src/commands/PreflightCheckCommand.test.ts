import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JsPackageManagerFactory,
  MinimumReleaseAgeHandledError,
  PackageManagerName,
  invalidateProjectRootCache,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import * as scaffoldModule from '../scaffold-new-project.ts';
import { PreflightCheckCommand } from './PreflightCheckCommand.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('../scaffold-new-project', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

describe('PreflightCheckCommand', () => {
  let command: PreflightCheckCommand;
  let mockPackageManager: any;
  let mockVersionService: any;
  const originalIsTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

  beforeEach(() => {
    mockPackageManager = {
      installDependencies: vi.fn(),
      precheckStorybookPackageInstall: vi.fn().mockResolvedValue(undefined),
      latestVersion: vi.fn().mockResolvedValue('8.0.0'),
      type: PackageManagerName.NPM,
      primaryPackageJson: { packageJson: { name: 'my-app' } },
    };

    mockVersionService = {
      getVersionInfo: vi.fn().mockResolvedValue({
        currentVersion: '8.0.0',
        latestVersion: '8.0.0',
        isPrerelease: false,
        isOutdated: false,
      }),
      getCurrentVersion: vi.fn().mockReturnValue('8.0.0'),
    };
    command = new PreflightCheckCommand(mockVersionService);

    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue(mockPackageManager);
    vi.mocked(JsPackageManagerFactory.getPackageManagerType).mockReturnValue(
      PackageManagerName.NPM
    );
    vi.mocked(scaffoldModule.scaffoldNewProject).mockResolvedValue(undefined);
    vi.mocked(invalidateProjectRootCache).mockImplementation(() => {});
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  afterAll(() => {
    if (originalIsTTYDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', originalIsTTYDescriptor);
    }
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

      expect(scaffoldModule.scaffoldNewProject).toHaveBeenCalledWith('npm', expect.any(Object));
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

      await command.execute({ packageManager: 'yarn' as PackageManagerName });

      expect(JsPackageManagerFactory.getPackageManager).toHaveBeenCalledWith({
        force: 'yarn',
      });
    });

    it('should log the detected package manager', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.type = PackageManagerName.YARN2;

      await command.execute({ force: false } as any);

      expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Package manager: Yarn Berry');
    });

    it('should warn when package.json name is "storybook"', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.primaryPackageJson = { packageJson: { name: 'storybook' } };

      await command.execute({ force: false } as any);

      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('Your package.json "name" field is set to "storybook"')
      );
    });

    it('should not warn when package.json name is not "storybook"', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.primaryPackageJson = { packageJson: { name: 'my-project' } };

      await command.execute({ force: false } as any);

      expect(vi.mocked(logger.warn)).not.toHaveBeenCalledWith(
        expect.stringContaining('Your package.json "name" field is set to "storybook"')
      );
    });

    it('should call the package manager Storybook install precheck', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockVersionService.getCurrentVersion.mockReturnValue('10.4.0-alpha.17');

      await command.execute({ force: false, yes: true } as any);

      expect(mockPackageManager.precheckStorybookPackageInstall).toHaveBeenCalledWith({
        storybookVersion: '10.4.0-alpha.17',
        nonInteractive: true,
        installContext: 'create',
      });
    });

    it('should ignore unexpected precheck failures', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.precheckStorybookPackageInstall.mockRejectedValueOnce(
        new Error('registry timeout')
      );

      await expect(command.execute({ force: false, yes: true } as any)).resolves.toEqual({
        packageManager: mockPackageManager,
        isEmptyProject: false,
      });

      expect(vi.mocked(logger.debug)).toHaveBeenCalledWith(
        expect.stringContaining('Skipping minimum-release-age precheck after an unexpected failure')
      );
    });

    it('should rethrow handled minimum-release-age precheck failures', async () => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
      mockPackageManager.precheckStorybookPackageInstall.mockRejectedValueOnce(
        new MinimumReleaseAgeHandledError('blocked by minimum release age')
      );

      await expect(command.execute({ force: false, yes: true } as any)).rejects.toThrow(
        'blocked by minimum release age'
      );
    });
  });
});
