import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DependencyCollector } from '../dependency-collector';
import { PackageManagerService } from '../services/PackageManagerService';
import { DependencyInstallationCommand } from './DependencyInstallationCommand';

describe('DependencyInstallationCommand', () => {
  let command: DependencyInstallationCommand;
  let mockPackageManagerService: PackageManagerService;
  let dependencyCollector: DependencyCollector;

  beforeEach(() => {
    command = new DependencyInstallationCommand();
    mockPackageManagerService = {
      installCollectedDependencies: vi.fn(),
    } as any;

    dependencyCollector = new DependencyCollector();
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should install dependencies when collector has packages', async () => {
      dependencyCollector.addDevDependencies(['storybook@8.0.0']);

      await command.execute(mockPackageManagerService, dependencyCollector, false);

      expect(mockPackageManagerService.installCollectedDependencies).toHaveBeenCalledWith(
        dependencyCollector,
        false
      );
    });

    it('should skip installation when skipInstall is true and no packages', async () => {
      await command.execute(mockPackageManagerService, dependencyCollector, true);

      expect(mockPackageManagerService.installCollectedDependencies).not.toHaveBeenCalled();
    });

    it('should install packages even when skipInstall is true if packages exist', async () => {
      dependencyCollector.addDevDependencies(['storybook@8.0.0']);

      await command.execute(mockPackageManagerService, dependencyCollector, true);

      expect(mockPackageManagerService.installCollectedDependencies).toHaveBeenCalledWith(
        dependencyCollector,
        true
      );
    });

    it('should pass skipInstall flag to package manager service', async () => {
      dependencyCollector.addDependencies(['react@18.0.0']);

      await command.execute(mockPackageManagerService, dependencyCollector, true);

      expect(mockPackageManagerService.installCollectedDependencies).toHaveBeenCalledWith(
        dependencyCollector,
        true
      );
    });

    it('should throw error if installation fails', async () => {
      dependencyCollector.addDevDependencies(['storybook@8.0.0']);
      const error = new Error('Installation failed');
      vi.mocked(mockPackageManagerService.installCollectedDependencies).mockRejectedValue(error);

      await expect(
        command.execute(mockPackageManagerService, dependencyCollector, false)
      ).rejects.toThrow('Installation failed');
    });

    it('should handle empty dependency collector', async () => {
      await command.execute(mockPackageManagerService, dependencyCollector, false);

      expect(mockPackageManagerService.installCollectedDependencies).toHaveBeenCalledWith(
        dependencyCollector,
        false
      );
    });
  });
});

