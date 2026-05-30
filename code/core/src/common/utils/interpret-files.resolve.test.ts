import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveImport } from './interpret-files.ts';

describe('resolveImport', () => {
  let fixtureDir: string | undefined;

  afterEach(() => {
    if (fixtureDir) {
      rmSync(fixtureDir, { recursive: true, force: true });
      fixtureDir = undefined;
    }
  });

  it('resolves a .js import to a .tsx file when no .ts file exists', () => {
    fixtureDir = mkdtempSync(join(tmpdir(), 'storybook-resolve-import-'));
    mkdirSync(join(fixtureDir, 'src'));
    writeFileSync(join(fixtureDir, 'src', 'Chip.tsx'), 'export const Chip = () => null;');

    const resolved = resolveImport('./src/Chip.js', { basedir: fixtureDir });

    expect(resolved).toBe(realpathSync(join(fixtureDir, 'src', 'Chip.tsx')));
  });
});
