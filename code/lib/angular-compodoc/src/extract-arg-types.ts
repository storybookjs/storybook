// Shared by the browser adapters and the Node docgen worker, so this module reads no globals.
import type { ArgTypes, InputType, SBEnumType, SBType } from 'storybook/internal/types';

import type {
  Argument,
  Class,
  CompodocJson,
  Component,
  Decorator,
  Directive,
  EnumTypeChild,
  Injectable,
  JsDocTag,
  Method,
  Pipe,
  Property,
} from './compodoc-types.ts';

export interface CompodocParsingLogger {
  warn(message: string): void;
  debug(message: string): void;
}

const NOOP_LOGGER: CompodocParsingLogger = {
  warn: () => {},
  debug: () => {},
};

export interface CompodocLookupOptions {
  /** Undefined when the browser is asked to extract before `setCompodocJson` has run. */
  compodocJson: CompodocJson | undefined;
  logger?: CompodocParsingLogger;
}

export interface ExtractArgTypesOptions extends CompodocLookupOptions {
  /** The `angularFilterNonInputControls` flag, required so no host inherits a silent default. */
  filterNonInputControls: boolean | undefined;
  /** Unwraps Compodoc's Markdown-rendered HTML; DOM-less hosts pass {@link unwrapPlainText}. */
  unwrapHtml: (html: unknown) => string;
  /** Drops the legacy Compodoc quirks, off by default while the committed baselines pin them. */
  modern?: boolean;
}

/** `unwrapHtml` for plain-text hosts; a real unwrapper eats the `<string>` in `Array<string>`. */
export const unwrapPlainText = (text: unknown): string => String(text);

/** Anything `findComponentByName` can return, i.e. any Compodoc entry with extractable members. */
export type CompodocEntry = Class | Directive | Injectable | Pipe;

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

export const isMethod = (methodOrProp: Method | Property): methodOrProp is Method => {
  return (methodOrProp as Method).args !== undefined;
};

// Compodoc's `required` tracks the `@Input({...})` key's presence, so `optional` must agree.
const isRequired = (item: Property): boolean => (item.required ?? true) && !item.optional;

export const checkValidComponentOrDirective = (component: Component | Directive) => {
  if (!component.name) {
    throw new Error(`Invalid component ${JSON.stringify(component)}`);
  }
};

export const checkValidCompodocJson = (compodocJson: CompodocJson) => {
  if (!compodocJson || !compodocJson.components) {
    throw new Error('Invalid compodoc JSON');
  }
};

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

export const findComponentByName = (
  name: string,
  compodocJson: CompodocJson
): CompodocEntry | undefined =>
  compodocJson.components?.find((c: Component) => c.name === name) ||
  compodocJson.directives?.find((c: Directive) => c.name === name) ||
  compodocJson.pipes?.find((c: Pipe) => c.name === name) ||
  compodocJson.injectables?.find((c: Injectable) => c.name === name) ||
  compodocJson.classes?.find((c: Class) => c.name === name);

export const getComponentData = (
  component: Component | Directive,
  { compodocJson, logger = NOOP_LOGGER }: CompodocLookupOptions
): CompodocEntry | null | undefined => {
  if (!component) {
    return null;
  }
  checkValidComponentOrDirective(component);
  if (!compodocJson) {
    return null;
  }
  checkValidCompodocJson(compodocJson);
  const { name } = component;
  const metadata = findComponentByName(name, compodocJson);
  if (!metadata) {
    logger.warn(`Component not found in compodoc JSON: '${name}'`);
  }
  return metadata;
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

  // A hand-written `documentation.json` can omit `childs`, and a `TypeError` here would take the
  // whole extraction down.
  const childs = enumType?.childs;
  if (Array.isArray(childs) && childs.every(hasEnumValue)) {
    return childs.map((child) => child.value);
  }

  if (typeof compodocType !== 'string' || compodocType.indexOf('|') === -1) {
    return null;
  }

  // Legacy keeps `undefined`/`null` members so `"A" | undefined` stays the `empty-enum` catch-all
  // byte-for-byte.
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

// `seen` is not an optimization: `type A = B; type B = A` recurses until it takes the whole
// synchronous docgen worker down rather than one component.
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

// A signature can lead with `new ` for a constructor type or with its type parameters when generic,
// so accepting only a leading `(` dropped both onto the `empty-enum` catch-all.
const isFunctionTypeString = (compodocType: string): boolean =>
  compodocType === 'function' || /^(new\s+)?(<.*>\s*)?\(.*\)\s*=>/.test(compodocType);

export const extractType = (
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
      // An optional primitive like `string | undefined` is a primitive control; treating it as an
      // enum candidate loses the control entirely.
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

  // null and undefined also have 'any' type
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

// Unlike `castDefaultValue`, never invents a value: a missing default stays missing rather than
// becoming `NaN`/`false`, and an expression default keeps its raw source text.
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

const extractDefaultValueFromComments = (
  property: Property,
  value: any,
  unwrapHtml: (html: unknown) => string,
  modern: boolean
) => {
  let commentValue = value;
  // `jsdoctags` is only read after the caller has established it is non-empty.
  (property.jsdoctags as JsDocTag[]).forEach((tag: JsDocTag) => {
    // `tagName` is optional in Compodoc's output and read unguarded on purpose: a tag without one
    // throws into `extractDefaultValue`'s catch, which drops the property's default entirely.
    const tagName = (tag.tagName as { escapedText?: string }).escapedText;
    if (tagName === 'default' || tagName === 'defaultvalue') {
      if (modern) {
        // A bare `@default` is not a usable default, though legacy records the string "undefined".
        if (tag.comment !== undefined) {
          commentValue = unquote(unwrapHtml(tag.comment).trim());
        }
        return;
      }
      // Last tag wins when a property carries several `@default`s.
      commentValue = unwrapHtml(tag.comment);
    }
  });
  return commentValue;
};

const unquote = (value: string): string =>
  value.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

const extractDefaultValue = (
  property: Property,
  logger: CompodocParsingLogger,
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
    logger.debug(`Error extracting ${property.name}: ${property.defaultValue}`);
    return undefined;
  }
};

// `@param` names are absent from Compodoc's tag shape, so only `@deprecated` and `@returns` can be
// surfaced.
const extractMemberJsDocTags = (
  member: Method | Property,
  unwrapHtml: (html: unknown) => string
): { deprecated?: string; returns?: { description: string } } | undefined => {
  let deprecated: string | undefined;
  let returns: { description: string } | undefined;
  for (const tag of member.jsdoctags ?? []) {
    const tagName = tag.tagName?.escapedText;
    if (tagName === 'deprecated') {
      // A bare `@deprecated` still marks the member deprecated, so it lands as an empty comment.
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

// The analyzer splits decorator IO onto plain classes too, so reading `*Class` off anything else
// lets a base holding a `model()` invent a `${name}Change` output on an entry with no inputs.
const isDirectiveEntry = (componentData: CompodocEntry): componentData is Directive =>
  componentData.type === 'component' || componentData.type === 'directive';

// Compodoc marks a `model()` in no way other than an output whose same-named input is declared on
// the same line, which an `@Input('x')`/`@Output('x')` alias collision is not.
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
  {
    compodocJson,
    filterNonInputControls,
    logger = NOOP_LOGGER,
    unwrapHtml,
    modern = false,
  }: ExtractArgTypesOptions
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
      // ES-private `#member`s cannot be bound from outside the class, so their props-table row is
      // noise that only the legacy path keeps.
      if (modern && item.name.startsWith('#')) {
        return;
      }
      const section = mapItemToSection(key, item);

      // A `model()` surfaces as an input plus the `${name}Change` synthesized below, so Compodoc's
      // bare-name output duplicate of it is dropped.
      if (key === 'outputsClass' && !isMethod(item) && modelPropertyNames.has(item.name)) {
        return;
      }

      const defaultValue = isMethod(item)
        ? undefined
        : extractDefaultValue(item, logger, unwrapHtml, modern);

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

  // The `${name}Change` output Compodoc never emits, synthesized after the loop so
  // `filterNonInputControls` cannot hide it.
  modelProperties.forEach((item) => {
    const changeName = `${item.name}Change`;

    // An output rather than the model input it derives from: no `defaultValue`, never required to
    // bind, and typed as the emitted-payload handler signature.
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
