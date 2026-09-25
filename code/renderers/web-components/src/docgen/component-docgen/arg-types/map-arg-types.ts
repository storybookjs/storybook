import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { eventActionName } from '../../../docs/event-action-name.ts';
import { deprecationMessage, trimmedOrUndefined } from '../utils.ts';
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

/** `type.text` is the analyzer's non-spec spelling of `syntax`. */
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

/**
 * Suffixed keys keep categories clear of attributes (the `@wc-toolkit/storybook-helpers`
 * convention); the attributes/properties spread last wins the clashes left, `on<Name>`
 * twins and bare `--x` names. The legacy runtime lets the twin win; here the declared API
 * wins on purpose.
 */
export function mapArgTypes(
  declaration: ManifestDeclaration,
  typeProperty: string
): StrictArgTypes {
  return {
    ...Object.fromEntries([
      ...(declaration.events ?? []).flatMap((event) => eventEntries(event, typeProperty)),
      ...(declaration.members ?? []).filter(isMethod).filter(isPublicMember).map(methodEntry),
      ...(declaration.slots ?? []).map((slot) =>
        namedEntry({ ...slot, name: slot.name || 'default' }, 'slot', 'slots')
      ),
      ...(declaration.cssParts ?? []).map((part) => namedEntry(part, 'part', 'css shadow parts')),
      ...(declaration.cssStates ?? []).map((state) => namedEntry(state, 'state', 'css states')),
      ...(declaration.cssProperties ?? []).map(cssPropertyEntry),
    ]),
    ...mapAttributesAndProperties(declaration, typeProperty),
  };
}

function mapAttributesAndProperties(
  declaration: ManifestDeclaration,
  typeProperty: string
): StrictArgTypes {
  const argTypes: StrictArgTypes = {};
  const members = declaration.members ?? [];
  const attributes = declaration.attributes ?? [];
  const fields = members.filter(isField);

  for (const field of fields.filter(isPublicMember)) {
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
  deprecated: ManifestAttribute['deprecated'],
  typeProperty: string
): StrictInputType {
  const text = readTypeText(source, typeProperty);
  const parsed =
    parseTypeText(text) ??
    (category === 'attributes'
      ? { type: { name: 'string' } as const }
      : { type: { name: 'other', value: text ?? '' } as const, control: false as const });
  const readonly = 'readonly' in source && source.readonly === true;

  return memberArgType({ ...source, name: key, deprecated }, category, {
    ...parsed,
    ...(readonly ? { control: false } : {}),
    table: {
      type: { summary: source.type?.text },
      defaultValue: { summary: source.default },
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
