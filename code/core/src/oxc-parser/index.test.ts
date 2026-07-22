// Integration tests for parseReExports — exercises the real oxc-parser binary.
import { describe, expect, it } from 'vitest';

import { parseLocalBindings, parseReExports } from './index.ts';

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

describe('parseLocalBindings', () => {
  it('collects top-level variable, function and class declarations', async () => {
    const names = await parseLocalBindings(
      '/tmp/a.ts',
      `const a = 1, b = 2;\nlet c;\nfunction d() {}\nclass e {}`
    );

    expect([...names].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('collects names introduced via `export <declaration>`', async () => {
    const names = await parseLocalBindings(
      '/tmp/a.ts',
      `export const Tab = {};\nexport function Foo() {}\nexport class Bar {}`
    );

    expect([...names].sort()).toEqual(['Bar', 'Foo', 'Tab']);
  });

  it('excludes imports and re-exports whose binding lives in another module', async () => {
    const names = await parseLocalBindings(
      '/tmp/barrel.ts',
      `import { x } from './x';\nexport { Tab } from './Tabs';\nexport * from './Other';`
    );

    expect(names.size).toBe(0);
  });

  it('includes a local binding that is also separately re-exported by name', async () => {
    const names = await parseLocalBindings('/tmp/a.ts', `const Tab = {};\nexport { Tab };`);

    expect([...names]).toEqual(['Tab']);
  });

  it('skips destructuring patterns that are not referenceable by a single name', async () => {
    const names = await parseLocalBindings('/tmp/a.ts', `const { a } = obj;\nconst plain = 1;`);

    expect([...names]).toEqual(['plain']);
  });

  it('returns an empty set on parse failure', async () => {
    const names = await parseLocalBindings('/tmp/a.ts', `const = ;`);

    expect(names).toBeInstanceOf(Set);
    expect(names.size).toBe(0);
  });
});
