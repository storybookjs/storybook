import { describe, expect, it } from 'vitest';

import { getAutomockCode } from './automock.ts';
import { parseModuleAst } from './extract.ts';

describe('getAutomockCode', () => {
  it('mocks destructured exports, including ones with defaults', () => {
    const code = `
      const obj = { a: 1, b: 2 };
      export const { a = 1, b: renamed } = obj;
      export const [first = 0] = [1];
      export async function getUser() {}
    `;

    const mocked = getAutomockCode(code, false, (source) =>
      parseModuleAst(source, '/mod.ts')
    ).toString();

    for (const name of ['a', 'renamed', 'first', 'getUser']) {
      expect(mocked).toContain(`["${name}"]: ${name},`);
    }
  });

  it('keeps the parentheses of a parenthesized default export', () => {
    const mocked = getAutomockCode('export default (x);', false, (source) =>
      parseModuleAst(source, '/mod.ts')
    ).toString();

    expect(mocked).toMatch(/^const __vitest_default = \(x\);/);
    expect(() => parseModuleAst(mocked, '/mod.ts')).not.toThrow();
  });

  it('mocks a .ts module with generic arrows under a Vite id with a query', () => {
    const code = 'export const identity = <T>(value: T) => value;';

    const mocked = getAutomockCode(code, false, (source) =>
      parseModuleAst(source, '/src/api.ts?v=abc')
    ).toString();

    expect(mocked).toContain('["identity"]: identity,');
  });
});
