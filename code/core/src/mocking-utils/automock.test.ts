import { describe, expect, it } from 'vitest';

import { parseModule } from '../csf-tools/estree/ast.ts';
import { getAutomockCode } from './automock.ts';
import { babelParser } from './extract.ts';

describe('getAutomockCode', () => {
  it('mocks destructured exports, including ones with defaults', () => {
    const code = `
      const obj = { a: 1, b: 2 };
      export const { a = 1, b: renamed } = obj;
      export const [first = 0] = [1];
      export async function getUser() {}
    `;

    const mocked = getAutomockCode(code, false, '/mod.ts').toString();

    for (const name of ['a', 'renamed', 'first', 'getUser']) {
      expect(mocked).toContain(`["${name}"]: ${name},`);
    }
  });

  it.each([
    ['export default (x);', 'const __vitest_default = (x);'],
    ['export /* a */ default /* b */ ((x));', 'const __vitest_default = ((x));'],
  ])('keeps the parentheses of %s', (code, declaration) => {
    const mocked = getAutomockCode(code, false, '/mod.ts').toString();

    expect(mocked.startsWith(declaration)).toBe(true);
    expect(() => parseModule(mocked, '/mod.ts')).not.toThrow();
  });

  it('mocks every export of a CRLF module', () => {
    const code = 'export const a = 1;\r\nexport function b() {}\r\nexport default a;\r\n';

    const mocked = getAutomockCode(code, false, '/mod.ts').toString();

    expect(mocked).toContain('["a"]: a,');
    expect(mocked).toContain('["b"]: b,');
    expect(mocked).toContain('["__vitest_default"]: __vitest_default,');
    expect(() => parseModule(mocked, '/mod.ts')).not.toThrow();
  });

  // storybook-builder-rsbuild 3.6 calls `getAutomockCode(source, isSpy, babelParser)`.
  it('accepts the parse function Storybook 10 builders pass instead of a file name', () => {
    const code = 'export const a = 1;\nexport default (x);\n';

    const mocked = getAutomockCode(code, false, babelParser).toString();

    expect(mocked).toBe(getAutomockCode(code, false).toString());
    expect(mocked).toContain('["a"]: a,');
    expect(mocked).toContain('const __vitest_default = (x);');
  });

  it('mocks a .ts module with generic arrows under a Vite id with a query', () => {
    const code = 'export const identity = <T>(value: T) => value;';

    const mocked = getAutomockCode(code, false, '/src/api.ts?v=abc').toString();

    expect(mocked).toContain('["identity"]: identity,');
  });
});
