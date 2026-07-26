import * as fs from 'node:fs';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizePath } from 'vite';

import { findNodeModulesRoots } from './vitest.ts';

vi.mock('node:fs', async () => import('../../../../__mocks__/fs.ts'));

const WORKSPACE = resolve('/workspace');
const LIB = join(WORKSPACE, 'projects', 'my-lib');

const setNodeModulesDirs = (dirs: string[]) => {
  vi.mocked<typeof import('../../../../__mocks__/fs.ts')>(fs as any).__setMockFiles(
    Object.fromEntries(dirs.map((dir) => [join(dir, 'node_modules'), '{}']))
  );
};

describe('findNodeModulesRoots', () => {
  afterEach(() => {
    setNodeModulesDirs([]);
  });

  it('returns the ancestor that contains node_modules', () => {
    // Angular workspace layout: dependencies at the workspace root, root served from projects/<lib>.
    setNodeModulesDirs([WORKSPACE]);

    expect(findNodeModulesRoots(LIB)).toEqual([normalizePath(WORKSPACE)]);
  });

  it('does not stop at a nearer node_modules (e.g. Storybook cache) and still finds the root', () => {
    // Storybook's cache creates node_modules/.cache in the project dir; the real deps live higher up.
    setNodeModulesDirs([LIB, WORKSPACE]);

    expect(findNodeModulesRoots(LIB)).toEqual([normalizePath(LIB), normalizePath(WORKSPACE)]);
  });

  it('returns an empty array when no ancestor has node_modules', () => {
    setNodeModulesDirs([]);

    expect(findNodeModulesRoots(LIB)).toEqual([]);
  });
});
