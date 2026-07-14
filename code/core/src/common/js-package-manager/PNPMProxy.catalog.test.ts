import { readFileSync, writeFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';
import { fs as memfs, vol } from 'memfs';

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

const writtenYaml = () => vol.toJSON()[WORKSPACE_YAML] as string;

describe('PNPMProxy catalogs', () => {
  let pnpmProxy: PNPMProxy;

  beforeEach(() => {
    // Restore the real fs so the proxy can be constructed, then redirect fs to memfs.
    vi.resetAllMocks();
    pnpmProxy = new PNPMProxy();
    vol.reset();
    vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
    vi.mocked(writeFileSync).mockImplementation(memfs.writeFileSync as typeof writeFileSync);
    vi.mocked(getProjectRoot).mockReturnValue('/root');
    vi.mocked(find.up).mockReturnValue(WORKSPACE_YAML);
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
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalog:\n  vitest: ^3.2.0\n' });

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBe('^3.2.0');
    });

    it('reads a default catalog defined under `catalogs.default`', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalogs:\n  default:\n    vitest: ^3.2.0\n' });

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBe('^3.2.0');
    });

    it('reads a named catalog for "catalog:<name>"', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:testing' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalogs:\n  testing:\n    vitest: ^3.2.0\n' });

      await expect(pnpmProxy.getDeclaredVersionSpecifier('vitest')).resolves.toBe('^3.2.0');
    });

    it('reads a bare numeric catalog pin that YAML parses as a number', async () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalog:\n  vitest: 4\n' });

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
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalog:\n  react: ^18.0.0\n' });

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
      vol.fromJSON({ [WORKSPACE_YAML]: '# my workspace\ncatalog:\n  vitest: ^3.2.0 # pinned\n' });

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8', '@vitest/browser'],
        '^3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@catalog:', '@vitest/browser@catalog:']);
      expect(writtenYaml()).toContain('# my workspace');
      expect(writtenYaml()).toContain('vitest: ^3.2.0 # pinned');
      expect(writtenYaml()).toContain('"@vitest/coverage-v8": ^3.2.0');
      expect(writtenYaml()).toContain('"@vitest/browser": ^3.2.0');
    });

    it('writes into `catalogs.default` when the default catalog is defined there', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalogs:\n  default:\n    vitest: ^3.2.0\n' });

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8'],
        '^3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@catalog:']);
      expect(writtenYaml()).toContain('"@vitest/coverage-v8": ^3.2.0');
      // Defining both `catalog` and `catalogs.default` is a pnpm config error.
      expect(writtenYaml()).not.toMatch(/^catalog:/m);
    });

    it('writes into a named catalog', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:testing' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'packages:\n  - packages/*\n' });

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8'],
        '^3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@catalog:testing']);
      expect(writtenYaml()).toContain('catalogs:');
      expect(writtenYaml()).toContain('testing:');
      expect(writtenYaml()).toContain('"@vitest/coverage-v8": ^3.2.0');
    });

    it('reuses the anchor catalog entry format instead of the resolved exact version', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalog:\n  vitest: ^3.2.0\n' });

      // 3.2.4 is the installed version; the catalog entry should keep the user's range style.
      pnpmProxy.applyVersionToRelatedPackages(['@vitest/coverage-v8'], '3.2.4', 'vitest');

      expect(writtenYaml()).toContain('"@vitest/coverage-v8": ^3.2.0');
    });

    it('does not override an entry the user already pinned', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalog:\n  "@vitest/coverage-v8": ^3.0.0\n' });

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8'],
        '^3.2.0',
        'vitest'
      );

      // The entry already resolves, so nothing is written and the reference is still used.
      expect(result).toEqual(['@vitest/coverage-v8@catalog:']);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('falls back to direct pins when there is no workspace file', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vi.mocked(find.up).mockReturnValue(undefined);

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8'],
        '^3.2.0',
        'vitest'
      );

      // An unregistered `catalog:` reference would fail install, so pin directly instead.
      expect(result).toEqual(['@vitest/coverage-v8@^3.2.0']);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('falls back to direct pins when the workspace file is malformed', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalog: [\n' });

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8'],
        '^3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@^3.2.0']);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('falls back to direct pins when the workspace file cannot be written', () => {
      vi.spyOn(pnpmProxy, 'getAllDependencies').mockReturnValue({ vitest: 'catalog:' });
      vol.fromJSON({ [WORKSPACE_YAML]: 'catalog:\n  vitest: ^3.2.0\n' });
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = pnpmProxy.applyVersionToRelatedPackages(
        ['@vitest/coverage-v8'],
        '^3.2.0',
        'vitest'
      );

      expect(result).toEqual(['@vitest/coverage-v8@^3.2.0']);
    });
  });
});
