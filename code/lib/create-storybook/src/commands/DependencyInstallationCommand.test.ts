import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

import { DependencyCollector } from '../dependency-collector';
import { DependencyInstallationCommand } from './DependencyInstallationCommand';

vi.mock('../addon-dependencies/addon-a11y', () => ({
  getAddonA11yDependencies: vi.fn(),
}));

vi.mock('../addon-dependencies/addon-vitest', () => ({
  getAddonVitestDependencies: vi.fn(),
}));

describe('DependencyInstallationCommand', () => {
  let command: DependencyInstallationCommand;
  let mockPackageManager: JsPackageManager;
  let dependencyCollector: DependencyCollector;

  beforeEach(async () => {
    const { getAddonA11yDependencies } = await import('../addon-dependencies/addon-a11y');
    const { getAddonVitestDependencies } = await import('../addon-dependencies/addon-vitest');

    vi.mocked(getAddonA11yDependencies).mockReturnValue([]);
    vi.mocked(getAddonVitestDependencies).mockResolvedValue([]);

    dependencyCollector = new DependencyCollector();
    command = new DependencyInstallationCommand(dependencyCollector);

    mockPackageManager = {
      addDependencies: vi.fn().mockResolvedValue(undefined),
      installDependencies: vi.fn().mockResolvedValue(undefined),
    } as Partial<JsPackageManager> as JsPackageManager;

    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should install dependencies when collector has packages', async () => {
      dependencyCollector.addDevDependencies(['storybook@8.0.0']);

      await command.execute({
        packageManager: mockPackageManager,
        skipInstall: false,
        projectType: ProjectType.REACT,
      });

      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        ['storybook@8.0.0']
      );
      expect(mockPackageManager.installDependencies).toHaveBeenCalled();
    });

    it('should skip installation when skipInstall is true and no packages', async () => {
      await command.execute({
        packageManager: mockPackageManager,
        skipInstall: true,
        projectType: ProjectType.REACT,
      });

      expect(mockPackageManager.addDependencies).not.toHaveBeenCalled();
      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should install packages even when skipInstall is true if packages exist', async () => {
      dependencyCollector.addDevDependencies(['storybook@8.0.0']);

      await command.execute({
        packageManager: mockPackageManager,
        skipInstall: true,
        projectType: ProjectType.REACT,
      });

      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        ['storybook@8.0.0']
      );
      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should pass skipInstall flag to package manager service', async () => {
      dependencyCollector.addDependencies(['react@18.0.0']);

      await command.execute({
        packageManager: mockPackageManager,
        skipInstall: true,
        projectType: ProjectType.REACT,
      });

      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'dependencies', skipInstall: true },
        ['react@18.0.0']
      );
      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should throw error if installation fails', async () => {
      dependencyCollector.addDevDependencies(['storybook@8.0.0']);
      const error = new Error('Installation failed');
      vi.mocked(mockPackageManager.addDependencies).mockRejectedValue(error);

      await expect(
        command.execute({
          packageManager: mockPackageManager,
          skipInstall: false,
          projectType: ProjectType.REACT,
        })
      ).rejects.toThrow('Installation failed');
    });

    it('should handle empty dependency collector', async () => {
      await command.execute({
        packageManager: mockPackageManager,
        skipInstall: false,
        projectType: ProjectType.REACT,
      });

      expect(mockPackageManager.addDependencies).not.toHaveBeenCalled();
      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });
  });
});
