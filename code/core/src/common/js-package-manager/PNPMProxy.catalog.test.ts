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
  });

  describe('getCatalogVersion', () => {
    it('reads a package version from the default catalog', () => {
      vi.mocked(readFileSync).mockReturnValue('catalog:\n  vitest: ^3.2.0\n' as any);

      expect(pnpmProxy.getCatalogVersion('vitest')).toBe('^3.2.0');
    });

    it('reads a package version from a named catalog', () => {
      vi.mocked(readFileSync).mockReturnValue('catalogs:\n  testing:\n    vitest: ^3.2.0\n' as any);

      expect(pnpmProxy.getCatalogVersion('vitest', 'testing')).toBe('^3.2.0');
      // The default catalog does not have the entry.
      expect(pnpmProxy.getCatalogVersion('vitest')).toBeNull();
    });

    it('returns null when there is no workspace file', () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      expect(pnpmProxy.getCatalogVersion('vitest')).toBeNull();
    });

    it('returns null when the entry does not exist', () => {
      vi.mocked(readFileSync).mockReturnValue('catalog:\n  react: ^18.0.0\n' as any);

      expect(pnpmProxy.getCatalogVersion('vitest')).toBeNull();
    });
  });

  describe('syncWorkspaceCatalog', () => {
    it('adds missing entries to the default catalog and preserves comments', () => {
      vi.mocked(readFileSync).mockReturnValue(
        '# my workspace\ncatalog:\n  vitest: ^3.2.0 # pinned\n' as any
      );

      pnpmProxy.syncWorkspaceCatalog({ '@vitest/coverage-v8': '^3.2.0' });

      expect(writeFileSync).toHaveBeenCalledTimes(1);
      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('# my workspace');
      expect(written).toContain('vitest: ^3.2.0 # pinned');
      expect(written).toContain('"@vitest/coverage-v8": ^3.2.0');
    });

    it('does not override an entry the user already pinned', () => {
      vi.mocked(readFileSync).mockReturnValue('catalog:\n  "@vitest/coverage-v8": ^3.0.0\n' as any);

      pnpmProxy.syncWorkspaceCatalog({ '@vitest/coverage-v8': '^3.2.0' });

      // Nothing changed, so nothing is written.
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('writes entries into a named catalog', () => {
      vi.mocked(readFileSync).mockReturnValue('packages:\n  - packages/*\n' as any);

      pnpmProxy.syncWorkspaceCatalog({ '@vitest/coverage-v8': '^3.2.0' }, 'testing');

      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      expect(written).toContain('catalogs:');
      expect(written).toContain('testing:');
      expect(written).toContain('"@vitest/coverage-v8": ^3.2.0');
    });

    it('warns and does not write when there is no workspace file', () => {
      vi.mocked(find.up).mockReturnValue(undefined);

      pnpmProxy.syncWorkspaceCatalog({ '@vitest/coverage-v8': '^3.2.0' });

      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });
});
