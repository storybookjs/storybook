import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { mapArgTypes as mapLegacyArgTypes } from '../../../docs/map-arg-types.ts';
import { namedItems, trimmedOrUndefined } from '../utils.ts';
import type {
  ManifestAttribute,
  ManifestClassField,
  ManifestClassMember,
  ManifestDeclaration,
} from '../manifest/types.ts';
import { readTypeText } from './alt-type.ts';
import { parseTypeText } from './parse-type-text.ts';

type ArgTypeCategory = 'attributes' | 'properties';
type ArgTypeSource = ManifestAttribute | ManifestClassField;

interface ToArgTypeOptions {
  key: string;
  category: ArgTypeCategory;
  sources: ArgTypeSource[];
  typeProperty: string;
}

export function mapArgTypes(
  declaration: ManifestDeclaration,
  typeProperty: string
): StrictArgTypes {
  const events = namedItems(declaration.events);
  const slots = namedItems(declaration.slots);
  const cssProperties = namedItems(declaration.cssProperties);
  const cssParts = namedItems(declaration.cssParts);
  return {
    // Legacy owns events, slots, and CSS until categories land; attributes win collisions.
    ...mapLegacyArgTypes({ events, slots, cssProperties, cssParts }),
    ...mapAttributesAndProperties(declaration, typeProperty),
  };
}

function mapAttributesAndProperties(
  declaration: ManifestDeclaration,
  typeProperty: string
): StrictArgTypes {
  const argTypes: StrictArgTypes = {};
  const fields = collectFields(namedItems<ManifestClassMember>(declaration.members));
  const publicFields = fields.filter(isPublicField);
  const attributes = namedItems<ManifestAttribute>(declaration.attributes);

  for (const field of publicFields) {
    if (attributes.some((attribute) => attribute.name === field.name)) {
      continue;
    }

    argTypes[field.name] = toArgType({
      key: field.name,
      category: 'properties',
      sources: sourcesForField(field, attributes),
      typeProperty,
    });
  }

  for (const attribute of attributes) {
    // Attributes backed by non-public fields are dropped with their field.
    const field =
      attribute.fieldName === undefined
        ? undefined
        : fields.find((item) => item.name === attribute.fieldName);
    if (field && !isPublicField(field)) {
      continue;
    }

    argTypes[attribute.name] = toArgType({
      key: attribute.name,
      category: 'attributes',
      sources: field ? [field, attribute] : [attribute],
      typeProperty,
    });
  }

  return argTypes;
}

function toArgType({ key, category, sources, typeProperty }: ToArgTypeOptions): StrictInputType {
  const rawTypeText = firstValue(sources, (source) =>
    typeof source.type?.text === 'string' ? source.type.text : undefined
  );
  const text = firstValue(sources, (source) =>
    trimmedOrUndefined(readTypeText(source, typeProperty))
  );
  const parsed =
    parseTypeText(text) ??
    (category === 'attributes'
      ? { type: { name: 'string' } as const }
      : { type: { name: 'other', value: text ?? '' } as const, control: false as const });
  const readonly = firstValue(sources, (source) =>
    'readonly' in source && source.readonly === true ? true : undefined
  );
  const deprecated = findDeprecated(sources);
  return {
    name: key,
    description: firstValue(sources, (source) =>
      trimmedOrUndefined(source.summary ?? source.description)
    ),
    ...parsed,
    ...(readonly ? { control: false } : {}),
    table: {
      category,
      type: { summary: rawTypeText },
      defaultValue: { summary: firstValue(sources, (source) => source.default) },
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

function collectFields(members: ManifestClassMember[]): ManifestClassField[] {
  const fields = new Map<string, ManifestClassField>();
  for (const member of members) {
    if (member.kind !== 'field') {
      continue;
    }

    const existing = fields.get(member.name);
    if (!existing || (existing.inheritedFrom && !member.inheritedFrom)) {
      fields.set(member.name, member);
    }
  }
  return [...fields.values()];
}

function sourcesForField(
  field: ManifestClassField,
  attributes: ManifestAttribute[]
): ArgTypeSource[] {
  const attribute = attributes.find((item) => item.fieldName === field.name);
  return attribute ? [field, attribute] : [field];
}

function firstValue<T>(
  sources: ArgTypeSource[],
  read: (source: ArgTypeSource) => T | undefined
): T | undefined {
  for (const source of sources) {
    const value = read(source);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function findDeprecated(sources: ArgTypeSource[]): string | boolean | undefined {
  return firstValue(sources, (source) => {
    const { deprecated } = source;
    if (deprecated === true) {
      return deprecated;
    }
    if (typeof deprecated === 'string' && deprecated.trim()) {
      return deprecated;
    }
    return undefined;
  });
}

/** Public, non-static, non-private field. */
export function isPublicField(member: ManifestClassMember): member is ManifestClassField {
  return (
    member.kind === 'field' &&
    member.privacy !== 'private' &&
    member.privacy !== 'protected' &&
    member.static !== true &&
    !member.name.startsWith('#')
  );
}
