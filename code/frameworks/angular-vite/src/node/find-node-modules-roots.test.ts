import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizePath } from 'vite';

import { findNodeModulesRoots } from './vitest.ts';

vi.mock('node:fs', { spy: true });

const WORKSPACE = resolve('/workspace');
const LIB = join(WORKSPACE, 'projects', 'my-lib');

// Directories whose `node_modules` child should be reported as existing for a given test.
let nodeModulesDirs: Set<string>;

beforeEach(() => {
  nodeModulesDirs = new Set();
  vi.mocked(existsSync).mockImplementation((path) => nodeModulesDirs.has(String(path)));
});

const withNodeModules = (...dirs: string[]) => {
  for (const dir of dirs) {
    nodeModulesDirs.add(join(dir, 'node_modules'));
  }
};

describe('findNodeModulesRoots', () => {
  it('returns the ancestor that contains node_modules', () => {
    // Angular workspace layout: dependencies at the workspace root, root served from projects/<lib>.
    withNodeModules(WORKSPACE);

    expect(findNodeModulesRoots(LIB)).toEqual([normalizePath(WORKSPACE)]);
  });

  it('does not stop at a nearer node_modules (e.g. Storybook cache) and still finds the root', () => {
    // Storybook's cache creates node_modules/.cache in the project dir; the real deps live higher up.
    withNodeModules(LIB, WORKSPACE);

    expect(findNodeModulesRoots(LIB)).toEqual([normalizePath(LIB), normalizePath(WORKSPACE)]);
  });

  it('returns an empty array when no ancestor has node_modules', () => {
    expect(findNodeModulesRoots(LIB)).toEqual([]);
  });
});
