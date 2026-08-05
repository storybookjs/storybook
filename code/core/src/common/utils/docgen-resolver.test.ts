import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { defaultLookupModule } from './docgen-resolver.ts';

describe('defaultLookupModule', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  function createTempDir() {
    const tempDir = mkdtempSync(join(tmpdir(), 'storybook-docgen-resolver-'));
    tempDirs.push(tempDir);
    return tempDir;
  }

  it('resolves package exports with import conditions', () => {
    const root = createTempDir();
    const packageDir = join(root, 'node_modules', 'exports-only-package');
    const distDir = join(packageDir, 'dist');

    mkdirSync(distDir, { recursive: true });
    writeFileSync(
      join(packageDir, 'package.json'),
      JSON.stringify(
        {
          name: 'exports-only-package',
          exports: {
            '.': {
              import: './dist/index.mjs',
              require: './dist/index.js',
            },
          },
        },
        null,
        2
      )
    );
    writeFileSync(join(distDir, 'index.mjs'), 'export const value = true;\n');
    writeFileSync(join(distDir, 'index.js'), 'exports.value = true;\n');

    expect(defaultLookupModule('exports-only-package', root)).toBe(join(distDir, 'index.mjs'));
  });
});
