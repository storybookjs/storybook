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

  test('DtsComponent (extends React.ButtonHTMLAttributes from .d.ts)', () => {
    const results = normalize(parseWithReactDocgenTypescript(fixture('DtsComponent.tsx')));

    expect(results).toHaveLength(1);
    expect(results[0].displayName).toBe('HtmlButton');
    expect(results[0].exportName).toBe('HtmlButton');

    // User-defined prop should always be present
    expect(results[0].props.variant).toMatchInlineSnapshot(`
      {
        "declarations": [
          {
            "fileName": "DtsComponent.tsx",
            "name": "HtmlButtonProps",
          },
        ],
        "defaultValue": null,
        "description": "The button variant",
        "name": "variant",
        "parent": {
          "fileName": "DtsComponent.tsx",
          "name": "HtmlButtonProps",
        },
        "required": false,
        "type": {
          "name": "enum",
          "raw": ""solid" | "outline"",
          "value": [
            {
              "value": ""solid"",
            },
            {
              "value": ""outline"",
            },
          ],
        },
      }
    `);

    // Bulk system props (>30 from one .d.ts source) should be filtered out
    // The exact set of remaining small-source props varies by @types/react version,
    // so we only assert the structural invariant
    const propNames = Object.keys(results[0].props);
    expect(propNames).toContain('variant');
    expect(propNames).not.toContain('className');
    expect(propNames).not.toContain('onClick');
    expect(propNames).not.toContain('children');
  });

  test('ForwardRef', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('ForwardRef.tsx'))))
      .toMatchInlineSnapshot(`[]`);
  });

  test('RenamedExport (export { Foo as Bar } — displayName differs from exportName)', () => {
    const result = normalize(parseWithReactDocgenTypescript(fixture('RenamedExport.ts')));
    expect(result).toMatchInlineSnapshot(`[]`);
    // Key assertion: displayName is the internal name, exportName is what consumers import
    expect(result[0].displayName).toBe('Alert');
    expect(result[0].exportName).toBe('NotificationBanner');
  });

  test('DisplayNameOverride (component.displayName set explicitly)', () => {
    const result = normalize(parseWithReactDocgenTypescript(fixture('DisplayNameOverride.ts')));
    // The export name should be "Modal" (the export alias), not "InternalModal" or "FancyModal"
    expect(result[0].exportName).toBe('Modal');
    expect(result[0].props).toHaveProperty('title');
    expect(result[0].props).toHaveProperty('open');
  });

  test('Barrel (export * from barrel index)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('barrel/index.ts'))))
      .toMatchInlineSnapshot(`[]`);
  });
});
