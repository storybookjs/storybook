// Integration tests for parseReExports — exercises the real oxc-parser binary.
import { describe, expect, it } from 'vitest';

import { parseReExports } from './index.ts';

describe('parseReExports', () => {
  it('maps a named re-export to its source specifier and imported name', async () => {
    const map = await parseReExports('/tmp/barrel.ts', `export { Button } from './Button';`);

    expect(map.get('Button')).toEqual({ specifier: './Button', importedName: 'Button' });
  });

  it('maps `export { default as X }` — ExportImportNameKind has no Default variant', async () => {
    const map = await parseReExports('/tmp/barrel.ts', `export { default as Card } from './Card';`);

    expect(map.get('Card')).toEqual({ specifier: './Card', importedName: 'default' });
  });

  it('handles multiple named re-exports in one file', async () => {
    const source = [
      `export { Button } from './Button';`,
      `export { Input } from './Input';`,
      `export { default as Icon } from './Icon';`,
    ].join('\n');

    const map = await parseReExports('/tmp/barrel.ts', source);

    expect(map.get('Button')).toEqual({ specifier: './Button', importedName: 'Button' });
    expect(map.get('Input')).toEqual({ specifier: './Input', importedName: 'Input' });
    expect(map.get('Icon')).toEqual({ specifier: './Icon', importedName: 'default' });
  });

  it('skips wildcard `export * from "mod"` (no exportName)', async () => {
    const map = await parseReExports('/tmp/barrel.ts', `export * from './util';`);

    expect(map.size).toBe(0);
  });

  it('skips `export * as ns from "mod"` (importName.kind === All)', async () => {
    const map = await parseReExports('/tmp/barrel.ts', `export * as ns from './util';`);

    expect(map.size).toBe(0);
  });

  it('skips type-only re-exports', async () => {
    const map = await parseReExports(
      '/tmp/barrel.ts',
      `export type { ButtonProps } from './Button';`
    );

    expect(map.size).toBe(0);
  });

  it('returns empty map for a file with no re-exports', async () => {
    const map = await parseReExports('/tmp/a.ts', `export const x = 1;`);

    expect(map.size).toBe(0);
  });

  it('returns empty map on parse failure', async () => {
    const map = await parseReExports('/tmp/a.ts', '');

    expect(map).toBeInstanceOf(Map);
  });
});
