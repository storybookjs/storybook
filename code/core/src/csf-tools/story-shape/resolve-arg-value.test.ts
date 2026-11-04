import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { textOf } from '../estree/ast.ts';
import { SourceEditor } from '../estree/editor.ts';
import { resolveArgValue } from './resolve-arg-value.ts';
import {
  type ReferenceContext,
  resolveArgsRecord,
  resolveBindingMembers,
  oneLineTextOf,
} from './resolve-members.ts';

const indexed = (editor: SourceEditor) => {
  editor.parentOf(editor.program);
  return editor;
};
const contextOf = (code: string, filePath = 'entry.ts'): ReferenceContext => ({
  editor: indexed(new SourceEditor(code, filePath)),
  filePath,
});

const valueOf = (code: string, expression: string) => {
  const ctx = contextOf(`${code}\nexport const Story = { args: { v: ${expression} } };`);
  const record = resolveArgsRecord(resolveBindingMembers(ctx, 'Story')?.properties.args, ctx);
  const resolved = resolveArgValue(record.properties.v, ctx);
  return {
    node: oneLineTextOf(resolved.node),
    imports: resolved.imports.map((ref) => `${ref.localImportName}:${ref.importId}`),
    unresolved: resolved.unresolved,
  };
};

describe('resolveArgValue', () => {
  it.each([
    { expression: '[{ ...Base },,]', node: '[{ a: 1 }, ,]' },
    { expression: '[, { ...Base }]', node: '[, { a: 1 }]' },
    { expression: '[{ ...Base }, , 1]', node: '[{ a: 1 }, , 1]' },
  ])('keeps the holes of $expression when it writes out a spread', ({ expression, node }) => {
    const base = 'const Base = { a: 1 };';
    const { node: text } = valueOf(base, expression);
    const original = new Function(`${base} return ${expression}`)() as unknown[];
    const written = new Function(`return ${text}`)() as unknown[];

    expect(text).toBe(node);
    expect(written).toHaveLength(original.length);
    expect(Object.keys(written)).toEqual(Object.keys(original));
  });

  it('reads a local const through to the value it was declared with', () => {
    expect(valueOf(`const LOCAL_LABEL = 'local';`, 'LOCAL_LABEL')).toEqual({
      node: "'local'",
      imports: [],
      unresolved: [],
    });
  });

  it('follows a chain of local consts', () => {
    expect(valueOf(`const A = B; const B = 42;`, 'A')).toEqual({
      node: '42',
      imports: [],
      unresolved: [],
    });
  });

  it('keeps an imported name and reports the import it needs', () => {
    expect(valueOf(`import { IMPORTED_LABEL } from './constants';`, 'IMPORTED_LABEL')).toEqual({
      node: 'IMPORTED_LABEL',
      imports: ['IMPORTED_LABEL:./constants'],
      unresolved: [],
    });
  });

  it('reports the import a call expression reaches for', () => {
    expect(valueOf(`import { computeCount } from './helpers';`, 'computeCount(2)')).toEqual({
      node: 'computeCount(2)',
      imports: ['computeCount:./helpers'],
      unresolved: [],
    });
  });

  it('reports a local name a larger expression reaches for, which it cannot substitute', () => {
    expect(valueOf(`const factor = 2;`, 'factor * 3')).toEqual({
      node: 'factor * 3',
      imports: [],
      unresolved: ['factor'],
    });
  });

  it('reports the import a nested parameter of the same name does not hide', () => {
    expect(valueOf(`import { dep } from './helpers';`, '[dep => dep, dep]')).toEqual({
      node: '[dep => dep, dep]',
      imports: ['dep:./helpers'],
      unresolved: [],
    });
  });

  it('reads the name a shorthand property reaches for', () => {
    expect(valueOf(`import { dep } from './helpers';`, '{ dep }')).toEqual({
      node: '{ dep }',
      imports: ['dep:./helpers'],
      unresolved: [],
    });
  });

  it('writes out a spread inside an object the arg holds', () => {
    expect(valueOf(`const base = { size: 'md' };`, `{ ...base, tone: 'neutral' }`)).toEqual({
      node: "{ size: 'md', tone: 'neutral' }",
      imports: [],
      unresolved: [],
    });
  });

  it('leaves an object holding a spread it cannot read exactly as written', () => {
    expect(valueOf('', `{ ...buildBase(), tone: 'neutral' }`)).toEqual({
      node: "{ ...buildBase(), tone: 'neutral' }",
      imports: [],
      unresolved: ['...buildBase()'],
    });
  });

  it('keeps a shorthand property shorthand while writing out a sibling spread', () => {
    expect(
      valueOf(
        `import { dep } from './helpers'; const base = { size: 'md' };`,
        `{ dep, nested: { ...base } }`
      )
    ).toEqual({
      node: "{ dep, nested: { size: 'md' } }",
      imports: ['dep:./helpers'],
      unresolved: [],
    });
  });

  it.each([
    [`[(f(), 1), { ...base }]`, `[(f(), 1), { size: 'md' }]`],
    [`{ a: (f(), 1), [(k, 'b')]: { ...base } }`, `{ a: (f(), 1), [(k, 'b')]: { size: 'md' } }`],
  ])('keeps the parentheses of comma expressions while writing out %s', (expression, node) => {
    expect(valueOf(`const base = { size: 'md' };`, expression).node).toBe(node);
  });

  it('leaves a literal alone', () => {
    expect(valueOf('', `{ a: 1, b: [2, 3] }`)).toEqual({
      node: '{ a: 1, b: [2, 3] }',
      imports: [],
      unresolved: [],
    });
  });

  const textOfValue = (code: string) => {
    const ctx = contextOf(code);
    const record = resolveArgsRecord(resolveBindingMembers(ctx, 'Story')?.properties.args, ctx);
    return textOf(resolveArgValue(record.properties.v, ctx).node);
  };

  it.each([
    [
      'two levels deep',
      `const base = {\n  nested: {\n    deep: 1,\n  },\n};`,
      `{\n  nested: {\n    deep: 1,\n  },\n  tone: 'x',\n}`,
    ],
    [
      'three levels deep',
      `const base = {\n  nested: {\n    deeper: {\n      deepest: \`a\n  b\`,\n    },\n  },\n};`,
      `{\n  nested: {\n    deeper: {\n      deepest: \`a\n  b\`,\n    },\n  },\n  tone: 'x',\n}`,
    ],
    [
      'indented with tabs',
      `const base = {\n\tnested: {\n\t\tdeep: \`a\n\tb\`,\n\t},\n};`,
      `{\n\tnested: {\n\t\tdeep: \`a\n\tb\`,\n\t},\n\ttone: 'x',\n}`,
    ],
  ])(
    "writes out a spread's members %s at the file's indent, leaving literal lines alone",
    (_, code, text) => {
      const story = `export const Story = { args: { v: { ...base, tone: 'x' } } };`;
      expect(textOfValue(`${code}\n${story}`)).toBe(text);
    }
  );

  it('writes out the elements of an array holding a spread as if their lines had no indent', () => {
    const code = dedent`
      const base = { a: 1 };
      export const Story = {
        args: {
          v: [
            { ...base },
            {
              z: 2,
            },
          ],
        },
      };
    `;
    expect(textOfValue(code)).toBe(`[{\n  a: 1,\n}, {\n  z: 2,\n}]`);
  });

  it('writes out a spread without a trailing comma in a file whose objects have none', () => {
    const code = dedent`
      const base = {
        nested: {
          deep: 1
        }
      };
      export const Story = { args: { v: { ...base, tone: 'x' } } };
    `;
    expect(textOfValue(code)).toBe(`{\n  nested: {\n    deep: 1\n  },\n  tone: 'x'\n}`);
  });

  it('names nothing for a global or a parameter the expression declares itself', () => {
    expect(valueOf('', '(event) => Math.max(event.x, 0)')).toEqual({
      node: '(event) => Math.max(event.x, 0)',
      imports: [],
      unresolved: [],
    });
  });
});
