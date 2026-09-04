import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { babelParse } from './babelParse.ts';

describe('babelParse', () => {
  it('parses TypeScript sources', () => {
    const ast = babelParse(dedent`
      type Props = { label: string };
      export const a = { label: 'hi' } satisfies Props;
    `);
    expect(ast.program.body).toHaveLength(2);
  });

  it('parses legacy Flow sources', () => {
    const ast = babelParse(dedent`
      // @flow
      type Props = { +label: string };
      export const a: Props = { label: 'hi' };
    `);
    expect(ast.program.body).toHaveLength(2);
  });

  describe('modern Flow syntax', () => {
    it.each([
      ['readonly variance', `type P = { readonly a: string };`],
      ['writeonly variance', `type P = { writeonly a: string };`],
      ['as cast', `const x = window.foo as string;`],
      ['component syntax', `export default component Foo(bar: string) { return null; }`],
      ['conditional types', `type T<X> = X extends string ? number : boolean;`],
      ['mapped types', `type O<B> = {[key in keyof B]: number};`],
    ])('parses %s', (_name, source) => {
      expect(() => babelParse(`// @flow\n${source}`)).not.toThrow();
    });

    it('still parses TypeScript sources without a pragma', () => {
      expect(() => babelParse(`type P = { readonly a: string };`)).not.toThrow();
      expect(() => babelParse(`const x: unknown = null;`)).not.toThrow();
    });
  });
});
