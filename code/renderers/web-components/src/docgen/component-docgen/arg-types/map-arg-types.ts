import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { eventActionName } from './event-action-name.ts';
import { deprecationMessage, namedItems, trimmedOrUndefined } from '../utils.ts';
import type {
  ManifestAttribute,
  ManifestClassField,
  ManifestClassMethod,
  ManifestClassMember,
  ManifestCssCustomProperty,
  ManifestCssCustomState,
  ManifestCssPart,
  ManifestDeclaration,
  ManifestEvent,
  ManifestParameter,
  ManifestSlot,
} from '../manifest/types.ts';
import { readCssPropertySyntax, readTypeText } from './alt-type.ts';
import { ARG_TYPE_CATEGORIES, type ArgTypeCategory } from './categories.ts';
import { parseTypeText, type ServiceControl } from './parse-type-text.ts';

type MemberCategory = typeof ARG_TYPE_CATEGORIES.attributes | typeof ARG_TYPE_CATEGORIES.properties;
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

interface ToArgTypeOptions {
  key: string;
  category: MemberCategory;
  sources: ArgTypeSource[];
  typeProperty: string;
}

/**
 * Suffixed keys keep categories clear of attributes (the `@wc-toolkit/storybook-helpers`
 * convention); the attributes/properties spread last wins the clashes left, `on<Name>`
 * twins and bare `--x` names. The legacy runtime lets the twin win; here the declared API
 * wins on purpose. Within attributes and properties, property rows are written first and
 * attribute rows last, so the same precedence holds in every input order.
 */
export function mapArgTypes(
  declaration: ManifestDeclaration,
  typeProperty: string
): StrictArgTypes {
  const events = namedItems(declaration.events);
  const members = namedItems(declaration.members);
  const slots = namedItems(declaration.slots);
  const cssParts = namedItems(declaration.cssParts);
  const cssStates = namedItems(declaration.cssStates);
  const cssProperties = namedItems(declaration.cssProperties);

  return {
    ...Object.fromEntries([
      ...events.flatMap((event) => eventEntries(event, typeProperty)),
      ...members.filter(isMethod).filter(isPublicMember).map(methodEntry),
      ...slots.map((slot) => namedEntry(slot, 'slot', ARG_TYPE_CATEGORIES.slots)),
      ...cssParts.map((part) => namedEntry(part, 'part', ARG_TYPE_CATEGORIES.cssParts)),
      ...cssStates.map((state) => namedEntry(state, 'state', ARG_TYPE_CATEGORIES.cssStates)),
      ...cssProperties.map((property) => cssPropertyEntry(property, typeProperty)),
    ]),
    ...mapAttributesAndProperties(declaration, members, typeProperty),
  };
}

function mapAttributesAndProperties(
  declaration: ManifestDeclaration,
  members: ManifestClassMember[],
  typeProperty: string
): StrictArgTypes {
  const argTypes: StrictArgTypes = {};
  const fields = members.filter(isField);
  const publicFields = fields.filter(isPublicField);
  const attributes = namedItems(declaration.attributes);

  for (const field of publicFields) {
    if (attributes.some((attribute) => attribute.name === field.name)) {
      continue;
    }

    argTypes[field.name] = toArgType({
      key: field.name,
      category: ARG_TYPE_CATEGORIES.properties,
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
      category: ARG_TYPE_CATEGORIES.attributes,
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
    (category === ARG_TYPE_CATEGORIES.attributes
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
  const actionName = eventActionName(event.name);

  return [
    [
      `${event.name}-event`,
      memberArgType(event.name, [event], ARG_TYPE_CATEGORIES.events, {
        type: { name: 'other', value: text },
        control: false,
        table: { type: { summary: text } },
      }),
    ],
    [
      actionName,
      {
        name: actionName,
        action: { name: event.name },
        table: { disable: true },
      },
    ],
  ];
}

function methodEntry(method: ManifestClassMethod): [string, StrictInputType] {
  return [
    `${method.name}-method`,
    memberArgType(method.name, [method], ARG_TYPE_CATEGORIES.methods, {
      type: { name: 'function' },
      table: { type: { summary: methodSignature(method) } },
    }),
  ];
}

function namedEntry(
  item: ManifestSlot | ManifestCssPart | ManifestCssCustomState,
  suffix: string,
  category: ArgTypeCategory
): [string, StrictInputType] {
  const name = item.name || 'default';
  return [`${name}-${suffix}`, memberArgType(name, [item], category, { type: { name: 'string' } })];
}

function cssPropertyEntry(
  property: ManifestCssCustomProperty,
  typeProperty: string
): [string, StrictInputType] {
  const syntax = readCssPropertySyntax(property, typeProperty);

  return [
    property.name,
    memberArgType(property.name, [property], ARG_TYPE_CATEGORIES.cssProperties, {
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
  category: ArgTypeCategory,
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

function sourcesForField(
  field: ManifestClassField,
  attributes: ManifestAttribute[]
): ArgTypeSource[] {
  const attribute = attributes.find((item) => item.fieldName === field.name);
  return attribute ? [field, attribute] : [field];
}

function firstValue<TSource, TValue>(
  sources: TSource[],
  read: (source: TSource) => TValue | undefined
): TValue | undefined {
  for (const source of sources) {
    const value = read(source);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function methodSignature(method: ManifestClassMethod): string {
  const params = (method.parameters ?? []).map(formatParameter).join(', ');
  const returnType = method.return?.type?.text;
  return returnType ? `(${params}) => ${returnType}` : `(${params})`;
}

function formatParameter(parameter: ManifestParameter): string {
  const restPrefix = parameter.rest ? '...' : '';
  const optionalSuffix = parameter.optional ? '?' : '';
  const typeText = parameter.type?.text ? `: ${parameter.type.text}` : '';
  const defaultText = parameter.default !== undefined ? ` = ${parameter.default}` : '';

  return `${restPrefix}${parameter.name}${optionalSuffix}${typeText}${defaultText}`;
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

/** Public, non-static, non-private field. */
export function isPublicField(member: ManifestClassMember): member is ManifestClassField {
  return isField(member) && isPublicMember(member);
}

function isPublicMember(member: ManifestClassMember): boolean {
  return (
    member.privacy !== 'private' &&
    member.privacy !== 'protected' &&
    member.static !== true &&
    !member.name.startsWith('#')
  );
}

function isField(member: ManifestClassMember): member is ManifestClassField {
  return member.kind === 'field';
}

function isMethod(member: ManifestClassMember): member is ManifestClassMethod {
  return member.kind === 'method';
}
