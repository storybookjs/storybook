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
});
