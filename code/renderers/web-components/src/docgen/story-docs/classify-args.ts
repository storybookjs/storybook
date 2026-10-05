import type { StrictArgTypes } from 'storybook/internal/types';

import type {
  ManifestAttribute,
  ManifestClassField,
  ManifestDeclaration,
} from '../component-docgen/manifest/types.ts';

export type ArgBinding =
  | { kind: 'attribute'; name: string; viaField: boolean; defaultValue?: string }
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
      return attributeBinding(
        name,
        attributeViaField(key, name, declaration),
        attributeDefault(key, name, declaration)
      );
    case 'properties': {
      const attribute = pairedAttribute(name, declaration);
      return attribute
        ? attributeBinding(
            attribute,
            true,
            fieldDefault(name, declaration) ?? attributeDefault(name, attribute, declaration)
          )
        : { kind: 'property', name };
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
  const field = fieldDeclaration(fieldName, declaration);
  if (field?.attribute) {
    return field.attribute;
  }
  return declaration.attributes?.find((attribute) => attribute.fieldName === fieldName)?.name;
};

const attributeBinding = (
  name: string,
  viaField: boolean,
  defaultValue: string | undefined
): Extract<ArgBinding, { kind: 'attribute' }> => ({
  kind: 'attribute',
  name,
  viaField,
  ...(defaultValue === undefined ? {} : { defaultValue }),
});

const fieldDeclaration = (
  fieldName: string,
  declaration: ManifestDeclaration
): ManifestClassField | undefined =>
  declaration.members?.find(
    (member): member is ManifestClassField => member.kind === 'field' && member.name === fieldName
  );

const attributeDeclaration = (
  attributeName: string,
  declaration: ManifestDeclaration
): ManifestAttribute | undefined =>
  declaration.attributes?.find((attribute) => attribute.name === attributeName);

const attributeViaField = (
  key: string,
  attributeName: string,
  declaration: ManifestDeclaration
): boolean => pairedAttribute(key, declaration) === attributeName;

const fieldDefault = (fieldName: string, declaration: ManifestDeclaration): string | undefined =>
  fieldDeclaration(fieldName, declaration)?.default;

const attributeDefault = (
  key: string,
  attributeName: string,
  declaration: ManifestDeclaration
): string | undefined => {
  const attribute = attributeDeclaration(attributeName, declaration);
  const fieldName =
    attribute?.fieldName === key || pairedAttribute(key, declaration) === attributeName
      ? key
      : undefined;
  return (fieldName ? fieldDefault(fieldName, declaration) : undefined) ?? attribute?.default;
};
