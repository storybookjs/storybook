import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { mapArgTypes as mapLegacyArgTypes } from '../../../docs/map-arg-types.ts';
import { trimmedOrUndefined } from '../utils.ts';
import type {
  ManifestAttribute,
  ManifestClassField,
  ManifestClassMember,
  ManifestDeclaration,
} from '../manifest/types.ts';
import { readTypeText } from './alt-type.ts';
import { parseTypeText } from './parse-type-text.ts';

export function mapArgTypes(
  declaration: ManifestDeclaration,
  typeProperty: string
): StrictArgTypes {
  const { events, slots, cssProperties, cssParts } = declaration;
  return {
    ...mapAttributesAndProperties(declaration, typeProperty),
    // The legacy mapper still owns events, slots, and CSS groups until the categories PR.
    ...mapLegacyArgTypes({ events, slots, cssProperties, cssParts }),
  };
}

function mapAttributesAndProperties(
  declaration: ManifestDeclaration,
  typeProperty: string
): StrictArgTypes {
  const argTypes: StrictArgTypes = {};
  const members = declaration.members ?? [];
  const attributes = declaration.attributes ?? [];
  const fields = members.filter((member) => member.kind === 'field');

  for (const field of fields.filter(isPublicField)) {
    const attribute = attributes.find((item) => item.fieldName === field.name);
    if (attribute) {
      argTypes[attribute.name] = toArgType(
        attribute.name,
        'attributes',
        field,
        field.deprecated ?? attribute.deprecated,
        typeProperty
      );
    }
    if (attribute?.name !== field.name) {
      argTypes[field.name] = toArgType(
        field.name,
        'properties',
        field,
        field.deprecated ?? attribute?.deprecated,
        typeProperty
      );
    }
  }

  for (const attribute of attributes) {
    // Attributes backed by non-public fields are dropped with their field.
    if (!attribute.fieldName || !fields.some((field) => field.name === attribute.fieldName)) {
      argTypes[attribute.name] = toArgType(
        attribute.name,
        'attributes',
        attribute,
        attribute.deprecated,
        typeProperty
      );
    }
  }

  return argTypes;
}

function toArgType(
  key: string,
  category: 'attributes' | 'properties',
  source: ManifestAttribute | ManifestClassField,
  deprecated: string | boolean | undefined,
  typeProperty: string
): StrictInputType {
  const text = readTypeText(source, typeProperty);
  const parsed =
    parseTypeText(text) ??
    (category === 'attributes'
      ? { type: { name: 'string' } as const }
      : { type: { name: 'other', value: text ?? '' } as const, control: false as const });
  const readonly = 'readonly' in source && source.readonly === true;
  return {
    name: key,
    description: trimmedOrUndefined(source.summary ?? source.description),
    ...parsed,
    ...(readonly ? { control: false } : {}),
    table: {
      category,
      type: { summary: source.type?.text },
      defaultValue: { summary: source.default },
      ...(deprecated
        ? {
            jsDocTags: {
              deprecated: typeof deprecated === 'string' ? deprecated : 'deprecated',
            },
          }
        : {}),
    },
  };
}

function isPublicField(member: ManifestClassMember): member is ManifestClassField {
  return (
    member.kind === 'field' &&
    member.privacy !== 'private' &&
    member.privacy !== 'protected' &&
    member.static !== true &&
    !member.name.startsWith('#')
  );
}
