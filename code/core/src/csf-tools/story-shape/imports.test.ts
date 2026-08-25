import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import { collectImportBindings, importedName, isTypeSpecifier } from './imports.ts';

const programPath = (code: string) => {
  return loadCsf(code, { makeTitle: (title) => title ?? 'title' })._file.path;
};

const importSpecifiers = (code: string) => {
  const declaration = programPath(code).node.body.find((node) => t.isImportDeclaration(node));

  if (!t.isImportDeclaration(declaration)) {
    throw new Error('Expected import declaration');
  }

  return declaration.specifiers;
};

describe('collectImportBindings', () => {
  it('collects value import bindings and skips type-only imports', () => {
    const bindings = collectImportBindings(
      programPath(dedent`
        import ButtonDefault from './button';
        import { Button, Icon as IconAlias, type ButtonProps } from './button';
        import * as ButtonNamespace from './namespace';
        import type { Theme } from './theme';
        import './side-effect';
      `)
    );

    expect(Object.fromEntries(bindings)).toMatchInlineSnapshot(`
      {
        "Button": {
          "importId": "./button",
          "importName": "Button",
        },
        "ButtonDefault": {
          "importId": "./button",
          "importName": "default",
        },
        "ButtonNamespace": {
          "importId": "./namespace",
          "importName": "*",
        },
        "IconAlias": {
          "importId": "./button",
          "importName": "Icon",
        },
      }
    `);
  });

  it('ignores side-effect imports with no specifiers', () => {
    expect(
      Object.fromEntries(
        collectImportBindings(
          programPath(dedent`
            import './setup';
          `)
        )
      )
    ).toEqual({});
  });
});

describe('isTypeSpecifier', () => {
  it('returns true only for inline type import specifiers', () => {
    const [typeSpecifier, valueSpecifier] = importSpecifiers(dedent`
      import { type ButtonProps, Button } from './button';
    `);

    expect(isTypeSpecifier(typeSpecifier)).toBe(true);
    expect(isTypeSpecifier(valueSpecifier)).toBe(false);
  });
});

describe('importedName', () => {
  it('returns identifier and string-literal imported names', () => {
    const [identifierSpecifier, stringSpecifier] = importSpecifiers(dedent`
      import { Button, 'a-b' as ab } from './button';
    `);

    if (!t.isImportSpecifier(identifierSpecifier) || !t.isImportSpecifier(stringSpecifier)) {
      throw new Error('Expected named import specifiers');
    }

    expect(importedName(identifierSpecifier.imported)).toBe('Button');
    expect(importedName(stringSpecifier.imported)).toBe('a-b');
  });
});
