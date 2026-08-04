import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../paths.ts', { spy: true });

import { findTsconfigPathForFile, findTsconfigPathForPath } from '../tsconfig.ts';
import * as paths from '../paths.ts';

const tempDirs: string[] = [];

beforeEach(() => {
  vi.mocked(paths.getProjectRoot).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('findTsconfigPathForFile', () => {
  it('uses the referenced app tsconfig for Vite-style project references', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@ui/*': ['src/*'],
          },
        },
        include: ['src'],
      }),
      'tsconfig.node.json': JSON.stringify({
        include: ['vite.config.ts'],
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.app.json')
    );
  });

  it('keeps reference order for same-directory sibling tsconfigs that both match the file', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
        },
        include: ['src'],
      }),
      'tsconfig.node.json': JSON.stringify({
        compilerOptions: {
          module: 'ESNext',
        },
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.app.json')
    );
  });

  it('falls back to the nearest discovered tsconfig when no reference matches the file', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
        },
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.json')
    );
  });

  it('reads referenced tsconfigs that use JSONC trailing commas', () => {
    const dir = createTempProject({
      'tsconfig.json': `{
        "files": [],
        "references": [
          { "path": "./tsconfig.app.json" },
        ],
      }`,
      'tsconfig.app.json': `{
        "compilerOptions": {
          "baseUrl": ".",
        },
        "include": ["src"],
      }`,
      'src/Button.tsx': 'export const Button = () => null;',
    });

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.app.json')
    );
  });
});

describe('findTsconfigPathForPath', () => {
  it('does not dirname directories when resolving from an importer basedir', () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
        },
      }),
      'src/Button.tsx': 'export const Button = () => null;',
      'nested/tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
        },
      }),
      'nested/src/Button.tsx': 'export const Button = () => null;',
    });

    // Directory input must search from that directory, not its parent.
    expect(findTsconfigPathForPath(join(dir, 'nested/src'))).toBe(
      join(dir, 'nested/tsconfig.json')
    );
    // File input still uses file-aware ownership.
    expect(findTsconfigPathForPath(join(dir, 'nested/src/Button.tsx'))).toBe(
      join(dir, 'nested/tsconfig.json')
    );
  });
});

function createTempProject(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'storybook-tsconfig-'));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(dir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }

  vi.mocked(paths.getProjectRoot).mockReturnValue(dir);
  return dir;
}
