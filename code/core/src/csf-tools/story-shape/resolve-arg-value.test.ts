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

  describe('a name bound by destructuring', () => {
    const defaults = `const defaults = { label: 'Save', size: 'lg' };`;

    it.each([
      { name: 'a property', code: `${defaults} const { label } = defaults;`, arg: 'label' },
      {
        name: 'a renamed property',
        code: `${defaults} const { label: text } = defaults;`,
        arg: 'text',
      },
      {
        name: 'a nested property',
        code: `const config = { args: { label: 'Save' } }; const { args: { label } } = config;`,
        arg: 'label',
      },
      {
        name: 'a property of a member chain',
        code: `const config = { args: { label: 'Save' } }; const { label } = config.args;`,
        arg: 'label',
      },
      {
        name: 'a property of an object literal',
        code: `const { label } = { label: 'Save' };`,
        arg: 'label',
      },
      {
        name: 'an alias of a property',
        code: `${defaults} const { label } = defaults; const A = label;`,
        arg: 'A',
      },
      {
        name: 'a property that names a local const',
        code: `const LABEL = 'Save'; const config = { label: LABEL }; const { label } = config;`,
        arg: 'label',
      },
      {
        name: 'a property of a story',
        code: `const Primary = { args: { label: 'Save' } }; const { args: { label } } = Primary;`,
        arg: 'label',
      },
      {
        name: 'a property a CSF2 assignment wrote',
        code: `const Primary = () => null; Primary.args = { label: 'Save' }; const { args: { label } } = Primary;`,
        arg: 'label',
      },
      {
        name: 'a property of a CSF factory story input',
        code: `const meta = preview.meta({}); const Primary = meta.story({ args: { label: 'Save' } }); const { input: { args: { label } } } = Primary;`,
        arg: 'label',
      },
    ])('reads $name through to its value', ({ code, arg }) => {
      expect(valueOf(code, arg)).toEqual({ node: "'Save'", imports: [], unresolved: [] });
    });

    it('writes out the object a rest element holds', () => {
      const code = `${defaults} const { size, ...rest } = defaults;`;
      expect(valueOf(code, 'rest')).toEqual({
        node: "{ label: 'Save' }",
        imports: [],
        unresolved: [],
      });
    });

    it('keeps a rest element whose source has an unreadable spread as a name', () => {
      const code = `const config = { label: 'Save', ...buildRest() }; const { size, ...rest } = config;`;
      expect(valueOf(code, 'rest')).toEqual({ node: 'rest', imports: [], unresolved: ['rest'] });
    });

    it.each([
      { name: 'the destructured name', write: `label.text = 'new';` },
      { name: 'the source', write: `holder.label.text = 'new';` },
    ])(
      'keeps a name that holds a named object when a write through $name may change it',
      ({ write }) => {
        const code = `const original = { text: 'old' }; const holder = { label: original }; const { label } = holder; ${write}`;
        expect(valueOf(code, 'label')).toEqual({
          node: 'label',
          imports: [],
          unresolved: ['label'],
        });
      }
    );

    it('reads the source as it was when the destructuring ran', () => {
      const code = dedent`
        const Primary = () => null;
        Primary.args = { label: 'Save' };
        const { args: { label } } = Primary;
        Primary.args = { label: 'Later' };
      `;
      expect(valueOf(code, 'label')).toEqual({ node: "'Save'", imports: [], unresolved: [] });
    });

    it.each([
      { name: 'an array element', code: `const list = ['Save']; const [label] = list;` },
      { name: 'a default value', code: `${defaults} const { label = 'Other' } = defaults;` },
      {
        name: 'a computed key',
        code: `${defaults} const key = 'label'; const { [key]: label } = defaults;`,
      },
      {
        name: 'a missing property',
        code: `const config = { size: 'lg' }; const { label } = config;`,
      },
      {
        name: 'a property an unreadable spread may override',
        code: `const config = { label: 'Save', ...buildRest() }; const { label } = config;`,
      },
      {
        name: 'a method',
        code: `const config = { label() { return 'Save'; } }; const { label } = config;`,
      },
      {
        name: 'a getter',
        code: `const config = { get label() { return 'Save'; } }; const { label } = config;`,
      },
      { name: 'a call result', code: `const { label } = buildDefaults();` },
    ])('keeps a name bound by $name', ({ code }) => {
      expect(valueOf(code, 'label')).toEqual({ node: 'label', imports: [], unresolved: ['label'] });
    });

    const importedContext = (
      externalize?: ReferenceContext['externalize'],
      shared = `export const defaults = { label: 'Save' };`,
      entry = `import { defaults } from './shared';\nconst { label } = defaults;\nexport const Story = { args: { v: label } };`
    ): ReferenceContext => {
      const sharedModule = indexed(new SourceEditor(shared, 'shared.ts'));
      return {
        ...contextOf(entry),
        resolveModule: () => ({ editor: sharedModule, filePath: 'shared.ts' }),
        ...(externalize ? { externalize } : {}),
      };
    };
    const importedValue = (ctx: ReferenceContext) => {
      const record = resolveArgsRecord(resolveBindingMembers(ctx, 'Story')?.properties.args, ctx);
      const resolved = resolveArgValue(record.properties.v, ctx);
      return { node: oneLineTextOf(resolved.node), unresolved: resolved.unresolved };
    };

    it('reads a property of an imported object when its value can be externalized', () => {
      expect(importedValue(importedContext((node) => node))).toEqual({
        node: "'Save'",
        unresolved: [],
      });
    });

    it.each([
      { name: 'a nested write after the destructuring', writes: ['', 'd.n.x = 2;'] },
      { name: 'a write before the destructuring', writes: ['d.n = { x: 2 };', ''] },
    ])('keeps the name when the story file makes $name to an imported source', ({ writes }) => {
      const entry = `import { d } from './shared';\n${writes[0]}\nconst { n } = d;\n${writes[1]}\nexport const Story = { args: { v: n } };`;
      const ctx = importedContext((node) => node, `export const d = { n: { x: 1 } };`, entry);
      expect(importedValue(ctx)).toEqual({ node: 'n', unresolved: ['n'] });
    });

    it('keeps the name when an imported value cannot be externalized', () => {
      expect(importedValue(importedContext(() => undefined))).toEqual({
        node: 'label',
        unresolved: ['label'],
      });
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

  describe('a destructured name whose value this pass cannot pin down', () => {
    it.each([
      {
        name: 'the source was written to with a compound assignment before the pattern ran',
        code: `const d = { size: 1 }; d.size += 1; const { size } = d;`,
        arg: 'size',
      },
      {
        name: 'the source was written into below its first level before the pattern ran',
        code: `const O = { args: { label: 'o' } }; O.args.label = 'c'; const { args } = O;`,
        arg: 'args',
      },
      {
        name: 'a CSF factory input was replaced before the pattern ran',
        code: `const meta = preview.meta({}); const P = meta.story({ args: { label: 'p' } }); P.input.args = { label: 'z' }; const { args } = P.input;`,
        arg: 'args',
      },
      {
        name: 'the object it shares with its source is written into after the pattern ran',
        code: `const d = { n: { x: 1 } }; const { n } = d; d.n.x = 2;`,
        arg: 'n',
      },
      {
        name: 'the object it holds is written to through the name',
        code: `const d = { n: { x: 1 } }; const { n } = d; n.x = 2;`,
        arg: 'n',
      },
      {
        name: 'it is destructured from a name whose object the source wrote into',
        code: `const d = { n: { x: 1 } }; const { n } = d; d.n.x = 2; const { x } = n;`,
        arg: 'x',
      },
      {
        name: 'its key is one every object inherits',
        code: `const d = { a: 1 }; const { toString } = d;`,
        arg: 'toString',
      },
      {
        name: 'its key is __proto__',
        code: `const d = { a: 1 }; const { __proto__: proto } = d;`,
        arg: 'proto',
      },
    ])('keeps the name when $name', ({ code, arg }) => {
      expect(valueOf(code, arg)).toEqual({ node: arg, imports: [], unresolved: [arg] });
    });

    it('reads a rest element reached through an alias where the arg is, not where the alias is', () => {
      const code = `const d = { size: 1 }; const { ...rest } = d; const al = rest; rest.size = 7;`;
      expect(valueOf(code, 'al')).toEqual({ node: '{ size: 7 }', imports: [], unresolved: [] });
    });

    it('terminates on a rest element that spreads itself', () => {
      const code = `var { ...rest } = { a: { ...rest } };`;
      expect(valueOf(code, 'rest').unresolved).toContain('rest');
    });
  });

  it('names nothing for a global or a parameter the expression declares itself', () => {
    expect(valueOf('', '(event) => Math.max(event.x, 0)')).toEqual({
      node: '(event) => Math.max(event.x, 0)',
      imports: [],
      unresolved: [],
    });
  });
});
