import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { parseWithReactDocgenTypescript } from './reactDocgenTypescript';

const fixture = (name: string) => join(__dirname, '__testfixtures__', name);

// Strip absolute paths so snapshots are portable across machines and CI environments
function normalize(results: any[]) {
  return JSON.parse(
    JSON.stringify(results, (key, value) => {
      if ((key === 'filePath' || key === 'fileName') && typeof value === 'string') {
        return value
          .replace(/.*__testfixtures__[\\/]/, '')
          .replace(/.*node_modules[\\/]/, 'node_modules/');
      }
      return value;
    })
  );
}

describe('parseFile', () => {
  test('Button', { timeout: 30_000 }, () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Button.ts')))).toMatchInlineSnapshot(`[]`);
  });

  test('Arrow', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Arrow.ts')))).toMatchInlineSnapshot(`[]`);
  });

  test('DefaultExport', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('DefaultExport.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('MultipleExports', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('MultipleExports.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('UnionProps', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('UnionProps.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('FunctionProps', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('FunctionProps.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('DefaultValues', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('DefaultValues.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('Documented', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Documented.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('NoComponents', () => {
    expect(
      normalize(parseWithReactDocgenTypescript(fixture('NoComponents.ts')))
    ).toMatchInlineSnapshot(`[]`);
  });

  test('ImportedProps (extends + imported types from another file)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('ImportedProps.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('PickOmit (Pick/Omit utility types on imported interfaces)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('PickOmit.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('Generic (generic type parameters resolved to concrete types)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Generic.ts')))).toMatchInlineSnapshot(`[]`);
  });

  test('ReExport (re-exported components from other files)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('ReExport.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('Intersection (intersection of multiple type aliases)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Intersection.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });

  // DtsComponent, ForwardRef, RenamedExport, DisplayNameOverride, Barrel —
  // RDT returns [] for all of these. These patterns are covered by RPT tests instead.
});
