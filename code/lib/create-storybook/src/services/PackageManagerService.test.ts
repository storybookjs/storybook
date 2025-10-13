import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { DependencyCollector } from '../dependency-collector';
import { PackageManagerService } from './PackageManagerService';

describe('PackageManagerService', () => {
  let mockPackageManager: JsPackageManager;
  let service: PackageManagerService;

  beforeEach(() => {
    mockPackageManager = {
      type: 'npm',
      installDependencies: vi.fn(),
      addStorybookCommandInScripts: vi.fn(),
      addScripts: vi.fn(),
      getVersionedPackages: vi.fn(),
      getInstalledVersion: vi.fn(),
      getDependencyVersion: vi.fn(),
      getAllDependencies: vi.fn(),
      addDependencies: vi.fn(),
      runPackageCommand: vi.fn(),
      getRunCommand: vi.fn(),
      isStorybookInMonorepo: vi.fn(),
      latestVersion: vi.fn(),
    } as any;

    service = new PackageManagerService(mockPackageManager);
  });

  describe('getPackageManager', () => {
    it('should return the package manager instance', () => {
      expect(service.getPackageManager()).toBe(mockPackageManager);
    });
  });

  describe('installDependencies', () => {
    it('should call package manager installDependencies', async () => {
      await service.installDependencies();

      expect(mockPackageManager.installDependencies).toHaveBeenCalledTimes(1);
    });
  });

  describe('addStorybookScripts', () => {
    it('should add storybook scripts with default port', () => {
      service.addStorybookScripts();

      expect(mockPackageManager.addStorybookCommandInScripts).toHaveBeenCalledWith({ port: 6006 });
    });

    it('should add storybook scripts with custom port', () => {
      service.addStorybookScripts(9001);

      expect(mockPackageManager.addStorybookCommandInScripts).toHaveBeenCalledWith({ port: 9001 });
    });
  });

  describe('addScripts', () => {
    it('should add custom scripts to package.json', () => {
      const scripts = {
        'custom-script': 'echo "hello"',
        test: 'vitest',
      };

      service.addScripts(scripts);

      expect(mockPackageManager.addScripts).toHaveBeenCalledWith(scripts);
    });
  });

  describe('getVersionedPackages', () => {
    it('should return versioned packages', async () => {
      const packages = ['react', 'react-dom'];
      vi.mocked(mockPackageManager.getVersionedPackages).mockResolvedValue([
        'react@18.0.0',
        'react-dom@18.0.0',
      ]);

      const result = await service.getVersionedPackages(packages);

      expect(result).toEqual(['react@18.0.0', 'react-dom@18.0.0']);
      expect(mockPackageManager.getVersionedPackages).toHaveBeenCalledWith(packages);
    });
  });

  describe('getInstalledVersion', () => {
    it('should return installed version of a package', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion).mockResolvedValue('8.0.0');

      const version = await service.getInstalledVersion('storybook');

      expect(version).toBe('8.0.0');
      expect(mockPackageManager.getInstalledVersion).toHaveBeenCalledWith('storybook');
    });

    it('should return null if package is not installed', async () => {
      vi.mocked(mockPackageManager.getInstalledVersion).mockResolvedValue(null);

      const version = await service.getInstalledVersion('unknown-package');

      expect(version).toBeNull();
    });
  });

  describe('getDependencyVersion', () => {
    it('should return dependency version from package.json', () => {
      vi.mocked(mockPackageManager.getDependencyVersion).mockReturnValue('^18.0.0');

      const version = service.getDependencyVersion('react');

      expect(version).toBe('^18.0.0');
      expect(mockPackageManager.getDependencyVersion).toHaveBeenCalledWith('react');
    });
  });

  describe('getAllDependencies', () => {
    it('should return all dependencies', () => {
      const deps = {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        storybook: '^8.0.0',
      };
      vi.mocked(mockPackageManager.getAllDependencies).mockReturnValue(deps);

      const result = service.getAllDependencies();

      expect(result).toEqual(deps);
    });
  });

  describe('installCollectedDependencies', () => {
    it('should install both dependencies and devDependencies', async () => {
      const collector = new DependencyCollector();
      collector.addDependencies(['react@18.0.0']);
      collector.addDevDependencies(['@types/react@18.0.0', 'storybook@8.0.0']);

      await service.installCollectedDependencies(collector);

      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'dependencies', skipInstall: true },
        ['react@18.0.0']
      );
      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        ['@types/react@18.0.0', 'storybook@8.0.0']
      );
      expect(mockPackageManager.installDependencies).toHaveBeenCalledTimes(1);
    });

    it('should skip installation when skipInstall is true', async () => {
      const collector = new DependencyCollector();
      collector.addDevDependencies(['storybook@8.0.0']);

      await service.installCollectedDependencies(collector, true);

      expect(mockPackageManager.addDependencies).toHaveBeenCalled();
      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should handle empty collector', async () => {
      const collector = new DependencyCollector();

      await service.installCollectedDependencies(collector);

      expect(mockPackageManager.addDependencies).not.toHaveBeenCalled();
      expect(mockPackageManager.installDependencies).not.toHaveBeenCalled();
    });

    it('should only add dependencies when only dependencies exist', async () => {
      const collector = new DependencyCollector();
      collector.addDependencies(['react@18.0.0']);

      await service.installCollectedDependencies(collector);

      expect(mockPackageManager.addDependencies).toHaveBeenCalledTimes(1);
      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'dependencies', skipInstall: true },
        ['react@18.0.0']
      );
    });
  });

  describe('addDependencies', () => {
    it('should add dependencies with npm options', async () => {
      const npmOptions = { type: 'devDependencies' as const, skipInstall: false };
      const packages = ['storybook@8.0.0'];

      await service.addDependencies(npmOptions, packages);

      expect(mockPackageManager.addDependencies).toHaveBeenCalledWith(npmOptions, packages);
    });
  });

  describe('runPackageCommand', () => {
    it('should run a package command with args', async () => {
      await service.runPackageCommand('nuxi', ['module', 'add', '@nuxtjs/storybook']);

      expect(mockPackageManager.runPackageCommand).toHaveBeenCalledWith('nuxi', [
        'module',
        'add',
        '@nuxtjs/storybook',
      ]);
    });
  });

  describe('getRunCommand', () => {
    it('should get the run command for a script', () => {
      vi.mocked(mockPackageManager.getRunCommand).mockReturnValue('npm run storybook');

      const command = service.getRunCommand('storybook');

      expect(command).toBe('npm run storybook');
      expect(mockPackageManager.getRunCommand).toHaveBeenCalledWith('storybook');
    });
  });

  describe('getType', () => {
    it('should return the package manager type', () => {
      const type = service.getType();

      expect(type).toBe('npm');
    });
  });

  describe('isStorybookInMonorepo', () => {
    it('should check if storybook is in a monorepo', () => {
      vi.mocked(mockPackageManager.isStorybookInMonorepo).mockReturnValue(true);

      const result = service.isStorybookInMonorepo();

      expect(result).toBe(true);
    });
  });

  describe('latestVersion', () => {
    it('should get latest version of a package', async () => {
      vi.mocked(mockPackageManager.latestVersion).mockResolvedValue('8.1.0');

      const version = await service.latestVersion('storybook');

      expect(version).toBe('8.1.0');
      expect(mockPackageManager.latestVersion).toHaveBeenCalledWith('storybook');
    });
  });
});
