import { describe, expect, it } from 'vitest';

import { convertCommonJsNamespaceDeclaration } from './generate-types-rolldown.ts';

describe('convertCommonJsNamespaceDeclaration', () => {
  it('exports the namespace by default and each of its types by name', () => {
    const code = [
      "import {type ARIARole} from 'aria-query'",
      '',
      'declare namespace matchers {',
      '  interface DomQueryFunction {',
      '    (container: HTMLElement): HTMLElement[]',
      '  }',
      '  type Role = ARIARole',
      '  interface TestingLibraryMatchers<E, R extends void = void> {',
      '    toBeInTheDocument(): R',
      '  }',
      '}',
      '',
      'declare const matchers: matchers.TestingLibraryMatchers<any, void>',
      'export = matchers',
      '',
    ].join('\n');

    expect(convertCommonJsNamespaceDeclaration('matchers.d.ts', code)).toMatchInlineSnapshot(`
      "import {type ARIARole} from 'aria-query'

      declare namespace matchers {
        interface DomQueryFunction {
          (container: HTMLElement): HTMLElement[]
        }
        type Role = ARIARole
        interface TestingLibraryMatchers<E, R extends void = void> {
          toBeInTheDocument(): R
        }
      }

      declare const matchers: matchers.TestingLibraryMatchers<any, void>

      export { matchers as default };
      export type DomQueryFunction = matchers.DomQueryFunction;
      export type Role = matchers.Role;
      export type TestingLibraryMatchers<E, R extends void = void> = matchers.TestingLibraryMatchers<E, R>;

      "
    `);
  });

  it('keeps declarations of any other shape', () => {
    expect(convertCommonJsNamespaceDeclaration('a.d.ts', 'export declare const a: 1;')).toBeNull();
    expect(
      convertCommonJsNamespaceDeclaration('b.d.ts', 'declare const b: 1;\nexport = b;')
    ).toBeNull();
  });
});
