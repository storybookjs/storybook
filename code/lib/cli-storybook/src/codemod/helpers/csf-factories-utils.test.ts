import { describe, expect, it } from 'vitest';

import { SourceEditor } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import {
  cleanupTypeImports,
  type ExportDeclarations,
  getConfigProperties,
  removeExportDeclarations,
} from './csf-factories-utils.ts';

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

const edit = (code: string, change: (editor: SourceEditor) => void) => {
  const editor = new SourceEditor(dedent(code));
  change(editor);
  return editor.toString();
};

const exportedDeclarations = (editor: SourceEditor, names: string[]): ExportDeclarations =>
  Object.fromEntries(
    editor.program.body.flatMap((node) => {
      if (node.type !== 'ExportNamedDeclaration' || !node.declaration) {
        return [];
      }
      const { declaration } = node;
      const decls =
        declaration.type === 'VariableDeclaration'
          ? declaration.declarations
          : declaration.type === 'FunctionDeclaration'
            ? [declaration]
            : [];
      return decls.flatMap((decl) =>
        decl.id?.type === 'Identifier' && names.includes(decl.id.name) ? [[decl.id.name, decl]] : []
      );
    })
  );

describe('cleanupTypeImports', () => {
  it('removes disallowed imports from @storybook/*', () => {
    const code = `
      import { Story, SomethingElse } from '@storybook/react';
      import { Other } from 'some-other-package';
    `;

    expect(edit(code, (editor) => cleanupTypeImports(editor, ['Story']))).toMatchInlineSnapshot(`
      import { SomethingElse } from '@storybook/react';
      import { Other } from 'some-other-package';
    `);
  });

  it('removes entire import if all specifiers are removed', () => {
    const code = `
      import { Story, Meta } from '@storybook/react';
    `;

    expect(
      edit(code, (editor) => cleanupTypeImports(editor, ['Story', 'Meta']))
    ).toMatchInlineSnapshot(``);
  });

  it('retains non storybook imports', () => {
    const code = `
      import { Preview } from 'internal-types';
    `;

    expect(edit(code, (editor) => cleanupTypeImports(editor, ['Preview']))).toMatchInlineSnapshot(
      `import { Preview } from 'internal-types';`
    );
  });

  it('retains namespace imports', () => {
    const code = `
      import * as Storybook from '@storybook/react';
    `;

    expect(edit(code, (editor) => cleanupTypeImports(editor, ['Preview']))).toMatchInlineSnapshot(
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

    const result = edit(code, (editor) =>
      cleanupTypeImports(editor, ['Type1', 'Type2', 'Type3', 'Type4', 'ShouldBeRemoved'])
    );

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

    expect(
      edit(code, (editor) =>
        removeExportDeclarations(editor, exportedDeclarations(editor, ['foo', 'baz']))
      )
    ).toMatchInlineSnapshot(`export const bar = 'bar';`);
  });

  it('removes specified function export declarations', () => {
    const code = `
      export function foo() { return 'foo'; }
      export function bar() { return 'bar'; }
    `;

    expect(
      edit(code, (editor) =>
        removeExportDeclarations(editor, exportedDeclarations(editor, ['foo']))
      )
    ).toMatchInlineSnapshot(`export function bar() { return 'bar'; }`);
  });

  it('retains exports not in the disallow list', () => {
    const code = `
      export const foo = 'foo';
      export const bar = 'bar';
    `;

    expect(
      edit(code, (editor) =>
        removeExportDeclarations(editor, exportedDeclarations(editor, ['nonExistent']))
      )
    ).toMatchInlineSnapshot(`
      export const foo = 'foo';
      export const bar = 'bar';
    `);
  });
});

describe('getConfigProperties', () => {
  it('returns object properties from variable declarations', () => {
    const editor = new SourceEditor(`export const foo = 'fooValue';\nexport const bar = 42;`);

    expect(
      getConfigProperties(editor, exportedDeclarations(editor, ['foo', 'bar']), {
        configType: 'main',
      })
    ).toEqual(["foo: 'fooValue'", 'bar: 42']);
  });

  it('returns object properties from function declarations', () => {
    const editor = new SourceEditor(`export function foo() {}`);

    expect(
      getConfigProperties(editor, exportedDeclarations(editor, ['foo']), { configType: 'main' })
    ).toEqual(['foo: () => {}']);
  });
});
