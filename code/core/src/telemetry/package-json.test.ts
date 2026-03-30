import { describe, expect, it } from 'vitest';

import { getActualPackageJson, getActualPackageVersion } from './package-json';

describe('package-json', () => {
  describe('getActualPackageJson', () => {
    it('returns the package.json for a package with a default export', async () => {
      // @storybook/addon-docs has a "." export so the primary resolution path is used
      const result = await getActualPackageJson('@storybook/addon-docs');
      expect(result?.name).toBe('@storybook/addon-docs');
      expect(result?.version).toBeDefined();
    });

    it('returns the package.json for a package with no default export but with a ./package.json export', async () => {
      // `empathic` has no "." export (primary import.meta.resolve throws) but does have
      // "./package.json" export – this is the same pattern as @storybook/addon-mcp.
      // The fix ensures we fall back to the package.json subpath when the primary fails.
      const result = await getActualPackageJson('empathic');
      expect(result?.name).toBe('empathic');
      expect(result?.version).toBeDefined();
    });

    it('returns undefined for a non-existent package', async () => {
      const result = await getActualPackageJson('@storybook/this-package-does-not-exist');
      expect(result).toBeUndefined();
    });
  });

  describe('getActualPackageVersion', () => {
    it('returns the version for a package with no default export but with a ./package.json export', async () => {
      // Same scenario as above, but tested through the higher-level helper
      const result = await getActualPackageVersion('empathic');
      expect(result.name).toBe('empathic');
      expect(result.version).toBeTruthy();
    });

    it('returns null version for a non-existent package', async () => {
      const result = await getActualPackageVersion('@storybook/this-package-does-not-exist');
      expect(result.name).toBe('@storybook/this-package-does-not-exist');
      expect(result.version).toBeNull();
    });
  });
});
