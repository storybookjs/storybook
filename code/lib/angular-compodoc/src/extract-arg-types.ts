import type { ArgTypes, InputType, SBEnumType, SBType } from 'storybook/internal/types';

import type {
  Argument,
  Class,
  CompodocJson,
  Component,
  Decorator,
  Directive,
  Injectable,
  JsDocTag,
  Method,
  Pipe,
  Property,
} from './compodoc-types.ts';

/**
 * Environment-agnostic Compodoc parsing.
 *
 * This module is shared by the browser adapters in `@storybook/angular-vite` and
 * `@storybook/angular` and by the Node docgen worker, so it reads no globals and imports nothing
 * environment-specific: the Compodoc JSON, the `angularFilterNonInputControls` feature flag, the
 * logger and the HTML unwrapper all arrive as explicit arguments.
 *
 * Its known gaps (invented `NaN`/`false` defaults, the `other`/`empty-enum` catch-all, dropped
 * JSDoc tags, quoted `@default` values) are deliberate: the committed baselines record them, so
 * changing any of them is a behaviour change, not a fix.
 */

/** Minimal logging surface, so the module never reaches for a host-specific logger. */
export interface CompodocParsingLogger {
  warn(message: string): void;
  debug(message: string): void;
}

const NOOP_LOGGER: CompodocParsingLogger = {
  warn: () => {},
  debug: () => {},
};

export interface CompodocLookupOptions {
  /**
   * Parsed `documentation.json`. Optional because the browser path can be asked to extract before
   * `setCompodocJson` has run, and enum/type-alias resolution simply yields nothing in that case.
   */
  compodocJson: CompodocJson | undefined;
  logger?: CompodocParsingLogger;
}

export interface ExtractArgTypesOptions extends CompodocLookupOptions {
  /**
   * Value of the `angularFilterNonInputControls` feature flag. Required (though nullable) so a
   * Node host cannot silently inherit the opposite of the user's configured behaviour.
   */
  filterNonInputControls: boolean | undefined;
  /**
   * Unwraps an HTML fragment to plain text. Compodoc renders `@default` tag comments through
   * Markdown, so they arrive as HTML. Required: the browser has a real HTML parser and keeps using
   * it, while a Node host has to supply the DOM-free replacement.
   */
  unwrapHtml: (html: unknown) => string;
}

/** Anything `findComponentByName` can return, i.e. any Compodoc entry with extractable members. */
export type CompodocEntry = Class | Directive | Injectable | Pipe;

type CompodocMemberKey =
  | 'properties'
  | 'methods'
  | 'propertiesClass'
  | 'methodsClass'
  | 'inputsClass'
  | 'outputsClass';

export const isMethod = (methodOrProp: Method | Property): methodOrProp is Method => {
  return (methodOrProp as Method).args !== undefined;
};

/**
 * Whether a member must be bound, from the two flags Compodoc emits about it.
 *
 * `required` is the flag that matches what Angular means, but it is only trustworthy in one
 * direction: Compodoc derives it from the presence of the `required` key in an `@Input({...})`
 * argument rather than from its value, so `@Input({ required: false })` reports `required: true`
 * alongside `optional: true`. Requiring both to agree keeps that case correct.
 *
 * `required` is absent altogether for a plain `@Input()`, which falls back to `optional` - and
 * Compodoc omits that too (compodoc#863), so those inputs still read as required. That is the
 * upstream gap; the moment a fixed Compodoc emits `optional`, this returns the right answer with
 * no change here.
 */
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

/**
 * Picks one declaration out of several sharing a name.
 *
 * Compodoc's output is not stable: the same project produces the same entries in a different order
 * from run to run, and a name like `Story` or `Size` is routinely declared once per component folder.
 * Taking whatever the array happened to list first therefore let a control's type change with no
 * source change at all. The component's own file wins, and any remaining tie is broken on the file
 * path so the answer is at least the same every run.
 */
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

const extractEnumValues = (
  compodocType: unknown,
  compodocJson: CompodocJson | undefined,
  componentFile?: string
): SBEnumType['value'] | null => {
  const enumType = pickDeclaration(
    compodocJson?.miscellaneous?.enumerations?.filter((x) => x.name === compodocType) ?? [],
    componentFile
  );

  // `childs` is guarded like the sibling lookups: an enumeration entry without it must not throw a
  // `TypeError` out of the whole extraction.
  if (Array.isArray(enumType?.childs) && enumType.childs.every((x) => x.value)) {
    return enumType.childs.map((x) => x.value as string);
  }

  if (typeof compodocType !== 'string' || compodocType.indexOf('|') === -1) {
    return null;
  }

  try {
    return compodocType.split('|').map((value) => JSON.parse(value));
  } catch (e) {
    return null;
  }
};

/**
 * Follows `type A = B` chains to the underlying type name.
 *
 * `seen` is not an optimization: `type A = B; type B = A` recurses forever without it, and because
 * extraction is synchronous it takes the whole docgen worker down rather than one component.
 */
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

export const extractType = (
  property: Property,
  defaultValue: any,
  compodocJson: CompodocJson | undefined,
  /** Source file of the component being extracted, used to disambiguate same-named declarations. */
  componentFile?: string
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
      const resolvedType = resolveTypealias(compodocType, compodocJson, componentFile);
      const enumValues = extractEnumValues(resolvedType, compodocJson, componentFile);
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

const extractDefaultValueFromComments = (
  property: Property,
  value: any,
  unwrapHtml: (html: unknown) => string
) => {
  let commentValue = value;
  // `jsdoctags` is only read after the caller has established it is non-empty.
  (property.jsdoctags as JsDocTag[]).forEach((tag: JsDocTag) => {
    // `tagName` is optional in Compodoc's output and read unguarded on purpose: a tag without one
    // throws into `extractDefaultValue`'s catch, which drops the property's default entirely.
    const tagName = (tag.tagName as { escapedText?: string }).escapedText;
    if (tagName === 'default' || tagName === 'defaultvalue') {
      // Last tag wins when a property carries several `@default`s.
      commentValue = unwrapHtml(tag.comment);
    }
  });
  return commentValue;
};

const extractDefaultValue = (
  property: Property,
  logger: CompodocParsingLogger,
  unwrapHtml: (html: unknown) => string
) => {
  try {
    let value: any = property.defaultValue?.replace(/^'(.*)'$/, '$1');
    value = castDefaultValue(property, value);

    if (value == null && (property.jsdoctags?.length ?? 0) > 0) {
      value = extractDefaultValueFromComments(property, value, unwrapHtml);
    }

    return value;
  } catch (err) {
    logger.debug(`Error extracting ${property.name}: ${property.defaultValue}`);
    return undefined;
  }
};

const readMembers = (componentData: CompodocEntry, key: string): (Method | Property)[] =>
  ((componentData as unknown as Record<string, unknown>)[key] as
    | (Method | Property)[]
    | undefined) || [];

/**
 * The `model()` members of a Compodoc entry: an output whose same-named input is declared on the
 * same line. Compodoc marks a `model()` in no other way, and an `@Input('x')`/`@Output('x')` alias
 * collision shares the name but not the line. The package README has the quirk in full.
 */
const getModelProperties = (componentData: CompodocEntry): Property[] => {
  const inputsByName = new Map(
    (readMembers(componentData, 'inputsClass') as Property[]).map((item) => [item.name, item])
  );
  return (readMembers(componentData, 'outputsClass') as Property[]).filter((item) => {
    const input = inputsByName.get(item.name);
    return input?.line !== undefined && input.line === item.line;
  });
};

export const extractArgTypesFromData = (
  componentData: CompodocEntry,
  { compodocJson, filterNonInputControls, logger = NOOP_LOGGER, unwrapHtml }: ExtractArgTypesOptions
) => {
  const sectionToItems: Record<string, InputType[]> = {};
  const componentClasses: CompodocMemberKey[] = filterNonInputControls
    ? ['inputsClass']
    : ['propertiesClass', 'methodsClass', 'inputsClass', 'outputsClass'];
  const compodocClasses: CompodocMemberKey[] = ['component', 'directive'].includes(
    componentData.type
  )
    ? componentClasses
    : ['properties', 'methods'];

  const modelProperties = getModelProperties(componentData);
  const modelPropertyNames = new Set<string>(modelProperties.map((item) => item.name));

  compodocClasses.forEach((key: CompodocMemberKey) => {
    const data = readMembers(componentData, key);
    data.forEach((item: Method | Property) => {
      const section = mapItemToSection(key, item);

      // Suppress compodoc's spurious bare-name `outputsClass` duplicate of a
      // `model()`. The model surfaces as an INPUT control (from `inputsClass`); its
      // output is the synthesized `${name}Change` added below.
      if (key === 'outputsClass' && !isMethod(item) && modelPropertyNames.has(item.name)) {
        return;
      }

      const defaultValue = isMethod(item)
        ? undefined
        : extractDefaultValue(item as Property, logger, unwrapHtml);

      const type: SBType =
        isMethod(item) || (section !== 'inputs' && section !== 'properties')
          ? { name: 'other', value: 'void' }
          : extractType(item as Property, defaultValue, compodocJson, componentData.file);
      const action = section === 'outputs' ? { action: item.name } : {};

      const argType = {
        name: item.name,
        description: item.rawdescription || item.description,
        type,
        ...action,
        table: {
          category: section,
          type: {
            summary: isMethod(item) ? displaySignature(item) : item.type,
            required: isMethod(item) ? false : isRequired(item as Property),
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

  // Synthesize the `${name}Change` output compodoc never emits. Runs after the
  // loop so it is unaffected by `filterNonInputControls`.
  modelProperties.forEach((item) => {
    const changeName = `${item.name}Change`;

    // This is an OUTPUT, not the model INPUT it derives from: omit `defaultValue`
    // and render the type as the emitted-payload handler signature.
    const argType = {
      name: changeName,
      description: item.rawdescription || item.description,
      type: { name: 'other', value: 'void' } as SBType,
      action: changeName,
      table: {
        category: 'outputs',
        type: {
          summary: `(e: ${item.type}) => void`,
          // An output is never required to bind, and a real output says so via Compodoc's own
          // flag. This one is synthesized, so it has to say so itself rather than inheriting the
          // requiredness of the model input it derives from.
          required: false,
        },
      },
    };

    if (!sectionToItems.outputs) {
      sectionToItems.outputs = [];
    }
    sectionToItems.outputs.push(argType);
  });

  const SECTIONS = [
    'properties',
    'inputs',
    'outputs',
    'methods',
    'view child',
    'view children',
    'content child',
    'content children',
  ];
  const argTypes: ArgTypes = {};
  SECTIONS.forEach((section) => {
    const items = sectionToItems[section];
    if (items) {
      items.forEach((argType) => {
        argTypes[argType.name as string] = argType;
      });
    }
  });

  return argTypes;
};
