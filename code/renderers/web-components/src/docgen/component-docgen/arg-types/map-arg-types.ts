import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { deprecationMessage, firstValue, trimmedOrUndefined } from '../utils.ts';
import { classifyDeclaration, type DeclarationApi } from '../manifest/declaration-api.ts';
import type {
  ManifestAttribute,
  ManifestClassField,
  ManifestClassMethod,
  ManifestCssCustomProperty,
  ManifestCssCustomState,
  ManifestCssPart,
  ManifestDeclaration,
  ManifestEvent,
  ManifestSlot,
} from '../manifest/types.ts';
import { formatParameters } from '../manifest/members.ts';
import { readCssPropertySyntax, readTypeText } from './alt-type.ts';
import { DEFAULT_SLOT_NAME, toArgKey } from '../../../arg-keys.ts';
import { parseTypeText, type ServiceControl } from './parse-type-text.ts';

type ArgTypeCategory = 'attributes' | 'properties';
type TableCategory =
  | ArgTypeCategory
  | 'events'
  | 'methods'
  | 'slots'
  | 'css custom properties'
  | 'css shadow parts'
  | 'css states';
type ArgTypeSource = ManifestAttribute | ManifestClassField;
type DocSource = {
  summary?: string;
  description?: string;
  deprecated?: string | boolean;
};
type ArgTypeFields = Omit<StrictInputType, 'name' | 'description' | 'table' | 'control'> & {
  control?: ServiceControl;
  table?: Omit<NonNullable<StrictInputType['table']>, 'category' | 'jsDocTags'>;
};

const NAMED_ENTRY_CATEGORIES: Record<'slots' | 'cssParts' | 'cssStates', TableCategory> = {
  slots: 'slots',
  cssParts: 'css shadow parts',
  cssStates: 'css states',
};

interface ToArgTypeOptions {
  key: string;
  category: ArgTypeCategory;
  sources: ArgTypeSource[];
  typeProperty: string;
}

/**
 * Suffixed keys keep categories clear of attributes (the `@wc-toolkit/storybook-helpers`
 * convention); the attributes/properties spread last wins the clashes left and bare `--x`
 * names. Within attributes and properties, property rows are written first and
 * attribute rows last, so the same precedence holds in every input order.
 */
export function mapArgTypes(
  declaration: ManifestDeclaration,
  typeProperty: string
): StrictArgTypes {
  const api = classifyDeclaration(declaration);

  return {
    ...Object.fromEntries([
      ...api.events.flatMap((event) => eventEntries(event, typeProperty)),
      ...api.methods.map(methodEntry),
      ...api.slots.map((slot) => namedEntry(slot, 'slots')),
      ...api.cssParts.map((part) => namedEntry(part, 'cssParts')),
      ...api.cssStates.map((state) => namedEntry(state, 'cssStates')),
      ...api.cssProperties.map((property) => cssPropertyEntry(property, typeProperty)),
    ]),
    ...mapAttributesAndProperties(api, typeProperty),
  };
}

function mapAttributesAndProperties(api: DeclarationApi, typeProperty: string): StrictArgTypes {
  const argTypes: StrictArgTypes = {};
  const properties = api.fields.filter(
    (field) => !api.attributes.some(({ attribute }) => attribute.name === field.name)
  );

  for (const field of properties) {
    const attribute = api.attributes.find(({ field: backingField }) => backingField === field);
    argTypes[field.name] = toArgType({
      key: field.name,
      category: 'properties',
      sources: attribute ? [field, attribute.attribute] : [field],
      typeProperty,
    });
  }

  for (const { attribute, field } of api.attributes) {
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

  return memberArgType(key, sources, category, {
    ...parsed,
    ...(readonly ? { control: false } : {}),
    table: {
      type: { summary: rawTypeText },
      defaultValue: { summary: firstValue(sources, (source) => source.default) },
    },
  });
}

function eventEntries(
  event: ManifestEvent,
  typeProperty: string
): Array<[string, StrictInputType]> {
  const text = readTypeText(event, typeProperty) ?? 'CustomEvent';

  return [
    [
      toArgKey('events', event.name),
      memberArgType(event.name, [event], 'events', {
        type: { name: 'other', value: text },
        control: false,
        table: { type: { summary: text } },
      }),
    ],
  ];
}

function methodEntry(method: ManifestClassMethod): [string, StrictInputType] {
  return [
    toArgKey('methods', method.name),
    memberArgType(method.name, [method], 'methods', {
      type: { name: 'function' },
      table: { type: { summary: methodSignature(method) } },
    }),
  ];
}

function namedEntry(
  item: ManifestSlot | ManifestCssPart | ManifestCssCustomState,
  category: 'slots' | 'cssParts' | 'cssStates'
): [string, StrictInputType] {
  const name = item.name || DEFAULT_SLOT_NAME;
  return [
    toArgKey(category, name),
    memberArgType(name, [item], NAMED_ENTRY_CATEGORIES[category], { type: { name: 'string' } }),
  ];
}

function cssPropertyEntry(
  property: ManifestCssCustomProperty,
  typeProperty: string
): [string, StrictInputType] {
  const syntax = readCssPropertySyntax(property, typeProperty);

  return [
    toArgKey('cssProperties', property.name),
    memberArgType(property.name, [property], 'css custom properties', {
      ...cssCustomPropertyControl(syntax),
      table: {
        type: { summary: syntax },
        defaultValue: { summary: property.default },
      },
    }),
  ];
}

function memberArgType(
  name: string,
  sources: DocSource[],
  category: TableCategory,
  rest: ArgTypeFields
): StrictInputType {
  const { table, ...input } = rest;
  const { deprecated, ...fields } = docFields(sources);

  return {
    name,
    ...fields,
    ...input,
    table: {
      ...table,
      category,
      ...(deprecated ? { jsDocTags: { deprecated } } : {}),
    },
  };
}

function docFields(sources: DocSource[]): { description?: string; deprecated?: string } {
  return {
    description: firstValue(sources, (source) =>
      trimmedOrUndefined(source.summary ?? source.description)
    ),
    deprecated: firstValue(sources, (source) => deprecationMessage(source.deprecated)),
  };
}

function methodSignature(method: ManifestClassMethod): string {
  const params = formatParameters(method);
  const returnType = method.return?.type?.text;
  return returnType ? `(${params}) => ${returnType}` : `(${params})`;
}

function cssCustomPropertyControl(
  syntax: string | undefined
): Pick<ArgTypeFields, 'control' | 'type'> {
  const lowerSyntax = syntax?.toLowerCase();

  if (lowerSyntax === '<color>') {
    return { type: { name: 'string' }, control: { type: 'color' } };
  }
  if (lowerSyntax === '<number>' || lowerSyntax === '<integer>') {
    return { type: { name: 'number' } };
  }
  return { type: { name: 'string' } };
}
