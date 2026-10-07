import { types as t } from 'storybook/internal/babel';
import type { CsfObject } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const argName = (property: t.ObjectProperty): string | undefined => {
  if (t.isIdentifier(property.key) && !property.computed) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  return undefined;
};

const strip = (object: CsfObject, program: t.Program) => {
  const argTypes = object.get(['argTypes']);
  if (t.isIdentifier(argTypes)) {
    let sharedArgTypes = program.body
      .flatMap((statement) =>
        t.isVariableDeclaration(statement)
          ? statement.declarations
          : t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)
            ? statement.declaration.declarations
            : []
      )
      .find((declaration) => t.isIdentifier(declaration.id, { name: argTypes.name }))?.init;
    while (t.isTSAsExpression(sharedArgTypes) || t.isTSSatisfiesExpression(sharedArgTypes)) {
      sharedArgTypes = sharedArgTypes.expression;
    }
    if (
      t.isObjectExpression(sharedArgTypes) &&
      sharedArgTypes.properties.some(
        (property) =>
          t.isObjectProperty(property) &&
          t.isObjectExpression(property.value) &&
          property.value.properties.some(
            (field) => t.isObjectProperty(field) && argName(field) === 'defaultValue'
          )
      )
    ) {
      throw new Error('Shared argTypes contain defaultValue and need manual migration');
    }
  }
  if (!t.isObjectExpression(argTypes)) {
    return;
  }
  for (const property of argTypes.properties) {
    if (!t.isObjectProperty(property)) {
      continue;
    }
    const name = argName(property);
    if (name) {
      object.remove(['argTypes', name, 'defaultValue']);
    }
  }
};

export const argtypesDefaultValue: Fix = {
  id: 'argtypes-default-value',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#argtypes-defaultvalue-removed',

  prompt() {
    return `Remove deprecated ${picocolors.cyan('argTypes.<name>.defaultValue')}? It no longer sets an arg. Use ${picocolors.cyan('args')} or ${picocolors.cyan('table.defaultValue')}.`;
  },

  transform: () => [
    {
      filter: { kind: ['preview', 'story'], code: 'defaultValue' },
      editConfig: (config) => strip(config, config._ast.program),
      editCsf: (csf) => {
        csf.objects().forEach((object) => strip(object, csf._ast.program));
      },
    },
  ],
};
