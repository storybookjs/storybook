import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import { VersionService } from './VersionService';

vi.mock('storybook/internal/common', async () => {
  const actual = await vi.importActual('storybook/internal/common');
  return {
    ...actual,
    versions: {
      storybook: '8.0.0',
    },
  };
});

describe('VersionService', () => {
  let versionService: VersionService;
  let mockPackageManager: JsPackageManager;

  beforeEach(() => {
    versionService = new VersionService();
    mockPackageManager = {
      latestVersion: vi.fn(),
    } as any;
  });

  describe('getCurrentVersion', () => {
    it('should return the current Storybook version', () => {
      expect(versionService.getCurrentVersion()).toBe('8.0.0');
    });
  });

  describe('getLatestVersion', () => {
    it('should fetch the latest version from package manager', async () => {
      vi.mocked(mockPackageManager.latestVersion).mockResolvedValue('8.1.0');

      const latestVersion = await versionService.getLatestVersion(mockPackageManager);

      expect(latestVersion).toBe('8.1.0');
      expect(mockPackageManager.latestVersion).toHaveBeenCalledWith('storybook');
    });
  });

  describe('isPrerelease', () => {
    it('should return true for prerelease versions', () => {
      expect(versionService.isPrerelease('8.0.0-alpha.1')).toBe(true);
      expect(versionService.isPrerelease('8.0.0-beta.2')).toBe(true);
      expect(versionService.isPrerelease('8.0.0-rc.3')).toBe(true);
    });

    it('should return false for stable versions', () => {
      expect(versionService.isPrerelease('8.0.0')).toBe(false);
      expect(versionService.isPrerelease('8.1.2')).toBe(false);
    });
  });

  describe('isOutdated', () => {
    it('should return true when current version is older than latest', () => {
      expect(versionService.isOutdated('8.0.0', '8.1.0')).toBe(true);
      expect(versionService.isOutdated('7.6.0', '8.0.0')).toBe(true);
    });

    it('should return false when current version is same or newer', () => {
      expect(versionService.isOutdated('8.1.0', '8.1.0')).toBe(false);
      expect(versionService.isOutdated('8.2.0', '8.1.0')).toBe(false);
    });
  });

  describe('getStorybookVersionFromAncestry', () => {
    it('should extract version from create-storybook command', () => {
      const ancestry = [
        { command: 'npx create-storybook@8.0.5' },
        { command: 'node /usr/local/bin/npm' },
      ];

      const version = versionService.getStorybookVersionFromAncestry(ancestry as any);

      expect(version).toBe('8.0.5');
    });

    it('should extract version from storybook command', () => {
      const ancestry = [
        { command: 'npx storybook@latest init' },
        { command: 'node /usr/local/bin/npm' },
      ];

      const version = versionService.getStorybookVersionFromAncestry(ancestry as any);

      expect(version).toBe('latest');
    });

    it('should return undefined if no version found', () => {
      const ancestry = [{ command: 'npm install' }, { command: 'node /usr/local/bin/npm' }];

      const version = versionService.getStorybookVersionFromAncestry(ancestry as any);

      expect(version).toBeUndefined();
    });
  });

  describe('getCliIntegrationFromAncestry', () => {
    it('should detect sv create command', () => {
      const ancestry = [{ command: 'sv create my-app' }, { command: 'node /usr/local/bin/npm' }];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBe('sv create');
    });

    it('should detect sv add command', () => {
      const ancestry = [{ command: 'sv add storybook' }, { command: 'node /usr/local/bin/npm' }];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBe('sv add');
    });

    it('should detect sv with version specifier', () => {
      const ancestry = [{ command: 'sv@1.0.0 create my-app' }];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBe('sv create');
    });

    it('should return undefined if no sv command found', () => {
      const ancestry = [{ command: 'npm init' }, { command: 'node /usr/local/bin/npm' }];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBeUndefined();
    });

    it('should detect create-rsbuild command', () => {
      const ancestry = [{ command: 'npx create-rsbuild' }, { command: 'node /usr/local/bin/npm' }];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBe('create-rsbuild');
    });

    it('should detect create rsbuild with version specifier', () => {
      const ancestry = [{ command: 'npx create-rsbuild@1.0.0 init' }];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBe('create-rsbuild');
    });

    it('should detect "create rsbuild" with space instead of dash', () => {
      const ancestry = [{ command: 'npm create rsbuild -- my-app' }];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBe('create-rsbuild');
    });

    it('should detect @tanstack/start command', () => {
      const ancestry = [{ command: 'npx @tanstack/start@latest create my-app' }];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBe('@tanstack/start');
    });

    it('should detect @tanstack/start in middle of command chain', () => {
      const ancestry = [
        { command: 'pnpm @tanstack/start init' },
        { command: 'node /usr/local/bin/pnpm' },
      ];

      const integration = versionService.getCliIntegrationFromAncestry(ancestry as any);

      expect(integration).toBe('@tanstack/start');
    });
  });

  describe('getVersionInfo', () => {
    it('should return complete version info for stable version', async () => {
      vi.mocked(mockPackageManager.latestVersion).mockResolvedValue('8.1.0');

      const versionInfo = await versionService.getVersionInfo(mockPackageManager);

      expect(versionInfo).toEqual({
        currentVersion: '8.0.0',
        latestVersion: '8.1.0',
        isPrerelease: false,
        isOutdated: true,
      });
    });

    it('should not mark prerelease as outdated', async () => {
      const prereleaseService = new VersionService();
      vi.mocked(mockPackageManager.latestVersion).mockResolvedValue('8.1.0');

      // Mock getCurrentVersion to return prerelease
      vi.spyOn(prereleaseService, 'getCurrentVersion').mockReturnValue('8.0.0-alpha.1');

      const versionInfo = await prereleaseService.getVersionInfo(mockPackageManager);

      expect(versionInfo).toEqual({
        currentVersion: '8.0.0-alpha.1',
        latestVersion: '8.1.0',
        isPrerelease: true,
        isOutdated: false,
      });
    });

    it('should handle null latest version', async () => {
      vi.mocked(mockPackageManager.latestVersion).mockResolvedValue(null);

      const versionInfo = await versionService.getVersionInfo(mockPackageManager);

      expect(versionInfo).toEqual({
        currentVersion: '8.0.0',
        latestVersion: null,
        isPrerelease: false,
        isOutdated: false,
      });
    });
  });
});
