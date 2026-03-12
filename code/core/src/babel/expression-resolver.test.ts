import { describe, expect, it } from 'vitest';

import * as parser from '@babel/parser';

import { resolveExpression, unwrapTSExpression } from './expression-resolver';

const parse = (code: string) =>
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });

describe('unwrapTSExpression', () => {
  it('returns non-TS-wrapped expressions unchanged', () => {
    const ast = parse('42');
    const numLiteral = (ast.program.body[0] as any).expression;
    expect(unwrapTSExpression(numLiteral)).toBe(numLiteral);
  });

  it('unwraps TSAsExpression', () => {
    const ast = parse('foo as string');
    const asExpr = (ast.program.body[0] as any).expression;
    const result = unwrapTSExpression(asExpr);
    expect(result.type).toBe('Identifier');
    expect((result as any).name).toBe('foo');
  });

  it('unwraps TSSatisfiesExpression', () => {
    const ast = parse('foo satisfies string');
    const satisfiesExpr = (ast.program.body[0] as any).expression;
    const result = unwrapTSExpression(satisfiesExpr);
    expect(result.type).toBe('Identifier');
    expect((result as any).name).toBe('foo');
  });

  it('unwraps TSTypeAssertion (<string>foo)', () => {
    const ast = parser.parse('<string>foo', {
      sourceType: 'module',
      plugins: [['typescript', { dts: false }]],
    });
    const typeAssertion = (ast.program.body[0] as any).expression;
    const result = unwrapTSExpression(typeAssertion);
    expect(result.type).toBe('Identifier');
    expect((result as any).name).toBe('foo');
  });

  it('unwraps nested TS wrappers', () => {
    const ast = parse('(foo as any) satisfies string');
    const outer = (ast.program.body[0] as any).expression;
    const result = unwrapTSExpression(outer);
    expect(result.type).toBe('Identifier');
    expect((result as any).name).toBe('foo');
  });
});

describe('resolveExpression', () => {
  it('returns null for null/undefined input', () => {
    const ast = parse('');
    expect(resolveExpression(null, ast)).toBeNull();
    expect(resolveExpression(undefined, ast)).toBeNull();
  });

  it('returns non-Identifier expressions directly', () => {
    const ast = parse('42');
    const numLiteral = (ast.program.body[0] as any).expression;
    expect(resolveExpression(numLiteral, ast)).toBe(numLiteral);
  });

  it('resolves a bare VariableDeclaration', () => {
    const ast = parse(`
      const foo = { a: 1 };
      export default foo;
    `);
    const defaultExport = ast.program.body[1] as any;
    const result = resolveExpression(defaultExport.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('resolves an exported const (ExportNamedDeclaration)', () => {
    const ast = parse(`
      export const config = { a: 1 };
      export default config;
    `);
    const defaultExport = ast.program.body[1] as any;
    const result = resolveExpression(defaultExport.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('resolves a chain of variable references', () => {
    const ast = parse(`
      const inner = { a: 1 };
      const outer = inner;
      export default outer;
    `);
    const defaultExport = ast.program.body[2] as any;
    const result = resolveExpression(defaultExport.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('resolves through TSAsExpression', () => {
    const ast = parse(`
      const foo = { a: 1 };
      export default foo as any;
    `);
    const defaultExport = ast.program.body[1] as any;
    const result = resolveExpression(defaultExport.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('resolves through TSSatisfiesExpression', () => {
    const ast = parse(`
      const foo = { a: 1 };
      export default foo satisfies object;
    `);
    const defaultExport = ast.program.body[1] as any;
    const result = resolveExpression(defaultExport.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('returns the Identifier node when variable is not found', () => {
    const ast = parse(`export default unknown;`);
    const defaultExport = ast.program.body[0] as any;
    const result = resolveExpression(defaultExport.declaration, ast);
    expect(result?.type).toBe('Identifier');
    expect((result as any).name).toBe('unknown');
  });

  it('returns the Identifier node when variable has no initializer', () => {
    const ast = parse(`
      let foo;
      export default foo;
    `);
    const defaultExport = ast.program.body[1] as any;
    const result = resolveExpression(defaultExport.declaration, ast);
    expect(result?.type).toBe('Identifier');
    expect((result as any).name).toBe('foo');
  });

  it('returns null when maxDepth is exceeded', () => {
    // Create a chain longer than maxDepth (default 10)
    const lines = Array.from({ length: 12 }, (_, i) =>
      i === 0 ? `const v0 = { a: 1 };` : `const v${i} = v${i - 1};`
    ).join('\n');
    const ast = parse(`${lines}\nexport default v11;`);
    const defaultExport = ast.program.body[ast.program.body.length - 1] as any;
    const result = resolveExpression(defaultExport.declaration, ast);
    // Depth exceeded — returns null
    expect(result).toBeNull();
  });
});
