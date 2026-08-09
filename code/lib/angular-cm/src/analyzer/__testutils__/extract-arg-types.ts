/**
 * Turns one analyzer-produced class record into argTypes, the same way the docgen worker does by
 * feeding analyzer output through the Compodoc-JSON argTypes extractor.
 *
 * This is a test-only mirror of that extractor, kept here so the analyzer's tests can assert on
 * the real downstream shape without this package depending on Compodoc.
 */
import type { ArgTypes, InputType, SBEnumType, SBType } from 'storybook/internal/types';

import type {
  Argument,
  Class,
  CompodocJson,
  Decorator,
  Directive,
  EnumTypeChild,
  Injectable,
  JsDocTag,
  Method,
  Pipe,
  Property,
} from '../../compodoc-types.ts';

export interface ExtractArgTypesOptions {
  compodocJson: CompodocJson | undefined;
  filterNonInputControls: boolean | undefined;
  unwrapHtml: (html: unknown) => string;
  modern?: boolean;
}

export const unwrapPlainText = (text: unknown): string => String(text);

type CompodocEntry = Class | Directive | Injectable | Pipe;

type CompodocMemberKey =
  | 'properties'
  | 'methods'
  | 'propertiesClass'
  | 'methodsClass'
  | 'inputsClass'
  | 'outputsClass';

const SECTION_ORDER = [
  'properties',
  'inputs',
  'outputs',
  'methods',
  'view child',
  'view children',
  'content child',
  'content children',
];

const isMethod = (methodOrProp: Method | Property): methodOrProp is Method =>
  (methodOrProp as Method).args !== undefined;

const isRequired = (item: Property): boolean => (item.required ?? true) && !item.optional;

const hasDecorator = (item: Property, decoratorName: string) =>
  item.decorators && item.decorators.find((x: Decorator) => x.name === decoratorName);

const mapPropertyToSection = (item: Property) => {
  if (hasDecorator(item, 'ViewChild')) {
    return 'view child';
  }
  if (hasDecorator(item, 'ViewChildren')) {
    return 'view children';
  }
  if (hasDecorator(item, 'ContentChild')) {
    return 'content child';
  }
  if (hasDecorator(item, 'ContentChildren')) {
    return 'content children';
  }
  return 'properties';
};

const mapItemToSection = (key: string, item: Method | Property): string => {
  switch (key) {
    case 'methods':
    case 'methodsClass':
      return 'methods';
    case 'inputsClass':
      return 'inputs';
    case 'outputsClass':
      return 'outputs';
    case 'properties':
    case 'propertiesClass':
      if (isMethod(item)) {
        throw new Error("Cannot be of type Method if key === 'propertiesClass'");
      }
      return mapPropertyToSection(item);
    default:
      throw new Error(`Unknown key: ${key}`);
  }
};

const displaySignature = (item: Method): string => {
  const args = item.args.map(
    (arg: Argument) => `${arg.name}${arg.optional ? '?' : ''}: ${arg.type}`
  );
  return `(${args.join(', ')}) => ${item.returnType}`;
};

const extractTypeFromValue = (defaultValue: any) => {
  const valueType = typeof defaultValue;
  return defaultValue || valueType === 'number' || valueType === 'boolean' || valueType === 'string'
    ? valueType
    : null;
};

const pickDeclaration = <T extends { file?: string }>(
  candidates: T[],
  componentFile: string | undefined
): T | undefined => {
  if (candidates.length <= 1) {
    return candidates[0];
  }
  const declaredAlongside = componentFile
    ? candidates.find((candidate) => candidate.file === componentFile)
    : undefined;

  return (
    declaredAlongside ??
    [...candidates].sort((a, b) => (a.file ?? '').localeCompare(b.file ?? ''))[0]
  );
};

const selectableUnionMembers = (type: string): string[] =>
  type
    .split('|')
    .map((member) => member.trim())
    .filter((member) => member !== 'undefined' && member !== 'null');

const hasEnumValue = (child: EnumTypeChild): child is EnumTypeChild & { value: string | number } =>
  Boolean(child.value);

const extractEnumValues = (
  compodocType: unknown,
  compodocJson: CompodocJson | undefined,
  componentFile?: string,
  modern = false
): SBEnumType['value'] | null => {
  const enumType = pickDeclaration(
    compodocJson?.miscellaneous?.enumerations?.filter((x) => x.name === compodocType) ?? [],
    componentFile
  );

  const childs = enumType?.childs;
  if (Array.isArray(childs) && childs.every(hasEnumValue)) {
    return childs.map((child) => child.value);
  }

  if (typeof compodocType !== 'string' || compodocType.indexOf('|') === -1) {
    return null;
  }

  const selectable = modern
    ? selectableUnionMembers(compodocType)
    : compodocType.split('|').map((value) => value.trim());
  if (selectable.length === 0) {
    return null;
  }
  try {
    return selectable.map((value) => JSON.parse(value));
  } catch (e) {
    return null;
  }
};

const resolveTypealias = (
  compodocType: string,
  compodocJson: CompodocJson | undefined,
  componentFile?: string,
  seen: Set<string> = new Set()
): string => {
  if (seen.has(compodocType)) {
    return compodocType;
  }
  const typeAlias = pickDeclaration(
    compodocJson?.miscellaneous?.typealiases?.filter((x) => x.name === compodocType) ?? [],
    componentFile
  );
  if (!typeAlias) {
    return compodocType;
  }
  seen.add(compodocType);
  return resolveTypealias(typeAlias.rawtype, compodocJson, componentFile, seen);
};

const isFunctionTypeString = (compodocType: string): boolean =>
  compodocType === 'function' || /^\(.*\)\s*=>/.test(compodocType);

const extractType = (
  property: Property,
  defaultValue: any,
  compodocJson: CompodocJson | undefined,
  componentFile?: string,
  modern = false
): SBType => {
  const compodocType = property.type || extractTypeFromValue(defaultValue);
  switch (compodocType) {
    case 'string':
    case 'boolean':
    case 'number':
      return { name: compodocType };
    case null:
      return { name: 'other', value: 'void' };
    default: {
      if (modern && typeof compodocType === 'string' && isFunctionTypeString(compodocType)) {
        return { name: 'function' };
      }
      const resolvedType = resolveTypealias(compodocType, compodocJson, componentFile);
      if (modern && typeof resolvedType === 'string' && resolvedType.indexOf('|') !== -1) {
        const members = [...new Set(selectableUnionMembers(resolvedType))];
        if (members.length === 1 && ['string', 'boolean', 'number'].includes(members[0])) {
          return { name: members[0] as 'string' | 'boolean' | 'number' };
        }
      }
      const enumValues = extractEnumValues(resolvedType, compodocJson, componentFile, modern);
      return enumValues
        ? { name: 'enum', value: enumValues }
        : { name: 'other', value: 'empty-enum' };
    }
  }
};

const castDefaultValue = (property: Property, defaultValue: any) => {
  const compodocType = property.type;

  if (compodocType && ['boolean', 'number', 'string', 'EventEmitter'].includes(compodocType)) {
    switch (compodocType) {
      case 'boolean':
        return defaultValue === 'true';
      case 'number':
        return Number(defaultValue);
      case 'EventEmitter':
        return undefined;
      default:
        return defaultValue;
    }
  } else {
    switch (defaultValue) {
      case 'true':
        return true;
      case 'false':
        return false;
      case 'null':
        return null;
      case 'undefined':
        return undefined;
      default:
        return defaultValue;
    }
  }
};

const castDefaultValueModern = (property: Property, defaultValue: any) => {
  if (defaultValue === undefined) {
    return undefined;
  }
  switch (property.type) {
    case 'boolean':
      if (defaultValue === 'true' || defaultValue === 'false') {
        return defaultValue === 'true';
      }
      return defaultValue;
    case 'number': {
      const parsed = Number(defaultValue);
      return Number.isNaN(parsed) && defaultValue !== 'NaN' ? defaultValue : parsed;
    }
    case 'EventEmitter':
      return undefined;
    case 'string':
      return defaultValue;
    default:
      return castDefaultValue(property, defaultValue);
  }
};

const unquote = (value: string): string =>
  value.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

const extractDefaultValueFromComments = (
  property: Property,
  value: any,
  unwrapHtml: (html: unknown) => string,
  modern: boolean
) => {
  let commentValue = value;
  (property.jsdoctags as JsDocTag[]).forEach((tag: JsDocTag) => {
    const tagName = (tag.tagName as { escapedText?: string }).escapedText;
    if (tagName === 'default' || tagName === 'defaultvalue') {
      if (modern) {
        if (tag.comment !== undefined) {
          commentValue = unquote(unwrapHtml(tag.comment).trim());
        }
        return;
      }
      commentValue = unwrapHtml(tag.comment);
    }
  });
  return commentValue;
};

const extractDefaultValue = (
  property: Property,
  unwrapHtml: (html: unknown) => string,
  modern: boolean
) => {
  try {
    let value: any = property.defaultValue?.replace(/^'(.*)'$/, '$1');
    value = modern ? castDefaultValueModern(property, value) : castDefaultValue(property, value);

    if (value == null && (property.jsdoctags?.length ?? 0) > 0) {
      value = extractDefaultValueFromComments(property, value, unwrapHtml, modern);
    }

    return value;
  } catch (err) {
    return undefined;
  }
};

const extractMemberJsDocTags = (
  member: Method | Property,
  unwrapHtml: (html: unknown) => string
): { deprecated?: string; returns?: { description: string } } | undefined => {
  let deprecated: string | undefined;
  let returns: { description: string } | undefined;
  for (const tag of member.jsdoctags ?? []) {
    const tagName = tag.tagName?.escapedText;
    if (tagName === 'deprecated') {
      deprecated = tag.comment === undefined ? '' : unwrapHtml(tag.comment).trim();
    } else if ((tagName === 'returns' || tagName === 'return') && tag.comment !== undefined) {
      returns = { description: unwrapHtml(tag.comment).trim() };
    }
  }
  if (deprecated === undefined && returns === undefined) {
    return undefined;
  }
  return {
    ...(deprecated !== undefined ? { deprecated } : {}),
    ...(returns !== undefined ? { returns } : {}),
  };
};

const readMembers = (componentData: CompodocEntry, key: string): (Method | Property)[] =>
  ((componentData as unknown as Record<string, unknown>)[key] as
    | (Method | Property)[]
    | undefined) || [];

const isDirectiveEntry = (componentData: CompodocEntry): componentData is Directive =>
  componentData.type === 'component' || componentData.type === 'directive';

const getModelProperties = (componentData: CompodocEntry): Property[] => {
  if (!isDirectiveEntry(componentData)) {
    return [];
  }
  const inputsByName = new Map(componentData.inputsClass.map((item) => [item.name, item]));
  return componentData.outputsClass.filter((item) => {
    const input = inputsByName.get(item.name);
    return input?.line !== undefined && input.line === item.line;
  });
};

export const extractArgTypesFromData = (
  componentData: CompodocEntry,
  { compodocJson, filterNonInputControls, unwrapHtml, modern = false }: ExtractArgTypesOptions
) => {
  const sectionToItems: Record<string, InputType[]> = {};
  const componentClasses: CompodocMemberKey[] = filterNonInputControls
    ? ['inputsClass']
    : ['propertiesClass', 'methodsClass', 'inputsClass', 'outputsClass'];
  const compodocClasses: CompodocMemberKey[] = isDirectiveEntry(componentData)
    ? componentClasses
    : ['properties', 'methods'];

  const modelProperties = getModelProperties(componentData);
  const modelPropertyNames = new Set<string>(modelProperties.map((item) => item.name));

  compodocClasses.forEach((key: CompodocMemberKey) => {
    const data = readMembers(componentData, key);
    data.forEach((item: Method | Property) => {
      if (modern && item.name.startsWith('#')) {
        return;
      }
      const section = mapItemToSection(key, item);

      if (key === 'outputsClass' && !isMethod(item) && modelPropertyNames.has(item.name)) {
        return;
      }

      const defaultValue = isMethod(item)
        ? undefined
        : extractDefaultValue(item, unwrapHtml, modern);

      const type: SBType =
        isMethod(item) || (section !== 'inputs' && section !== 'properties')
          ? { name: 'other', value: 'void' }
          : extractType(item, defaultValue, compodocJson, componentData.file, modern);
      const action = section === 'outputs' ? { action: item.name } : {};

      const jsDocTags = modern ? extractMemberJsDocTags(item, unwrapHtml) : undefined;

      const argType = {
        name: item.name,
        description: item.rawdescription || item.description,
        type,
        ...action,
        table: {
          category: section,
          ...(jsDocTags !== undefined ? { jsDocTags } : {}),
          type: {
            summary: isMethod(item) ? displaySignature(item) : item.type,
            required: isMethod(item) ? false : isRequired(item),
          },
          defaultValue: { summary: defaultValue },
        },
      };

      if (!sectionToItems[section]) {
        sectionToItems[section] = [];
      }
      sectionToItems[section].push(argType);
    });
  });

  modelProperties.forEach((item) => {
    const changeName = `${item.name}Change`;

    const argType = {
      name: changeName,
      description: item.rawdescription || item.description,
      type: { name: 'other', value: 'void' } as SBType,
      action: changeName,
      table: {
        category: 'outputs',
        type: {
          summary: `(e: ${item.type}) => void`,
          required: false,
        },
      },
    };

    if (!sectionToItems.outputs) {
      sectionToItems.outputs = [];
    }
    sectionToItems.outputs.push(argType);
  });

  const argTypes: ArgTypes = {};
  SECTION_ORDER.forEach((section) => {
    const items = sectionToItems[section];
    if (items) {
      items.forEach((argType) => {
        argTypes[argType.name as string] = argType;
      });
    }
  });

  return argTypes;
};
