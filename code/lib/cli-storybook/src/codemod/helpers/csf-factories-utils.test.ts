import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';
import { generate, parser } from 'storybook/internal/babel';

import {
  cleanupTypeImports,
  getConfigProperties,
  removeExportDeclarations,
} from './csf-factories-utils';

expect.addSnapshotSerializer({
  serialize: (val: any) => {
    if (typeof val === 'string') {
      return val;
    }
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  },
  test: (_val) => true,
});

function parseCodeToProgramNode(code: string): t.Program {
  return parser.parse(code, { sourceType: 'module', plugins: ['typescript'] }).program;
}

function generateCodeFromAST(node: t.Program) {
  return generate(node).code;
}

describe('cleanupTypeImports', () => {
  it('removes disallowed imports from @storybook/*', () => {
    const code = `
      import { Story, SomethingElse } from '@storybook/react';
      import { Other } from 'some-other-package';
    `;

    const programNode = parseCodeToProgramNode(code);
    const cleanedNodes = cleanupTypeImports(programNode, ['Story']);

    expect(generateCodeFromAST({ ...programNode, body: cleanedNodes })).toMatchInlineSnapshot(`
      import { SomethingElse } from '@storybook/react';
      import { Other } from 'some-other-package';
    `);
  });

  it('removes entire import if all specifiers are removed', () => {
    const code = `
      import { Story, Meta } from '@storybook/react';
    `;

    const programNode = parseCodeToProgramNode(code);
    const cleanedNodes = cleanupTypeImports(programNode, ['Story', 'Meta']);

    expect(generateCodeFromAST({ ...programNode, body: cleanedNodes })).toMatchInlineSnapshot(``);
  });

  it('retains non storybook imports', () => {
    const code = `
      import { Preview } from 'internal-types';
    `;

    const programNode = parseCodeToProgramNode(code);
    const cleanedNodes = cleanupTypeImports(programNode, ['Preview']);

    expect(generateCodeFromAST({ ...programNode, body: cleanedNodes })).toMatchInlineSnapshot(
      `import { Preview } from 'internal-types';`
    );
  });

  it('retains namespace imports', () => {
    const code = `
      import * as Storybook from '@storybook/react';
    `;

    const programNode = parseCodeToProgramNode(code);
    const cleanedNodes = cleanupTypeImports(programNode, ['Preview']);

    expect(generateCodeFromAST({ ...programNode, body: cleanedNodes })).toMatchInlineSnapshot(
      `import * as Storybook from '@storybook/react';`
    );
  });

  it('retains imports if they are used', () => {
    const code = `
      import { Type1, type Type2 } from '@storybook/react';
      import type { Type3, ShouldBeRemoved, Type4 } from '@storybook/react';

      const example: Type1 = {};
      const example2 = {} as Type2;
      const example3 = {} satisfies Type3;
      const example4 = {
        render: (args: Type4['args']) => {}
      };
    `;

    const programNode = parseCodeToProgramNode(code);
    const cleanedNodes = cleanupTypeImports(programNode, [
      'Type1',
      'Type2',
      'Type3',
      'Type4',
      'ShouldBeRemoved',
    ]);

    const result = generateCodeFromAST({ ...programNode, body: cleanedNodes });

    expect(result).toMatchInlineSnapshot(`
      import { Type1, type Type2 } from '@storybook/react';
      import type { Type3, Type4 } from '@storybook/react';
      const example: Type1 = {};
      const example2 = {} as Type2;
      const example3 = {} satisfies Type3;
      const example4 = {
        render: (args: Type4['args']) => {}
      };
    `);

    expect(result).not.toContain('ShouldBeRemoved');
  });
});

describe('removeExportDeclarations', () => {
  it('removes specified variable export declarations', () => {
    const code = `
      export const foo = 'foo';
      export const bar = 'bar';
      export const baz = 'baz';
    `;

    const programNode = parseCodeToProgramNode(code);
    const exportDecls = {
      foo: t.variableDeclarator(t.identifier('foo')),
      baz: t.variableDeclarator(t.identifier('baz')),
    };

    const cleanedNodes = removeExportDeclarations(programNode, exportDecls);
    const cleanedCode = generateCodeFromAST({ ...programNode, body: cleanedNodes });

    expect(cleanedCode).toMatchInlineSnapshot(`export const bar = 'bar';`);
  });

  it('removes specified function export declarations', () => {
    const code = `
      export function foo() { return 'foo'; }
      export function bar() { return 'bar'; }
    `;

    const programNode = parseCodeToProgramNode(code);
    const exportDecls = {
      foo: t.functionDeclaration(t.identifier('foo'), [], t.blockStatement([])),
    };

    const cleanedNodes = removeExportDeclarations(programNode, exportDecls);
    const cleanedCode = generateCodeFromAST({ ...programNode, body: cleanedNodes });

    expect(cleanedCode).toMatchInlineSnapshot(`
      export function bar() {
        return 'bar';
      }
    `);
  });

  it('retains exports not in the disallow list', () => {
    const code = `
      export const foo = 'foo';
      export const bar = 'bar';
    `;

    const programNode = parseCodeToProgramNode(code);
    const exportDecls = {
      nonExistent: t.variableDeclarator(t.identifier('nonExistent')),
    };

    const cleanedNodes = removeExportDeclarations(programNode, exportDecls);
    const cleanedCode = generateCodeFromAST({ ...programNode, body: cleanedNodes });

    expect(cleanedCode).toMatchInlineSnapshot(`
      export const foo = 'foo';
      export const bar = 'bar';
    `);
  });
});

describe('getConfigProperties', () => {
  it('returns object properties from variable declarations', () => {
    const exportDecls = {
      foo: t.variableDeclarator(t.identifier('foo'), t.stringLiteral('fooValue')),
      bar: t.variableDeclarator(t.identifier('bar'), t.numericLiteral(42)),
    };

    const properties = getConfigProperties(exportDecls);

    expect(properties).toHaveLength(2);
    expect(properties[0].key.name).toBe('foo');
    expect(properties[0].value.value).toBe('fooValue');
    expect(properties[1].key.name).toBe('bar');
    expect(properties[1].value.value).toBe(42);
  });

  it('returns object properties from function declarations', () => {
    const exportDecls = {
      foo: t.functionDeclaration(t.identifier('foo'), [], t.blockStatement([])),
    };

    const properties = getConfigProperties(exportDecls);

    expect(properties).toHaveLength(1);
    expect(properties[0].key.name).toBe('foo');
    expect(properties[0].value.type).toBe('ArrowFunctionExpression');
  });
});
