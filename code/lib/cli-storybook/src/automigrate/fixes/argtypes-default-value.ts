import { types as t } from 'storybook/internal/babel';
import { HandledError } from 'storybook/internal/common';
import type { CsfFile, CsfObject } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const MANUAL =
  'Could not remove argTypes.<name>.defaultValue safely. Delete that property yourself. Set args.<name> for the value the story starts with, or table.defaultValue for the text in the docs table. Leave an existing table.defaultValue or globalTypes.defaultValue unchanged. If this file only uses those, you can ignore this report.';

type Editable = Pick<CsfObject, 'get' | 'remove'>;
type Diagnostics = { mutationDiagnostics: readonly unknown[] };

const propertyName = (property: t.ObjectProperty | t.ObjectMethod): string | undefined => {
  if (property.computed && !t.isStringLiteral(property.key)) {
    return undefined;
  }
  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  return undefined;
};

const hasDirectDefault = (expression: t.ObjectExpression) =>
  expression.properties.some(
    (property) => t.isObjectProperty(property) && propertyName(property) === 'defaultValue'
  );

const isUnsafeObject = (expression: t.ObjectExpression) =>
  expression.properties.some(
    (property) => !t.isObjectProperty(property) || propertyName(property) === undefined
  );

const strip = (object: Editable, file: Diagnostics) => {
  const start = file.mutationDiagnostics.length;
  const failed = () => file.mutationDiagnostics.length > start;
  const argTypes = object.get(['argTypes']);
  if (failed()) {
    throw new HandledError(MANUAL);
  }
  if (!argTypes) {
    return;
  }
  if (!t.isObjectExpression(argTypes) || isUnsafeObject(argTypes)) {
    throw new HandledError(MANUAL);
  }

  const names: string[] = [];
  for (const property of argTypes.properties) {
    if (!t.isObjectProperty(property)) {
      throw new HandledError(MANUAL);
    }
    const name = propertyName(property);
    if (!name) {
      throw new HandledError(MANUAL);
    }
    const entry = t.isObjectExpression(property.value)
      ? property.value
      : object.get(['argTypes', name]);
    if (failed()) {
      throw new HandledError(MANUAL);
    }
    if (!entry || !t.isObjectExpression(entry)) {
      continue;
    }
    if (isUnsafeObject(entry)) {
      throw new HandledError(MANUAL);
    }
    if (hasDirectDefault(entry)) {
      names.push(name);
    }
  }

  for (const name of names) {
    const removed = object.remove(['argTypes', name, 'defaultValue']);
    if (!removed.ok || failed()) {
      throw new HandledError(MANUAL);
    }
  }
};

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

export const argtypesDefaultValue: Fix = {
  id: 'argtypes-default-value',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#argtypes-defaultvalue-removed',

  prompt() {
    return `Remove deprecated ${picocolors.cyan('argTypes.<name>.defaultValue')}? It no longer sets an arg. Use ${picocolors.cyan('args')} or ${picocolors.cyan('table.defaultValue')}.`;
  },

  transform: () => [
    {
      filter: { kind: ['preview', 'story'], code: 'defaultValue' },
      editConfig: (config) => strip(config, config),
      editCsf: (csf: CsfFile) => {
        csf.objects().forEach((object) => strip(object, csf));
      },
    },
    {
      filter: { kind: ['story'], code: 'defaultValue' },
      handler: (code, context) => {
        if (SCRIPT_FILE.test(context.id) || !code.includes('argTypes')) {
          return;
        }
        throw new HandledError(MANUAL);
      },
    },
  ],
};
