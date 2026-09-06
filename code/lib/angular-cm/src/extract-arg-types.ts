/**
 * Turns one analyzer-produced class record into argTypes.
 *
 * A deliberate fork of the conversion in `@storybook/angular-compodoc`, which is deleted in
 * Storybook 11 along with the Compodoc pipeline. That copy stays frozen on the legacy behaviour its
 * committed baselines pin; this one is the successor and carries only the corrected rules, so the
 * two are not kept in sync and fixes belong here.
 */
import type { SBEnumType, SBType, StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import type {
  Argument,
  Class,
  MetadataJson,
  Decorator,
  Directive,
  EnumTypeChild,
  Injectable,
  Method,
  Pipe,
  Property,
  PropertyInitializer,
} from './types.ts';

export interface ParsingLogger {
  warn(message: string): void;
  debug(message: string): void;
}

const NOOP_LOGGER: ParsingLogger = {
  warn: () => {},
  debug: () => {},
};

/**
 * Which members reach the props table, as a strict ladder: `all` ⊃ `api` ⊃ `inputs`.
 *
 * - `all`: every member of every section.
 * - `api`: the component's template-facing surface, meaning declared inputs and outputs whatever
 *   their TypeScript visibility, plus every property and method that is not TypeScript-`private`,
 *   ES-`#`, or carrying a JSDoc `internal` tag.
 * - `inputs`: the inputs section, plus the `${name}Change` output a documented `model()` needs for
 *   its two-way binding to make sense.
 *
 * The tag is written without its `@` because `stripInternal` deletes any declaration whose leading
 * comment contains that literal.
 */
export type PropsTableMode = 'all' | 'api' | 'inputs';

export interface ExtractArgTypesOptions {
  metadataJson: MetadataJson | undefined;
  /** Required so no host inherits a silent default. */
  propsTable: PropsTableMode;
  logger?: ParsingLogger;
}

// The analyzer's `description`/`jsdoctags` comments are plain text already, never the
// Markdown-rendered HTML Compodoc produced, so a comment only ever needs stringifying.
const commentText = (comment: unknown): string => String(comment);

type Entry = Class | Directive | Injectable | Pipe;

type MemberKey =
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

// Compodoc's `required` tracks the `@Input({...})` key's presence, so `optional` must agree. With
// the key absent an initializer settles it: a defaulted input is never mandatory to bind.
const isRequired = (item: Property): boolean =>
  (item.required ?? item.initializer === undefined) && !item.optional;

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

// Compodoc lists entries in a different order from run to run and a name like `Size` is routinely
// declared once per component folder, so first-wins let a control's type change with no source
// change at all.
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

// A union sbType falls to the JSON object control downstream, so a union of primitives - a coercion
// transform's `boolean | string` write union, or an optional `string | undefined` - picks its
// control from the narrowest member instead, while the summary keeps the full union.
const CONTROL_PRIMITIVES = ['boolean', 'number', 'string'] as const;

const primitiveUnionControl = (members: string[]): SBType | undefined => {
  const narrowest = CONTROL_PRIMITIVES.find((name) => members.includes(name));
  const allPrimitive = members.every((member) =>
    (CONTROL_PRIMITIVES as readonly string[]).includes(member)
  );
  return narrowest !== undefined && allPrimitive ? { name: narrowest } : undefined;
};

const hasEnumValue = (child: EnumTypeChild): child is EnumTypeChild & { value: string | number } =>
  Boolean(child.value);

const extractEnumValues = (
  type: unknown,
  metadataJson: MetadataJson | undefined,
  componentFile?: string
): SBEnumType['value'] | null => {
  const enumType = pickDeclaration(
    metadataJson?.miscellaneous?.enumerations?.filter((x) => x.name === type) ?? [],
    componentFile
  );

  // A hand-written record can omit `childs`, and a `TypeError` here would take the whole
  // extraction down.
  const childs = enumType?.childs;
  if (Array.isArray(childs) && childs.every(hasEnumValue)) {
    return childs.map((child) => child.value);
  }

  if (typeof type !== 'string' || type.indexOf('|') === -1) {
    return null;
  }

  const selectable = selectableUnionMembers(type);
  if (selectable.length === 0) {
    return null;
  }
  try {
    return selectable.map((value) => JSON.parse(value));
  } catch {
    return null;
  }
};

// `seen` is not an optimization: `type A = B; type B = A` recurses until it takes the whole
// synchronous docgen worker down rather than one component.
const resolveTypealias = (
  type: string,
  metadataJson: MetadataJson | undefined,
  componentFile?: string,
  seen: Set<string> = new Set()
): string => {
  if (seen.has(type)) {
    return type;
  }
  const typeAlias = pickDeclaration(
    metadataJson?.miscellaneous?.typealiases?.filter((x) => x.name === type) ?? [],
    componentFile
  );
  if (!typeAlias) {
    return type;
  }
  seen.add(type);
  return resolveTypealias(typeAlias.rawtype, metadataJson, componentFile, seen);
};

// `TypeIndex.render` leads a constructor type with `new ` and a generic signature with its type
// parameters, so accepting only a leading `(` dropped both onto the `empty-enum` catch-all.
const isFunctionTypeString = (type: string): boolean =>
  type === 'function' || /^(new\s+)?(<.*>\s*)?\(.*\)\s*=>/.test(type);

const extractType = (
  property: Property,
  defaultValue: any,
  metadataJson: MetadataJson | undefined,
  componentFile?: string
): SBType => {
  const type = property.type || extractTypeFromValue(defaultValue);
  switch (type) {
    case 'string':
    case 'boolean':
    case 'number':
      return { name: type };
    case null:
      return { name: 'other', value: 'void' };
    default: {
      if (typeof type === 'string' && isFunctionTypeString(type)) {
        return { name: 'function' };
      }
      const resolvedType = resolveTypealias(type, metadataJson, componentFile);
      if (typeof resolvedType === 'string' && resolvedType.indexOf('|') !== -1) {
        const control = primitiveUnionControl([...new Set(selectableUnionMembers(resolvedType))]);
        if (control) {
          return control;
        }
      }
      const enumValues = extractEnumValues(resolvedType, metadataJson, componentFile);
      return enumValues
        ? { name: 'enum', value: enumValues }
        : { name: 'other', value: 'empty-enum' };
    }
  }
};

// A type this extractor cannot narrow keeps its raw source text, apart from the four spellings that
// stand for a real JS value.
const castUntypedDefault = (defaultValue: any) => {
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
};

// Never invents a value: a missing default stays missing rather than becoming `NaN`/`false`.
const castDefaultValue = (property: Property, defaultValue: any) => {
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
      return castUntypedDefault(defaultValue);
  }
};

const unquote = (value: string): string => value.replace(/^(['"`])([\s\S]*)\1$/, '$2');

const authoredDefault = (property: Property): string | undefined => {
  let value: string | undefined;
  for (const tag of property.jsdoctags ?? []) {
    const tagName = tag.tagName?.escapedText?.toLowerCase();
    // A bare `@default` is not a usable default. Last tag wins when there are several.
    if ((tagName === 'default' || tagName === 'defaultvalue') && tag.comment !== undefined) {
      value = unquote(commentText(tag.comment).trim());
    }
  }
  return value;
};

const analyzerDefault = (
  initializer: Extract<PropertyInitializer, { kind: 'literal' }>
): unknown => {
  switch (initializer.literalKind) {
    case 'string':
      return unquote(initializer.text);
    case 'number': {
      const parsed = Number(initializer.text);
      return Number.isNaN(parsed) ? initializer.text : parsed;
    }
    case 'boolean':
      return initializer.text === 'true';
    case 'null':
      return null;
    case 'undefined':
      return undefined;
    case 'bigint':
    case 'enum':
    case 'composite':
      return initializer.text;
  }
};

const extractDefaultValue = (property: Property, logger: ParsingLogger) => {
  try {
    const authored = authoredDefault(property);
    if (authored !== undefined) {
      return castDefaultValue(property, authored);
    }
    if (property.initializer === undefined) {
      return undefined;
    }
    if (property.initializer.kind === 'expression') {
      logger.debug(
        `${property.name}: non-literal default '${property.initializer.text}' not shown`
      );
      return undefined;
    }
    return analyzerDefault(property.initializer);
  } catch {
    logger.debug(`Error extracting ${property.name}: ${property.initializer?.text}`);
    return undefined;
  }
};

// `@param` names are absent from this shape, so only `@deprecated` and `@returns` can be surfaced.
const extractMemberJsDocTags = (
  member: Method | Property
): { deprecated?: string; returns?: { description: string } } | undefined => {
  let deprecated: string | undefined;
  let returns: { description: string } | undefined;
  for (const tag of member.jsdoctags ?? []) {
    const tagName = tag.tagName?.escapedText;
    if (tagName === 'deprecated') {
      // A bare `@deprecated` still marks the member deprecated, so it lands as an empty comment.
      deprecated = tag.comment === undefined ? '' : commentText(tag.comment).trim();
    } else if ((tagName === 'returns' || tagName === 'return') && tag.comment !== undefined) {
      returns = { description: commentText(tag.comment).trim() };
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

// `@internal` declares a member non-API wherever it appears. TypeScript `private` and ES `#` only
// bar access from code and the component's own template; a consuming template still binds an input
// or output whatever its modifier says (Angular honours modifiers only behind the opt-in
// `strictInputAccessModifiers`), so the inputs and outputs sections filter solely on `@internal`.
const documentedInMode = (
  item: Method | Property,
  section: string,
  propsTable: PropsTableMode
): boolean => {
  if (propsTable === 'all') {
    return true;
  }
  if (item.internal === true || item.name.startsWith('#')) {
    return false;
  }
  return section === 'inputs' || section === 'outputs' || item.visibility !== 'private';
};

const readMembers = (componentData: Entry, key: string): (Method | Property)[] =>
  ((componentData as unknown as Record<string, unknown>)[key] as
    | (Method | Property)[]
    | undefined) || [];

// The analyzer splits decorator IO onto plain classes too, so reading `*Class` off anything else
// lets a base holding a `model()` invent a `${name}Change` output on an entry with no inputs.
const isDirectiveEntry = (componentData: Entry): componentData is Directive =>
  componentData.type === 'component' || componentData.type === 'directive';

// A `model()` is marked in no way other than an output whose same-named input is declared on the
// same line, which an `@Input('x')`/`@Output('x')` alias collision is not.
const getModelProperties = (componentData: Entry): Property[] => {
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
  componentData: Entry,
  { metadataJson, propsTable, logger = NOOP_LOGGER }: ExtractArgTypesOptions
) => {
  const sectionToItems: Record<string, StrictInputType[]> = {};
  const componentClasses: MemberKey[] =
    propsTable === 'inputs'
      ? ['inputsClass']
      : ['propertiesClass', 'methodsClass', 'inputsClass', 'outputsClass'];
  const memberKeys: MemberKey[] = isDirectiveEntry(componentData)
    ? componentClasses
    : ['properties', 'methods'];

  const modelProperties = getModelProperties(componentData);
  const modelPropertyNames = new Set<string>(modelProperties.map((item) => item.name));

  memberKeys.forEach((key: MemberKey) => {
    const data = readMembers(componentData, key);
    data.forEach((item: Method | Property) => {
      const section = mapItemToSection(key, item);

      // A `model()` surfaces as an input plus the `${name}Change` synthesized below, so the
      // bare-name output duplicate of it is dropped.
      if (key === 'outputsClass' && !isMethod(item) && modelPropertyNames.has(item.name)) {
        return;
      }

      if (!documentedInMode(item, section, propsTable)) {
        logger.debug(
          `${componentData.name}.${item.name} left out of the props table: propsTable '${propsTable}'`
        );
        return;
      }

      const defaultValue = isMethod(item) ? undefined : extractDefaultValue(item, logger);

      const declaredType: SBType =
        isMethod(item) || (section !== 'inputs' && section !== 'properties')
          ? { name: 'other', value: 'void' }
          : extractType(item, defaultValue, metadataJson, componentData.file);

      const type: SBType =
        section === 'inputs' && !isMethod(item) && isRequired(item)
          ? { ...declaredType, required: true }
          : declaredType;

      const action = section === 'outputs' ? { action: item.name } : {};

      const jsDocTags = extractMemberJsDocTags(item);

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

  // The `${name}Change` output this shape never carries directly. It follows its model's input
  // row: synthesized even in `inputs` mode, which narrows sections but must not split a documented
  // pair, and skipped when the mode hides the model itself.
  modelProperties
    .filter((item) => documentedInMode(item, 'inputs', propsTable))
    .forEach((item) => {
      const changeName = `${item.name}Change`;

      // An output rather than the model input it derives from: no `defaultValue`, no `required`,
      // and typed as the emitted-payload handler signature.
      const argType = {
        name: changeName,
        description: item.rawdescription || item.description,
        type: { name: 'other', value: 'void' } as SBType,
        action: changeName,
        table: {
          category: 'outputs',
          type: {
            summary: `(e: ${item.type}) => void`,
          },
        },
      };

      if (!sectionToItems.outputs) {
        sectionToItems.outputs = [];
      }
      sectionToItems.outputs.push(argType);
    });

  const argTypes: StrictArgTypes = {};
  SECTION_ORDER.forEach((section) => {
    const items = sectionToItems[section];
    if (items) {
      items.forEach((argType) => {
        argTypes[argType.name] = argType;
      });
    }
  });

  return argTypes;
};
