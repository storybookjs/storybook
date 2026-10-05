import type { StrictArgTypes } from 'storybook/internal/types';

import type {
  ManifestClassField,
  ManifestDeclaration,
} from '../component-docgen/manifest/types.ts';

export type ArgBinding =
  | { kind: 'attribute'; name: string }
  | { kind: 'property'; name: string }
  | { kind: 'cssProperty'; name: string }
  | { kind: 'slot'; name: string }
  | { kind: 'cssPart'; name: string }
  | { kind: 'cssState'; name: string }
  | { kind: 'listener' }
  | { kind: 'method' }
  | { kind: 'unknown' };

export function classifyArg(
  key: string,
  isFunction: boolean,
  argTypes: StrictArgTypes,
  declaration: ManifestDeclaration
): ArgBinding {
  if (isFunction) {
    return { kind: 'listener' };
  }

  const row = argTypes[key];
  if (!row) {
    return { kind: 'unknown' };
  }
  if (row.action) {
    return { kind: 'listener' };
  }

  const name = row.name ?? key;
  switch (row.table?.category) {
    case 'attributes':
      return { kind: 'attribute', name };
    case 'properties': {
      const attribute = pairedAttribute(name, declaration);
      return attribute ? { kind: 'attribute', name: attribute } : { kind: 'property', name };
    }
    case 'events':
      return { kind: 'listener' };
    case 'methods':
      return { kind: 'method' };
    case 'slots':
      return { kind: 'slot', name };
    case 'css shadow parts':
      return { kind: 'cssPart', name };
    case 'css states':
      return { kind: 'cssState', name };
    case 'css custom properties':
      return { kind: 'cssProperty', name };
    default:
      return { kind: 'unknown' };
  }
}

const pairedAttribute = (
  fieldName: string,
  declaration: ManifestDeclaration
): string | undefined => {
  const field = declaration.members?.find(
    (member): member is ManifestClassField => member.kind === 'field' && member.name === fieldName
  );
  if (field?.attribute) {
    return field.attribute;
  }
  return declaration.attributes?.find((attribute) => attribute.fieldName === fieldName)?.name;
};
