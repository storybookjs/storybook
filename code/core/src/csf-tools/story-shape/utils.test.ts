import { describe, expect, it } from 'vitest';

import { recast, types as t } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import { keyOf, metaObjectPath, resolveIdentifierInit } from './utils.ts';

const parse = (code: string) => {
  return loadCsf(code, { makeTitle: (title) => title ?? 'title' }).parse();
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

describe('keyOf', () => {
  it('returns literal object keys and skips dynamic keys', () => {
    const meta = metaObjectPath(
      parse(dedent`
        const computed = 'dynamic';
        export default {
          title: 'Button',
          label: 'Save',
          'aria-label': 'Close',
          [computed]: 'ignored',
          1: 'ignored',
        };
      `)
    );

    const keys = meta?.node.properties.map((property) =>
      t.isObjectProperty(property) ? keyOf(property) : null
    );

    expect(keys).toEqual(['title', 'label', 'aria-label', null, null]);
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
