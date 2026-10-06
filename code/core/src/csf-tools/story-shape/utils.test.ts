import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import { type E, type Node, expressionFromSource, textOf } from '../estree/ast.ts';
import {
  csfFactoryReceiver,
  isCanonicalCsf2BindCall,
  isCsfFactoryCall,
  keyOf,
  metaObject,
  resolveIdentifierInit,
  returnedExpression,
  unwrapExpression,
} from './utils.ts';

const parse = (code: string) => {
  const csf = loadCsf(code, { makeTitle: (title) => title ?? 'title' }).parse();
  csf._editor.parentOf(csf._program);
  return csf;
};

const printed = (node: Node) => textOf(node);

// The function a test file declares under the name `render`.
const renderFunction = (code: string): Node => {
  const csf = parse(code);
  const found = resolveIdentifierInit(csf._program, 'render');
  if (!found) {
    throw new Error('Expected a render function');
  }
  return found;
};

describe('isCanonicalCsf2BindCall', () => {
  it('accepts only an identifier .bind call with no configuration', () => {
    expect(
      [
        'Template.bind()',
        'Template.bind({})',
        "Template.bind({ role: 'button' })",
        "Template['bind']({})",
        'Template[bind]({})',
        'makeStory({})',
      ].map((initializer) => [
        initializer,
        isCanonicalCsf2BindCall(expressionFromSource(initializer)),
      ])
    ).toEqual([
      ['Template.bind()', true],
      ['Template.bind({})', true],
      ["Template.bind({ role: 'button' })", false],
      ["Template['bind']({})", false],
      ['Template[bind]({})', false],
      ['makeStory({})', false],
    ]);
  });
});

describe('isCsfFactoryCall', () => {
  it('accepts only static story and extend calls on an identifier receiver', () => {
    expect(
      [
        'meta.story({})',
        'meta.type<{ args: { icon: string } }>().story({})',
        'meta.type<A>().type<B>().story({})',
        'Base.extend({})',
        "meta['story']({})",
        'meta[story]({})',
        'getMeta().story({})',
        'getMeta().type<A>().story({})',
        "meta['type']<A>().story({})",
        "schema.type('string').story({})",
        'makeStory({})',
        'Template.bind({})',
      ].map((initializer) => [initializer, isCsfFactoryCall(expressionFromSource(initializer))])
    ).toEqual([
      ['meta.story({})', true],
      ['meta.type<{ args: { icon: string } }>().story({})', true],
      ['meta.type<A>().type<B>().story({})', true],
      ['Base.extend({})', true],
      ["meta['story']({})", false],
      ['meta[story]({})', false],
      ['getMeta().story({})', false],
      ['getMeta().type<A>().story({})', false],
      ["meta['type']<A>().story({})", false],
      ["schema.type('string').story({})", false],
      ['makeStory({})', false],
      ['Template.bind({})', false],
    ]);
  });

  it('reads the receiver through meta.type<>()', () => {
    const call = expressionFromSource('meta.type<A>().type<B>().story({})');

    expect(isCsfFactoryCall(call) && csfFactoryReceiver(call).name).toBe('meta');
  });
});

describe('keyOf', () => {
  it('returns literal object member keys and skips dynamic keys', () => {
    const meta = metaObject(
      parse(dedent`
        const computed = 'dynamic';
        const spread = {};
        export default {
          title: 'Button',
          label: 'Save',
          'aria-label': 'Close',
          [computed]: 'ignored',
          1: 'ignored',
          method() {},
          'method-label'() {},
          [computed]() {},
          ...spread,
        };
      `)
    );

    const keys = meta?.properties.map((property) =>
      property.type === 'SpreadElement' ? null : keyOf(property)
    );

    expect(keys).toEqual([
      'title',
      'label',
      'aria-label',
      null,
      null,
      'method',
      'method-label',
      null,
      null,
    ]);
  });
});

describe('unwrapExpression', () => {
  it.each(['{} as Story', '{} satisfies Story', '{}!', '({})', '(({} as Story)!) satisfies Story'])(
    'unwraps %s',
    (code) => {
      const wrapped = expressionFromSource(code);
      expect(unwrapExpression(wrapped).type).toBe('ObjectExpression');
    }
  );

  it('returns other nodes untouched', () => {
    const value = expressionFromSource("'Save'");

    expect(unwrapExpression(value)).toBe(value);
  });
});

describe('returnedExpression', () => {
  it.each([
    {
      code: dedent`
        export default { title: 'Button' };
        const render = () => ({ label: 'Save' });
        export const A = {};
      `,
      expected: "{ label: 'Save' }",
      name: 'concise arrow body',
    },
    {
      code: dedent`
        export default { title: 'Button' };
        function render() {
          return { label: 'Save' };
        }
        export const A = {};
      `,
      expected: "{ label: 'Save' }",
      name: 'single-return block',
    },
    {
      code: dedent`
        export default { title: 'Button' };
        const render = () => {
          const label = 'Save';
          return { label };
        };
        export const A = {};
      `,
      expected: undefined,
      name: 'multi-statement block',
    },
    {
      code: dedent`
        export default { title: 'Button' };
        const render = () => {
          save();
        };
        export const A = {};
      `,
      expected: undefined,
      name: 'no-return block',
    },
  ])('resolves $name', ({ code, expected }) => {
    const returned = returnedExpression(renderFunction(code));

    expect(returned ? printed(returned) : undefined).toBe(expected);
  });

  it('resolves an object method body, which `setup()` uses', () => {
    const object = expressionFromSource(`{ setup() { return 'Save'; } }`) as E.ObjectExpression;

    expect(printed(returnedExpression(object.properties[0])!)).toBe(`'Save'`);
  });
});

describe('resolveIdentifierInit', () => {
  it.each([
    ['local', 'function Template(args) {\n  return args;\n}'],
    ['exported', 'export function Template(args) {\n  return args;\n}'],
  ])('resolves %s function declarations', (_, declaration) => {
    const csf = parse(
      `export default { title: 'Button' };\n${declaration}\nexport const A = Template.bind({});`
    );

    const resolved = resolveIdentifierInit(csf._program, 'Template');

    expect(resolved?.type).toBe('FunctionDeclaration');
    expect(printed(resolved!)).toBe('function Template(args) {\n  return args;\n}');
  });

  it.each(['const', 'export const'])('resolves %s arrow initializers', (keyword) => {
    const csf = parse(dedent`
      export default { title: 'Button' };
      ${keyword} Template = (args) => args;
      export const A = Template.bind({});
    `);

    expect(printed(resolveIdentifierInit(csf._program, 'Template')!)).toBe('(args) => args');
  });

  it('returns null for unknown identifiers', () => {
    const csf = parse(dedent`
      export default { title: 'Button' };
      export const A = Template.bind({});
    `);

    expect(resolveIdentifierInit(csf._program, 'Template')).toBeNull();
  });
});

describe('metaObject', () => {
  it('returns the object expression for a parsed CSF meta', () => {
    const meta = metaObject(
      parse(dedent`
        export default {
          title: 'Button',
          args: { label: 'Save' },
        };
      `)
    );

    expect(meta?.type).toBe('ObjectExpression');
    expect(printed(meta!)).toBe("{\n  title: 'Button',\n  args: { label: 'Save' },\n}");
  });

  it('returns undefined before parse() has collected a meta node', () => {
    const csf = loadCsf(
      dedent`
        const title = 'Button';
        export const A = {};
      `,
      { makeTitle: (title) => title ?? 'title' }
    );

    expect(metaObject(csf)).toBeUndefined();
  });
});
