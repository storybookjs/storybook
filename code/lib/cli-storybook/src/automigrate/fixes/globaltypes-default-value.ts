import { HandledError } from 'storybook/internal/common';
import {
  type ConfigFile,
  type CsfKeys,
  type ESTree as E,
  printCsfPath,
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

const mayHaveDefaultValue = (globalType: CsfKeys | undefined) =>
  globalType !== undefined &&
  (globalType.keys.includes('defaultValue') || globalType.computed.length > 0);

const migrate = (preview: ConfigFile) => {
  const globalTypes = preview.getKeys(['globalTypes']);
  if (!globalTypes) {
    return;
  }
  const candidateNames = new Set(
    globalTypes.keys.filter((name) => mayHaveDefaultValue(preview.getKeys(['globalTypes', name])))
  );
  if (candidateNames.size === 0 && !globalTypes.computed.some(mayHaveDefaultValue)) {
    return;
  }

  // A global the file does not fully show may hold a default, so read every named global.
  for (const name of globalTypes.keys) {
    const legacyPath = ['globalTypes', name, 'defaultValue'];
    const initialPath = ['initialGlobals', name];
    const defaultValue = readForEdit(preview, legacyPath);
    // With mixed exports, skipping a default found by getKeys would hide the error.
    if (!defaultValue && !candidateNames.has(name)) {
      continue;
    }
    if (defaultValue && !isLiteralData(defaultValue)) {
      throw new HandledError(`Cannot migrate ${printCsfPath(legacyPath)} automatically.`);
    }
    const hasInitialValue = readForEdit(preview, initialPath) !== undefined;
    const result = hasInitialValue
      ? preview.remove(legacyPath)
      : preview.move(legacyPath, initialPath);
    if (result.ok && !result.changed) {
      throw new HandledError(`Cannot migrate ${printCsfPath(legacyPath)} automatically.`);
    }
  }
  // A spread or dynamic key the file does not show may still hide or override a default. Check it
  // after the fields, so a field's own error points at that field first.
  if (globalTypes.external || globalTypes.computed.length > 0) {
    throw new HandledError('Cannot migrate globalTypes with spreads or dynamic keys.');
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
