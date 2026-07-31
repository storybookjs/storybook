/**
 * Shared memfs mock setup for tests that use an in-memory filesystem.
 *
 * Usage in test files:
 *
 *   vi.mock("node:fs", async () => {
 *     const { fs } = await import("memfs");
 *     return { ...fs, default: fs };
 *   });
 *
 *   beforeEach(() => { setupMemfsMocks(); });
 *
 * Pattern mirrors code/renderers/react/src/componentManifest/memfs-test-setup.ts.
 */
import { vol } from 'memfs';
import { vi } from 'vitest';

import { invalidateCompodocCache } from './compodocExtractor.ts';
import { fsMocks } from './fixtures.ts';
import { invalidateCache } from './utils.ts';

export const ROOT = '/project';
export const COMPODOC_JSON_PATH = `${ROOT}/documentation.json`;

export function setupMemfsMocks(extraFiles: Record<string, string> = {}): void {
  vol.reset();
  vi.clearAllMocks();
  invalidateCache();
  invalidateCompodocCache();

  vi.spyOn(process, 'cwd').mockReturnValue(ROOT);

  // Mount fixture files at ROOT so relative import paths in fixture source
  // files resolve correctly inside the virtual filesystem.
  vol.fromJSON({ ...fsMocks, ...extraFiles }, ROOT);
}
