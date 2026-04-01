import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JsPackageManagerFactory,
  PackageManagerName,
  detectDeclaredNodeVersions,
  invalidateProjectRootCache,
  updateEnginesNode,
  updateNvmrc,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as scaffoldModule from '../scaffold-new-project.ts';
import { PreflightCheckCommand } from './PreflightCheckCommand.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('../scaffold-new-project', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('semver', { spy: true });

describe('PreflightCheckCommand', () => {
  let command: PreflightCheckCommand;
  let mockPackageManager: any;

  beforeEach(() => {
    command = new PreflightCheckCommand();
    mockPackageManager = {
      installDependencies: vi.fn(),
      latestVersion: vi.fn().mockResolvedValue('8.0.0'),
      type: PackageManagerName.NPM,
      primaryPackageJson: { packageJson: { name: 'my-app' } },
    };

    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue(mockPackageManager);
    vi.mocked(JsPackageManagerFactory.getPackageManagerType).mockReturnValue(
      PackageManagerName.NPM
    );
    vi.mocked(scaffoldModule.scaffoldNewProject).mockResolvedValue(undefined);
    vi.mocked(invalidateProjectRootCache).mockImplementation(() => {});

    // Default: no declared version issues (prevents checkDeclaredNodeVersion from prompting)
    vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
      nvmrcPath: undefined,
      nvmrcVersion: undefined,
      enginesNode: undefined,
      packageJsonPath: undefined,
    });

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
  });

  describe('checkDeclaredNodeVersion', () => {
    beforeEach(() => {
      vi.mocked(scaffoldModule.currentDirectoryIsEmpty).mockReturnValue(false);
    });

    it('should not show declared version prompt when .nvmrc is fine', async () => {
      vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
        nvmrcPath: '/project/.nvmrc',
        nvmrcVersion: '22.14.2',
        enginesNode: undefined,
        packageJsonPath: undefined,
      });

      await command.execute({ force: false } as any);

      expect(prompt.select).not.toHaveBeenCalled();
    });

    it('should show select prompt when .nvmrc is below minimum', async () => {
      vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
        nvmrcPath: '/project/.nvmrc',
        nvmrcVersion: '18.0.0',
        enginesNode: undefined,
        packageJsonPath: undefined,
      });
      vi.mocked(prompt.select).mockResolvedValue('skip');

      await command.execute({ force: false } as any);

      expect(prompt.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('.nvmrc'),
        })
      );
    });

    it('should update .nvmrc when user selects a version', async () => {
      vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
        nvmrcPath: '/project/.nvmrc',
        nvmrcVersion: '18.0.0',
        enginesNode: undefined,
        packageJsonPath: undefined,
      });
      vi.mocked(prompt.select).mockResolvedValue('22.12.0');
      vi.mocked(updateNvmrc).mockImplementation(() => {});

      await command.execute({ force: false } as any);

      expect(updateNvmrc).toHaveBeenCalledWith('/project/.nvmrc', '22.12.0');
    });

    it('should not update .nvmrc when user selects skip', async () => {
      vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
        nvmrcPath: '/project/.nvmrc',
        nvmrcVersion: '18.0.0',
        enginesNode: undefined,
        packageJsonPath: undefined,
      });
      vi.mocked(prompt.select).mockResolvedValue('skip');

      await command.execute({ force: false } as any);

      expect(updateNvmrc).not.toHaveBeenCalled();
    });

    it('should show prompt for engines.node when below minimum', async () => {
      vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
        nvmrcPath: undefined,
        nvmrcVersion: undefined,
        enginesNode: '>=16',
        packageJsonPath: '/project/package.json',
      });
      vi.mocked(prompt.select).mockResolvedValue('skip');

      await command.execute({ force: false } as any);

      expect(prompt.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('engines.node'),
        })
      );
    });

    it('should show two prompts when both .nvmrc and engines.node are below minimum', async () => {
      vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
        nvmrcPath: '/project/.nvmrc',
        nvmrcVersion: '18.0.0',
        enginesNode: '>=16',
        packageJsonPath: '/project/package.json',
      });
      vi.mocked(prompt.select).mockResolvedValue('skip');

      await command.execute({ force: false } as any);

      expect(prompt.select).toHaveBeenCalledTimes(2);
    });

    it('should update engines.node when user selects a version', async () => {
      vi.mocked(detectDeclaredNodeVersions).mockReturnValue({
        nvmrcPath: undefined,
        nvmrcVersion: undefined,
        enginesNode: '>=16',
        packageJsonPath: '/project/package.json',
      });
      vi.mocked(prompt.select).mockResolvedValue('>=22.12');
      vi.mocked(updateEnginesNode).mockImplementation(() => {});

      await command.execute({ force: false } as any);

      expect(updateEnginesNode).toHaveBeenCalledWith('/project/package.json', '>=22.12');
    });
  });
});
