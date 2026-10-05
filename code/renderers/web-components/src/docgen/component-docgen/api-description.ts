import { DEFAULT_SLOT_NAME } from '../../arg-keys.ts';
import { readCssPropertySyntax, readTypeText } from './arg-types/alt-type.ts';
import {
  classifyDeclaration,
  isBackedByAttribute,
  type AttributeApi,
} from './manifest/declaration-api.ts';
import { formatParameters } from './manifest/members.ts';
import type {
  ManifestClassField,
  ManifestClassMethod,
  ManifestCssCustomProperty,
  ManifestDeclaration,
  ManifestEvent,
} from './manifest/types.ts';
import { deprecationMessage, firstValue, trimmedOrUndefined } from './utils.ts';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function buildApiDescription(
  declaration: ManifestDeclaration,
  typeProperty: string
): string | undefined {
  const api = classifyDeclaration(declaration);
  const attributes = api.attributes.map((attribute) => attributeDoc(attribute, typeProperty));
  const properties = api.fields.filter((field) => !isBackedByAttribute(field, api.attributes));

  if (
    attributes.length === 0 &&
    properties.length === 0 &&
    api.events.length === 0 &&
    api.methods.length === 0 &&
    api.slots.length === 0 &&
    api.cssProperties.length === 0 &&
    api.cssParts.length === 0 &&
    api.cssStates.length === 0
  ) {
    return undefined;
  }

  const typePrefix = declaration.name.replace(/\W+/g, '');
  const sections = [
    attributesSection(typePrefix, attributes),
    propertiesSection(typePrefix, properties, typeProperty),
    eventsSection(typePrefix, api.events, typeProperty),
    methodsSection(typePrefix, api.methods, typeProperty),
    listSection(
      'Slots',
      api.slots.map((slot) => listItem(slot.name || DEFAULT_SLOT_NAME, memberDoc(slot)))
    ),
    listSection(
      'CSS Custom Properties',
      api.cssProperties.map((property) => cssPropertyListItem(property, typeProperty))
    ),
    listSection(
      'CSS Parts',
      api.cssParts.map((part) => listItem(part.name, memberDoc(part)))
    ),
    listSection(
      'CSS States',
      api.cssStates.map((state) => listItem(state.name, memberDoc(state)))
    ),
  ].filter((section): section is string => section !== undefined);

  return sections.join('\n\n').trim();
}

type DocItem = {
  summary?: string;
  description?: string;
  deprecated?: string | boolean;
  default?: string;
};

type MemberDoc = {
  text?: string;
  deprecated?: string;
  defaultValue?: string;
};

type AttributeDoc = AttributeApi & {
  type: string;
  doc: MemberDoc;
};

function attributesSection(typePrefix: string, attributes: AttributeDoc[]): string | undefined {
  if (attributes.length === 0) {
    return undefined;
  }

  return typeSection(
    'Attributes',
    `${typePrefix}Attributes`,
    attributes.flatMap(({ attribute, field, type, doc }) => {
      const suffix = field && field.name !== attribute.name ? ` // property: ${field.name}` : '';
      return [
        ...docComment(doc),
        `  ${memberName(attribute.name)}?: ${type}${memberDefault(doc)};${suffix}`,
      ];
    })
  );
}

function propertiesSection(
  typePrefix: string,
  properties: ManifestClassField[],
  typeProperty: string
): string | undefined {
  if (properties.length === 0) {
    return undefined;
  }

  return typeSection(
    'Properties',
    `${typePrefix}Properties`,
    properties.flatMap((property) => {
      const doc = memberDoc(property);
      const type = fieldType(property, typeProperty);
      return [
        ...docComment(doc),
        property.readonly === true
          ? `  readonly ${memberName(property.name)}: ${type}${memberDefault(doc)};`
          : `  ${memberName(property.name)}?: ${type}${memberDefault(doc)};`,
      ];
    })
  );
}

function eventsSection(
  typePrefix: string,
  events: ManifestEvent[],
  typeProperty: string
): string | undefined {
  if (events.length === 0) {
    return undefined;
  }

  return typeSection(
    'Events',
    `${typePrefix}Events`,
    events.flatMap((event) => [
      ...docComment(memberDoc(event)),
      `  ${memberName(event.name)}: ${readTypeText(event, typeProperty) ?? 'Event'};`,
    ])
  );
}

function methodsSection(
  typePrefix: string,
  methods: ManifestClassMethod[],
  typeProperty: string
): string | undefined {
  if (methods.length === 0) {
    return undefined;
  }

  return typeSection(
    'Methods',
    `${typePrefix}Methods`,
    methods.flatMap((method) => [
      ...docComment(memberDoc(method)),
      `  ${memberName(method.name)}(${formatParameters(method)}): ${methodReturnType(
        method,
        typeProperty
      )};`,
    ])
  );
}

function typeSection(heading: string, typeName: string, lines: string[]): string {
  return [`## ${heading}`, '', '```', `export type ${typeName} = {`, ...lines, '}', '```'].join(
    '\n'
  );
}

function listSection(heading: string, items: string[]): string | undefined {
  if (items.length === 0) {
    return undefined;
  }
  return [`## ${heading}`, '', ...items].join('\n');
}

function cssPropertyListItem(property: ManifestCssCustomProperty, typeProperty: string): string {
  const syntax = readCssPropertySyntax(property, typeProperty);
  const name = property.name;
  const syntaxText = syntax ? ` \`${syntax}\`` : '';
  return listItemPrefix(`${name}${syntaxText}`, memberDoc(property));
}

function listItem(name: string, doc: MemberDoc): string {
  return listItemPrefix(name, doc);
}

function listItemPrefix(prefix: string, doc: MemberDoc): string {
  const text = doc.text ? `: ${doc.text}` : '';
  const defaultText = doc.defaultValue === undefined ? '' : ` Default: ${doc.defaultValue}.`;
  const deprecatedText =
    doc.deprecated === undefined
      ? ''
      : doc.deprecated === 'deprecated'
        ? ' Deprecated.'
        : ` Deprecated: ${doc.deprecated}.`;

  return `- ${prefix}${text}${defaultText}${deprecatedText}`;
}

function attributeDoc(attribute: AttributeApi, typeProperty: string): AttributeDoc {
  const { field } = attribute;

  return {
    ...attribute,
    type: attributeType(attribute, typeProperty),
    doc: memberDoc(field, attribute.attribute),
  };
}

function attributeType({ attribute, field }: AttributeApi, typeProperty: string): string {
  return (
    firstValue([field, attribute], (source) =>
      source ? trimmedOrUndefined(readTypeText(source, typeProperty)) : undefined
    ) ?? 'string'
  );
}

function fieldType(field: ManifestClassField, typeProperty: string): string {
  return trimmedOrUndefined(readTypeText(field, typeProperty)) ?? 'unknown';
}

function methodReturnType(method: ManifestClassMethod, typeProperty: string): string {
  return method.return ? (readTypeText(method.return, typeProperty) ?? 'void') : 'void';
}

function memberDoc(...sources: Array<DocItem | undefined>): MemberDoc {
  return {
    text: firstValue(
      sources,
      (source) => trimmedOrUndefined(source?.description) ?? trimmedOrUndefined(source?.summary)
    ),
    deprecated: firstValue(sources, (source) => deprecationMessage(source?.deprecated)),
    defaultValue: firstValue(sources, (source) => defaultValue(source?.default)),
  };
}

function defaultValue(value: string | undefined): string | undefined {
  return value === undefined || value === 'undefined'
    ? undefined
    : value.replace(/\s+/g, ' ').trim();
}

function memberDefault(doc: MemberDoc): string {
  return doc.defaultValue === undefined ? '' : ` = ${doc.defaultValue}`;
}

function docComment(doc: MemberDoc): string[] {
  const body = doc.text ? commentLines(doc.text) : [];
  const tags: string[] = [];
  if (doc.deprecated !== undefined) {
    tags.push(
      ...commentLines(
        doc.deprecated === 'deprecated' ? '@deprecated' : `@deprecated ${doc.deprecated}`
      )
    );
  }
  if (tags.length > 0) {
    if (body.length > 0) {
      body.push('');
    }
    body.push(...tags);
  }

  if (body.length === 0) {
    return [];
  }
  if (body.length === 1) {
    return [`  /** ${body[0]} */`];
  }
  return ['  /**', ...body.map((line) => (line ? `   * ${line}` : '   *')), '   */'];
}

function commentLines(text: string): string[] {
  return text
    .replace(/\*\//g, '*\\/')
    .split('\n')
    .map((line) => line.trimEnd());
}

function memberName(name: string): string {
  return IDENTIFIER.test(name) ? name : `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
