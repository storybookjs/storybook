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

  describe('getOverrides method', () => {
    const mockPackageJson = (
      packageJson: Record<string, unknown>,
      packageJsonPath = '/fake/package.json'
    ) => {
      jsPackageManager.packageJsonPaths = [packageJsonPath];
      vi.spyOn(JsPackageManager, 'getPackageJson').mockReturnValue(packageJson as any);
    };

    it('reads npm `overrides`', () => {
      mockPackageJson({
        overrides: { vitest: 'npm:@voidzero-dev/vite-plus-test@latest', foo: '1.0.0' },
      });

      expect(jsPackageManager.getOverrides()).toEqual({
        vitest: 'npm:@voidzero-dev/vite-plus-test@latest',
        foo: '1.0.0',
      });
    });

    it('reads Yarn `resolutions` and pnpm `pnpm.overrides`', () => {
      mockPackageJson({
        resolutions: { foo: '2.0.0' },
        pnpm: { overrides: { bar: '3.0.0' } },
      });

      expect(jsPackageManager.getOverrides()).toEqual({ foo: '2.0.0', bar: '3.0.0' });
    });

    it('skips nested (object-valued) override entries', () => {
      mockPackageJson({
        overrides: { foo: '1.0.0', bar: { baz: '2.0.0' } },
      });

      expect(jsPackageManager.getOverrides()).toEqual({ foo: '1.0.0' });
    });

    it('returns an empty object when no overrides are declared', () => {
      mockPackageJson({ dependencies: { react: '18.0.0' } });

      expect(jsPackageManager.getOverrides()).toEqual({});
    });
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
