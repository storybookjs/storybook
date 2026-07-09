import { readFileSync, writeFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';

import { getProjectRoot } from '../utils/paths.ts';
import { PNPMProxy } from './PNPMProxy.ts';

vi.mock('node:fs', { spy: true });
vi.mock('empathic/find', { spy: true });
vi.mock('../utils/paths.ts', { spy: true });
vi.mock('storybook/internal/node-logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prompt: { getPreferredStdio: vi.fn(() => 'inherit') },
}));

const WORKSPACE_YAML = '/root/pnpm-workspace.yaml';

describe('PNPMProxy catalogs', () => {
  let pnpmProxy: PNPMProxy;

  beforeEach(() => {
    vi.clearAllMocks();
    // Construct against the real fs before overriding fs/find in individual tests.
    pnpmProxy = new PNPMProxy();
    vi.mocked(getProjectRoot).mockReturnValue('/root');
    vi.mocked(find.up).mockReturnValue(WORKSPACE_YAML);
    // Never touch the real disk when writing.
    vi.mocked(writeFileSync).mockImplementation(() => {});
    // Drive the version resolution through controllable inputs.
    vi.spyOn(pnpmProxy, 'getInstalledVersion').mockResolvedValue(null);
    vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({});
  });

  describe('getDeclaredVersionSpecifier', () => {
    it('prefers the installed version and does not read the catalog', async () => {
      vi.spyOn(pnpmProxy, 'getInstalledVersion').mockResolvedValue('4.1.9');
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBe('4.1.9');
      expect(readFileSync).not.toHaveBeenCalledWith(WORKSPACE_YAML, expect.anything());
    });

    it('reads the default catalog when declared as "catalog:" and not installed', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vi.mocked(readFileSync).mockReturnValue('catalog:\n  vitest: ^3.2.0\n' as any);

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBe('^3.2.0');
    });

    it('reads a named catalog for "catalog:<name>"', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:testing' });
      vi.mocked(readFileSync).mockReturnValue('catalogs:\n  testing:\n    vitest: ^3.2.0\n' as any);

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBe('^3.2.0');
    });

    it('reads a bare numeric catalog pin that YAML parses as a number', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vi.mocked(readFileSync).mockReturnValue('catalog:\n  vitest: 4\n' as any);

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBe('4');
    });

    it('falls back to a plain declared semver range when not a catalog and not installed', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: '^3.2.0' });

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBe('^3.2.0');
    });

    it('returns null for a non-semver, non-catalog specifier', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'workspace:*' });

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBeNull();
    });

    it('returns null when the catalog entry is missing', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vi.mocked(readFileSync).mockReturnValue('catalog:\n  react: ^18.0.0\n' as any);

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBeNull();
    });

    it('returns null when there is no workspace file', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vi.mocked(find.up).mockReturnValue(undefined);

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBeNull();
    });
  });

  describe('applyVersionToRelatedPackages', () => {
    it('pins directly when the anchor is not declared through a catalog', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: '^3.2.0' });

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8', '@vitest/browser'],
        '3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@3.2.0', '@vitest/browser@3.2.0']);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('registers entries and returns catalog references for a default-catalog anchor', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vi.mocked(readFileSync).mockReturnValue(
        '# my workspace\ncatalog:\n  vitest: ^3.2.0 # pinned\n' as any
      );

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8', '@vitest/browser'],
        '^3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@catalog:', '@vitest/browser@catalog:']);
      expect(writeFileSync).toHaveBeenCalledTimes(1);
      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('# my workspace');
      expect(written).toContain('vitest: ^3.2.0 # pinned');
      expect(written).toContain('"@vitest/coverage-v8": ^3.2.0');
      expect(written).toContain('"@vitest/browser": ^3.2.0');
    });

    it('writes into a named catalog', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:testing' });
      vi.mocked(readFileSync).mockReturnValue('packages:\n  - packages/*\n' as any);

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8'],
        '^3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@catalog:testing']);
      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('catalogs:');
      expect(written).toContain('testing:');
      expect(written).toContain('"@vitest/coverage-v8": ^3.2.0');
    });

    it('does not override an entry the user already pinned', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vi.mocked(readFileSync).mockReturnValue('catalog:\n  "@vitest/coverage-v8": ^3.0.0\n' as any);

      pnpmProxy.applyVersionToRelatedPackages(['@vitest/coverage-v8'], '^3.2.0', 'vitest');

      // Nothing changed, so nothing is written.
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('does not write when there is no workspace file, but still returns catalog references', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vi.mocked(find.up).mockReturnValue(undefined);

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8'],
        '^3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@catalog:']);
      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });
});
