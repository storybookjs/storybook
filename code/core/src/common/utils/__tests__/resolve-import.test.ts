import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveImport } from '../interpret-files.ts';

describe('resolveImport', () => {
  it('resolves .js imports to .tsx files when .ts is missing', () => {
    const basedir = mkdtempSync(join(tmpdir(), 'storybook-resolve-import-'));
    writeFileSync(join(basedir, 'Chip.tsx'), 'export const Chip = () => null;');

    const resolved = resolveImport('./Chip.js', { basedir });

    expect(resolved).toEqual(join(realpathSync(basedir), 'Chip.tsx'));
  });

  it('prefers .ts over .tsx when both exist for a .js import', () => {
    const basedir = mkdtempSync(join(tmpdir(), 'storybook-resolve-import-'));
    writeFileSync(join(basedir, 'Chip.ts'), 'export const Chip = () => null;');
    writeFileSync(join(basedir, 'Chip.tsx'), 'export const Chip = () => null;');

    const resolved = resolveImport('./Chip.js', { basedir });

    expect(resolved).toEqual(join(realpathSync(basedir), 'Chip.ts'));
  });
});
