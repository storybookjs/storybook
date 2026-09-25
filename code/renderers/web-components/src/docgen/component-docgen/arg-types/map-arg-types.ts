import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { eventActionName } from '../../../docs/event-action-name.ts';
import { deprecationMessage, namedItems, trimmedOrUndefined } from '../utils.ts';
import type {
  ManifestAttribute,
  ManifestClassField,
  ManifestClassMethod,
  ManifestClassMember,
  ManifestCssCustomProperty,
  ManifestDeclaration,
  ManifestEvent,
  ManifestParameter,
} from '../manifest/types.ts';
import { readTypeText } from './alt-type.ts';
import { parseTypeText } from './parse-type-text.ts';

type ArgTypeCategory = 'attributes' | 'properties';
type ArgTypeSource = ManifestAttribute | ManifestClassField;
type CssCustomPropertyWithType = ManifestCssCustomProperty & { type?: { text?: string } };
type MemberItem = {
  name: string;
  summary?: string;
  description?: string;
  deprecated?: ManifestAttribute['deprecated'];
};
type MemberArgTypeRest = Omit<StrictInputType, 'name' | 'description' | 'table' | 'control'> & {
  control?: Exclude<StrictInputType['control'], string>;
  table?: Omit<NonNullable<StrictInputType['table']>, 'category' | 'jsDocTags'>;
};

interface ToArgTypeOptions {
  key: string;
  category: ArgTypeCategory;
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
  const events = namedItems<ManifestEvent>(declaration.events);
  const members = namedItems<ManifestClassMember>(declaration.members);
  const slots = namedItems<{ name: string; summary?: string; description?: string }>(
    declaration.slots
  );
  const cssParts = namedItems<{ name: string; summary?: string; description?: string }>(
    declaration.cssParts
  );
  const cssStates = namedItems<{ name: string; summary?: string; description?: string }>(
    declaration.cssStates
  );
  const cssProperties = namedItems<CssCustomPropertyWithType>(declaration.cssProperties);

  return {
    ...Object.fromEntries([
      ...events.flatMap((event) => eventEntries(event, typeProperty)),
      ...members.filter(isMethod).filter(isPublicMember).map(methodEntry),
      ...slots.map((slot) =>
        namedEntry({ ...slot, name: slot.name || 'default' }, 'slot', 'slots')
      ),
      ...cssParts.map((part) => namedEntry(part, 'part', 'css shadow parts')),
      ...cssStates.map((state) => namedEntry(state, 'state', 'css states')),
      ...cssProperties.map(cssPropertyEntry),
    ]),
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
  const item = {
    name: key,
    summary: firstValue(sources, (source) => source.summary),
    description: firstValue(sources, (source) => source.description),
    deprecated: findDeprecated(sources),
  };

  return memberArgType(item, category, {
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
      memberArgType(event, 'events', {
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
    memberArgType(method, 'methods', {
      type: { name: 'function' },
      table: { type: { summary: methodSignature(method) } },
    }),
  ];
}

function namedEntry(item: MemberItem, suffix: string, category: string): [string, StrictInputType] {
  return [`${item.name}-${suffix}`, memberArgType(item, category, { type: { name: 'string' } })];
}

function cssPropertyEntry(property: CssCustomPropertyWithType): [string, StrictInputType] {
  const syntax = property.syntax ?? property.type?.text;

  return [
    property.name,
    memberArgType(property, 'css custom properties', {
      ...cssCustomPropertyControl(syntax),
      table: {
        type: { summary: syntax },
        defaultValue: { summary: property.default },
      },
    }),
  ];
}

function memberArgType(
  item: MemberItem,
  category: string,
  rest: MemberArgTypeRest
): StrictInputType {
  const { table, ...input } = rest;

  return {
    name: item.name,
    description: itemDescription(item),
    ...input,
    table: {
      ...table,
      category,
      ...deprecatedTableTags(item.deprecated),
    },
  };
}

function deprecatedTableTags(deprecated: ManifestAttribute['deprecated']): {
  jsDocTags?: { deprecated: string };
} {
  const message = deprecationMessage(deprecated);
  return message ? { jsDocTags: { deprecated: message } } : {};
}

function itemDescription(item: { summary?: string; description?: string }): string | undefined {
  return trimmedOrUndefined(item.summary ?? item.description);
}

function collectFields(members: ManifestClassMember[]): ManifestClassField[] {
  const fields = new Map<string, ManifestClassField>();
  for (const member of members) {
    if (!isField(member)) {
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
): Pick<MemberArgTypeRest, 'control' | 'type'> {
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
