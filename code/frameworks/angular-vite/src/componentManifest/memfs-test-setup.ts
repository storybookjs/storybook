/**
 * Shared memfs mock setup for tests that use an in-memory filesystem.
 *
 * Usage in test files:
 *
 *   vi.mock("node:fs", async () => {
 *     const { fs } = await import("memfs");
 *     return { ...fs, default: fs };
 *   });
 *   vi.mock("empathic/package", () => ({ up: vi.fn() }));
 *
 *   beforeEach(() => { setupMemfsMocks(); });
 *
 * Pattern mirrors code/renderers/react/src/componentManifest/memfs-test-setup.ts
 * in the Storybook monorepo.
 *
 * Note: vi.mock() calls must be declared in each consuming test file so Vitest
 * can hoist them. This module only performs the per-test reset and volume setup.
 */

import { up as findPackageJson } from 'empathic/package';
import { vol } from 'memfs';
import { vi } from 'vitest';

import { invalidateCompodocCache } from './compodocExtractor.ts';
import { fsMocks } from './fixtures.ts';
import { invalidateCache } from './utils.ts';

export const ROOT = '/project';
export const PACKAGE_JSON_PATH = `${ROOT}/package.json`;
export const COMPODOC_JSON_PATH = `${ROOT}/documentation.json`;

export const mockFindPackageJson = vi.mocked(findPackageJson);

export function setupMemfsMocks(extraFiles: Record<string, string> = {}): void {
  vol.reset();
  vi.clearAllMocks();
  invalidateCache();
  invalidateCompodocCache();

  vi.spyOn(process, 'cwd').mockReturnValue(ROOT);
  mockFindPackageJson.mockReturnValue(PACKAGE_JSON_PATH);

  // Mount fixture files at ROOT so relative import paths in fixture source
  // files resolve correctly inside the virtual filesystem.
  vol.fromJSON({ ...fsMocks, ...extraFiles }, ROOT);
}
