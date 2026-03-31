import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { findTsconfigPathForFile } from '../tsconfig';
import * as paths from '../paths';

const tempDirs: string[] = [];

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

    vi.spyOn(paths, 'getProjectRoot').mockReturnValue(dir);

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

    vi.spyOn(paths, 'getProjectRoot').mockReturnValue(dir);

    expect(findTsconfigPathForFile(dir, join(dir, 'src/Button.tsx'))).toBe(
      join(dir, 'tsconfig.json')
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

  return dir;
}
