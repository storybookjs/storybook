import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from './JsPackageManager';

vi.mock('../versions', () => ({
  default: {
    '@storybook/react': '8.3.0',
  },
}));

describe('JsPackageManager', () => {
  let jsPackageManager: JsPackageManager;
  let mockLatestVersion: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLatestVersion = vi.fn();

    // @ts-expect-error Ignore abstract class error
    jsPackageManager = new JsPackageManager();
    jsPackageManager.latestVersion = mockLatestVersion;

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
  });
});
