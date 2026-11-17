import { HandledError } from 'storybook/internal/common';
import {
  type ConfigFile,
  type ESTree as E,
  printCsfPath,
  resolveExpression,
  staticKey,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import { editParsedFile, readForEdit } from '../helpers/edit-parsed-file.ts';
import type { Fix } from '../types.ts';

const isLiteralData = (node: E.Expression): boolean => {
  const value = unwrapExpression(node);
  switch (value.type) {
    case 'Literal':
      return value.value === null || ['string', 'number', 'boolean'].includes(typeof value.value);
    case 'UnaryExpression': {
      const argument = unwrapExpression(value.argument);
      return (
        value.operator === '-' && argument.type === 'Literal' && typeof argument.value === 'number'
      );
    }
    case 'ArrayExpression':
      return value.elements.every(
        (element) =>
          element === null || (element.type !== 'SpreadElement' && isLiteralData(element))
      );
    case 'ObjectExpression':
      return value.properties.every(
        (property) =>
          property.type === 'Property' &&
          property.kind === 'init' &&
          !property.method &&
          !property.computed &&
          staticKey(property) !== undefined &&
          isLiteralData(property.value)
      );
    default:
      return false;
  }
};

const getObjectProperties = (
  object: ConfigFile,
  node: E.Expression,
  visited = new Set<E.ObjectExpression>()
): E.ObjectProperty[] => {
  const value = resolveExpression(object.editor.scopes, node, 'read');
  if (value?.type !== 'ObjectExpression' || visited.has(value)) {
    return [];
  }
  visited.add(value);
  return value.properties.flatMap((property) =>
    property.type === 'SpreadElement'
      ? getObjectProperties(object, property.argument, visited)
      : [property]
  );
};

const migrate = (object: ConfigFile) => {
  const globalTypes = unwrapExpression(object.getFieldNode(['globalTypes']));
  if (globalTypes?.type !== 'ObjectExpression') {
    return;
  }
  const globalTypesInspection = object.inspect(['globalTypes']);
  const mayHaveDefaults = getObjectProperties(object, globalTypes).some((property) => {
    const globalName = staticKey(property);
    if (
      globalName !== undefined &&
      globalTypesInspection.kind === 'value' &&
      object.inspect(['globalTypes', globalName, 'defaultValue']).kind === 'missing'
    ) {
      return false;
    }
    return getObjectProperties(object, property.value).some((member) => {
      const name = staticKey(member);
      if (name !== undefined) {
        return name === 'defaultValue';
      }
      if (!member.computed) {
        return false;
      }
      const key = resolveExpression(object.editor.scopes, member.key, 'read');
      if (key?.type === 'TemplateLiteral' && key.expressions.length === 0) {
        return staticKey({ ...member, key }) === 'defaultValue';
      }
      return key?.type !== 'Literal' || key.value === 'defaultValue';
    });
  });
  if (!mayHaveDefaults) {
    return;
  }
  if (!readForEdit(object, ['globalTypes'])) {
    throw new HandledError('Cannot migrate named globalTypes alongside a default export.');
  }

  for (const property of globalTypes.properties) {
    const name = staticKey(property);
    if (name === undefined) {
      throw new HandledError('Cannot migrate globalTypes with spreads or dynamic keys.');
    }
    const legacyPath = ['globalTypes', name, 'defaultValue'];
    const initialPath = ['initialGlobals', name];
    const defaultValue = readForEdit(object, legacyPath);
    if (!defaultValue) {
      continue;
    }
    if (!isLiteralData(defaultValue)) {
      throw new HandledError(`Cannot migrate ${printCsfPath(legacyPath)} automatically.`);
    }
    if (readForEdit(object, initialPath)) {
      object.remove(legacyPath);
    } else {
      object.move(legacyPath, initialPath);
    }
  }
};

export const globaltypesDefaultValue: Fix = {
  id: 'globaltypes-default-value',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#toolbar-globaltypes-entries-index-signature-and-defaultvalue-removed',
  prompt: () =>
    `Move ${picocolors.cyan('globalTypes')} default values to ${picocolors.cyan('initialGlobals')}`,
  transform: () => [
    {
      filter: { kind: ['preview'] },
      editConfig: (config) => editParsedFile(config, migrate, 'Set initialGlobals manually.'),
    },
  ],
};
