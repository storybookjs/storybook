import { describe, expect, it } from 'vitest';

import { recast, types as t } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { babelParseFile, loadCsf } from '../CsfFile.ts';
import type { RenderFunctionPath } from './render.ts';
import {
  isCanonicalCsf2BindCall,
  isCsfFactoryCall,
  keyOf,
  metaObjectPath,
  resolveIdentifierInit,
  returnedExpression,
  returnedExpressionPath,
  unwrapExpression,
} from './utils.ts';

const parse = (code: string) => {
  return loadCsf(code, { makeTitle: (title) => title ?? 'title' }).parse();
};

const storyInitializer = (initializer: string): t.Node => {
  let found: t.Expression | null | undefined;
  babelParseFile({ code: `const A = ${initializer};` }).path.traverse({
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id, { name: 'A' })) {
        found = path.node.init;
        path.stop();
      }
    },
  });

  if (!found) {
    throw new Error('Expected declaration to have an initializer');
  }
  return found;
};

// Recast may emit CRLF on Windows; keep assertions LF-stable across OSes.
const printed = (node: t.Node) => recast.print(node).code.replace(/\r\n/g, '\n');

const storyBindIdentifier = (code: string) => {
  const storyPath = parse(code)._storyDeclarationPath['A'];

  if (!storyPath.isVariableDeclarator()) {
    throw new Error('Expected story declaration to be a variable declarator');
  }

  const init = storyPath.get('init');
  if (!init.isCallExpression()) {
    throw new Error('Expected story initializer to be a call expression');
  }

  const callee = init.get('callee');
  if (!callee.isMemberExpression()) {
    throw new Error('Expected story initializer callee to be a member expression');
  }

  const object = callee.get('object');
  if (!object.isIdentifier()) {
    throw new Error('Expected bind callee object to be an identifier');
  }

  return {
    identifier: object,
    storyPath,
  };
};

const renderFunctionPath = (code: string): RenderFunctionPath => {
  let found: RenderFunctionPath | undefined;

  parse(code)._file.path.traverse({
    FunctionDeclaration(path) {
      if (path.node.id?.name === 'render') {
        found = path;
        path.stop();
      }
    },
    VariableDeclarator(path) {
      const id = path.get('id');
      const init = path.get('init');

      if (
        id.isIdentifier({ name: 'render' }) &&
        (init.isArrowFunctionExpression() || init.isFunctionExpression())
      ) {
        found = init;
        path.stop();
      }
    },
  });

  if (!found) {
    throw new Error('Expected a render function path');
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
      ].map((initializer) => [initializer, isCanonicalCsf2BindCall(storyInitializer(initializer))])
    ).toMatchInlineSnapshot(`
      [
        [
          "Template.bind()",
          true,
        ],
        [
          "Template.bind({})",
          true,
        ],
        [
          "Template.bind({ role: 'button' })",
          false,
        ],
        [
          "Template['bind']({})",
          false,
        ],
        [
          "Template[bind]({})",
          false,
        ],
        [
          "makeStory({})",
          false,
        ],
      ]
    `);
  });
});

describe('isCsfFactoryCall', () => {
  it('accepts only static story and extend calls on an identifier receiver', () => {
    expect(
      [
        'meta.story({})',
        'Base.extend({})',
        "meta['story']({})",
        'meta[story]({})',
        'getMeta().story({})',
        'makeStory({})',
        'Template.bind({})',
      ].map((initializer) => [initializer, isCsfFactoryCall(storyInitializer(initializer))])
    ).toMatchInlineSnapshot(`
      [
        [
          "meta.story({})",
          true,
        ],
        [
          "Base.extend({})",
          true,
        ],
        [
          "meta['story']({})",
          false,
        ],
        [
          "meta[story]({})",
          false,
        ],
        [
          "getMeta().story({})",
          false,
        ],
        [
          "makeStory({})",
          false,
        ],
        [
          "Template.bind({})",
          false,
        ],
      ]
    `);
  });
});

describe('keyOf', () => {
  it('returns literal object member keys and skips dynamic keys', () => {
    const meta = metaObjectPath(
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

    const keys = meta?.node.properties.map((property) =>
      t.isSpreadElement(property) ? null : keyOf(property)
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
  const typeAnnotation = t.tsTypeReference(t.identifier('Story'));

  it('unwraps TypeScript expression wrappers and parentheses', () => {
    const value = t.objectExpression([]);

    expect(unwrapExpression(t.tsAsExpression(value, typeAnnotation))).toBe(value);
    expect(unwrapExpression(t.tsSatisfiesExpression(value, typeAnnotation))).toBe(value);
    expect(unwrapExpression(t.tsNonNullExpression(value))).toBe(value);
    expect(unwrapExpression(t.tsTypeAssertion(typeAnnotation, value))).toBe(value);
    expect(unwrapExpression(t.parenthesizedExpression(value))).toBe(value);
  });

  it('unwraps nested TypeScript expression wrappers', () => {
    const value = t.objectExpression([]);
    const wrapped = t.tsSatisfiesExpression(
      t.tsNonNullExpression(t.tsAsExpression(value, typeAnnotation)),
      typeAnnotation
    );

    expect(unwrapExpression(wrapped)).toBe(value);
  });

  it('returns other nodes untouched', () => {
    const value = t.stringLiteral('Save');

    expect(unwrapExpression(value)).toBe(value);
  });
});

describe('returnedExpression', () => {
  const cases = [
    {
      code: dedent`
        export default { title: 'Button' };
        const render = () => ({ label: 'Save' });
        export const A = {};
      `,
      expected: "({\n  label: 'Save'\n})",
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
  ];

  it.each(cases)('resolves $name', ({ code, expected }) => {
    const returned = returnedExpression(renderFunctionPath(code).node);

    expect(returned ? printed(returned) : undefined).toBe(expected);
  });

  it.each(cases)('resolves $name as a path', ({ code, expected }) => {
    const returned = returnedExpressionPath(renderFunctionPath(code));

    expect(returned ? printed(returned.node) : undefined).toBe(expected);
  });

  it('resolves an object method body, which `setup()` uses', () => {
    const [method] = t.objectExpression([
      t.objectMethod(
        'method',
        t.identifier('setup'),
        [],
        t.blockStatement([t.returnStatement(t.stringLiteral('Save'))])
      ),
    ]).properties;

    expect(printed(returnedExpression(method)!)).toBe(`"Save"`);
  });
});

describe('resolveIdentifierInit', () => {
  it('resolves local function declarations', () => {
    const { identifier, storyPath } = storyBindIdentifier(dedent`
      export default { title: 'Button' };
      function Template(args) {
        return args;
      }
      export const A = Template.bind({});
    `);

    const resolved = resolveIdentifierInit(storyPath, identifier);

    expect(resolved?.isFunctionDeclaration()).toBe(true);
    expect(printed(resolved!.node)).toMatchInlineSnapshot(`
      "function Template(args) {
        return args;
      }"
    `);
  });

  it('resolves exported function declarations', () => {
    const { identifier, storyPath } = storyBindIdentifier(dedent`
      export default { title: 'Button' };
      export function Template(args) {
        return args;
      }
      export const A = Template.bind({});
    `);

    const resolved = resolveIdentifierInit(storyPath, identifier);

    expect(resolved?.isFunctionDeclaration()).toBe(true);
    expect(printed(resolved!.node)).toMatchInlineSnapshot(`
      "function Template(args) {
        return args;
      }"
    `);
  });

  it('resolves local and exported const arrow initializers', () => {
    const local = storyBindIdentifier(dedent`
      export default { title: 'Button' };
      const Template = (args) => args;
      export const A = Template.bind({});
    `);
    const exported = storyBindIdentifier(dedent`
      export default { title: 'Button' };
      export const Template = (args) => args;
      export const A = Template.bind({});
    `);

    expect(printed(resolveIdentifierInit(local.storyPath, local.identifier)!.node)).toBe(
      '(args) => args'
    );
    expect(printed(resolveIdentifierInit(exported.storyPath, exported.identifier)!.node)).toBe(
      '(args) => args'
    );
  });

  it('returns null for unknown identifiers', () => {
    const { identifier, storyPath } = storyBindIdentifier(dedent`
      export default { title: 'Button' };
      export const A = Template.bind({});
    `);

    expect(resolveIdentifierInit(storyPath, identifier)).toBeNull();
  });
});

describe('metaObjectPath', () => {
  it('returns the object expression path for a parsed CSF meta', () => {
    const meta = metaObjectPath(
      parse(dedent`
        export default {
          title: 'Button',
          args: { label: 'Save' },
        };
      `)
    );

    expect(meta?.isObjectExpression()).toBe(true);
    expect(printed(meta!.node)).toMatchInlineSnapshot(`
      "{
          title: 'Button',
          args: { label: 'Save' }
      }"
    `);
  });

  // A parsed CSF file always has a meta object (parse() throws otherwise), so the
  // undefined branch is only reachable before parse() has collected a meta node.
  it('returns undefined when no meta node has been collected yet', () => {
    const csf = loadCsf(
      dedent`
        const title = 'Button';
        export const A = {};
      `,
      { makeTitle: (title) => title ?? 'title' }
    );

    expect(metaObjectPath(csf)).toBeUndefined();
  });
});
