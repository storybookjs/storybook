import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from './JsPackageManager.ts';

const mockVersions = vi.hoisted(() => ({
  '@storybook/react': '8.3.0',
}));

vi.mock('../versions', () => ({
  default: mockVersions,
}));

describe('JsPackageManager', () => {
  let jsPackageManager: JsPackageManager;
  let mockLatestVersion: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // @ts-expect-error Ignore abstract class error
    jsPackageManager = new JsPackageManager();
    mockLatestVersion = vi.spyOn(jsPackageManager, 'latestVersion');

    vi.clearAllMocks();
  });

  describe('getVersionedPackages method', () => {
    it('should return the latest stable release version when current version is the latest stable release', async () => {
      mockLatestVersion.mockResolvedValue('8.3.0');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/react']);

      expect(result).toEqual(['@storybook/react@^8.3.0']);
    });

    it('should return the current version when it is not the latest stable release', async () => {
      mockLatestVersion.mockResolvedValue('8.3.1');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/react']);

      expect(result).toEqual(['@storybook/react@8.3.0']);
    });

    it('should get the requested version when the package is not in the monorepo', async () => {
      mockLatestVersion.mockResolvedValue('2.0.0');

      const result = await jsPackageManager.getVersionedPackages(['@storybook/new-addon@^next']);

      expect(result).toEqual(['@storybook/new-addon@^next']);
    });

    it('should map pkg.pr.new create-storybook specifiers to Storybook packages', async () => {
      const result = await jsPackageManager.getVersionedPackages(['@storybook/react'], {
        storybookVersionSpecifier: 'https://pkg.pr.new/create-storybook@abc123',
      });

      expect(result).toEqual(['@storybook/react@https://pkg.pr.new/@storybook/react@abc123']);
      expect(mockLatestVersion).not.toHaveBeenCalled();
    });

    it('should map repo-scoped pkg.pr.new specifiers to Storybook packages', async () => {
      const result = await jsPackageManager.getVersionedPackages(['@storybook/react'], {
        storybookVersionSpecifier: 'https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef',
      });

      expect(result).toEqual([
        '@storybook/react@https://pkg.pr.new/storybookjs/storybook/@storybook/react@deadbeef',
      ]);
      expect(mockLatestVersion).not.toHaveBeenCalled();
    });

    it('should keep npm tags and prereleases on the CLI version path', async () => {
      mockLatestVersion.mockResolvedValue('8.3.1');

      await expect(
        jsPackageManager.getVersionedPackages(['@storybook/react'], {
          storybookVersionSpecifier: 'next',
        })
      ).resolves.toEqual(['@storybook/react@8.3.0']);
      await expect(
        jsPackageManager.getVersionedPackages(['@storybook/react'], {
          storybookVersionSpecifier: '10.6.0-alpha.7',
        })
      ).resolves.toEqual(['@storybook/react@8.3.0']);
    });

    it('should return the package name as is if it is not a Storybook package', async () => {
      const result = await jsPackageManager.getVersionedPackages(['some-other-package']);

      expect(result).toEqual(['some-other-package']);
    });
  });
});
