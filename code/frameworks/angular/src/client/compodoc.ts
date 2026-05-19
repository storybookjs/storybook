import { logger } from 'storybook/internal/client-logger';
import type { ArgTypes, InputType, SBType } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type {
  Argument,
  Class,
  CompodocJson,
  Component,
  Directive,
  Injectable,
  JsDocTag,
  Method,
  Pipe,
  Property,
} from './compodoc-types.ts';

const { FEATURES } = global;

export const isMethod = (methodOrProp: Method | Property): methodOrProp is Method => {
  return (methodOrProp as Method).args !== undefined;
};

export const setCompodocJson = (compodocJson: CompodocJson) => {
  global.__STORYBOOK_COMPODOC_JSON__ = compodocJson;
};

export const getCompodocJson = (): CompodocJson => global.__STORYBOOK_COMPODOC_JSON__;

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
  item.decorators && item.decorators.find((x: any) => x.name === decoratorName);

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

export const findComponentByName = (name: string, compodocJson: CompodocJson) =>
  compodocJson.components.find((c: Component) => c.name === name) ||
  compodocJson.directives.find((c: Directive) => c.name === name) ||
  compodocJson.pipes.find((c: Pipe) => c.name === name) ||
  compodocJson.injectables.find((c: Injectable) => c.name === name) ||
  compodocJson.classes.find((c: Class) => c.name === name);

const getComponentData = (component: Component | Directive) => {
  if (!component) {
    return null;
  }
  checkValidComponentOrDirective(component);
  const compodocJson = getCompodocJson();
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

const extractEnumValues = (compodocType: any) => {
  const compodocJson = getCompodocJson();
  const enumType = compodocJson?.miscellaneous?.enumerations?.find((x) => x.name === compodocType);

  if (enumType?.childs.every((x) => x.value)) {
    return enumType.childs.map((x) => x.value);
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

export const extractType = (property: Property, defaultValue: any): SBType => {
  const compodocType = property.type || extractTypeFromValue(defaultValue);
  switch (compodocType) {
    case 'string':
    case 'boolean':
    case 'number':
      return { name: compodocType };
    case undefined:
    case null:
      return { name: 'other', value: 'void' };
    default: {
      const resolvedType = resolveTypealias(compodocType);
      const enumValues = extractEnumValues(resolvedType);
      return enumValues
        ? { name: 'enum', value: enumValues }
        : { name: 'other', value: 'empty-enum' };
    }
  }
};

const castDefaultValue = (property: Property, defaultValue: any) => {
  const compodocType = property.type;

  // All these checks are necessary as compodoc does not always set the type ie. @HostBinding have empty types.
  // null and undefined also have 'any' type
  if (['boolean', 'number', 'string', 'EventEmitter'].includes(compodocType)) {
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

const extractDefaultValueFromComments = (property: Property, value: any) => {
  let commentValue = value;
  property.jsdoctags.forEach((tag: JsDocTag) => {
    if (['default', 'defaultvalue'].includes(tag.tagName.escapedText)) {
      const dom = new global.DOMParser().parseFromString(tag.comment, 'text/html');
      commentValue = dom.body.textContent;
    }
  });
  return commentValue;
};

const extractDefaultValue = (property: Property) => {
  try {
    let value: string = property.defaultValue?.replace(/^'(.*)'$/, '$1');
    value = castDefaultValue(property, value);

    if (value == null && property.jsdoctags?.length > 0) {
      value = extractDefaultValueFromComments(property, value);
    }

    return value;
  } catch (err) {
    logger.debug(`Error extracting ${property.name}: ${property.defaultValue}`);
    return undefined;
  }
};

const resolveTypealias = (compodocType: string): string => {
  const compodocJson = getCompodocJson();
  const typeAlias = compodocJson?.miscellaneous?.typealiases?.find((x) => x.name === compodocType);
  return typeAlias ? resolveTypealias(typeAlias.rawtype) : compodocType;
};

export const extractArgTypesFromData = (componentData: Class | Directive | Injectable | Pipe) => {
  const sectionToItems: Record<string, InputType[]> = {};
  const componentClasses = FEATURES.angularFilterNonInputControls
    ? ['inputsClass']
    : ['propertiesClass', 'methodsClass', 'inputsClass', 'outputsClass'];
  const compodocClasses = ['component', 'directive'].includes(componentData.type)
    ? componentClasses
    : ['properties', 'methods'];

  type COMPODOC_CLASS =
    | 'properties'
    | 'methods'
    | 'propertiesClass'
    | 'methodsClass'
    | 'inputsClass'
    | 'outputsClass';

  // Detect Angular `model()` signals. compodoc emits no `model()` marker: a
  // `model()` lands under the same bare name in BOTH `inputsClass` and
  // `outputsClass`, whereas plain inputs/outputs land in only one. A name in both
  // arrays is the only version-tolerant discriminator.
  //
  // Known limitation: a hand-written same-name `@Input() x` + `@Output() x` pair is
  // indistinguishable from a real `model()` and is misclassified (bare-name output
  // suppressed, spurious `${name}Change` synthesized). Rare; accepted trade-off for
  // an external, unpinned tool.
  const inputClassNames = new Set<string>(
    (((componentData as any).inputsClass as Property[]) || []).map((item) => item.name)
  );
  const modelProperties: Property[] = (
    ((componentData as any).outputsClass as Property[]) || []
  ).filter((item) => inputClassNames.has(item.name));
  const modelPropertyNames = new Set<string>(modelProperties.map((item) => item.name));

  compodocClasses.forEach((key: COMPODOC_CLASS) => {
    const data = (componentData as any)[key] || [];
    data.forEach((item: Method | Property) => {
      const section = mapItemToSection(key, item);

      // Suppress compodoc's spurious bare-name `outputsClass` duplicate of a
      // `model()`. The model surfaces as an INPUT control (from `inputsClass`); its
      // output is the synthesized `${name}Change` added below.
      if (key === 'outputsClass' && !isMethod(item) && modelPropertyNames.has(item.name)) {
        return;
      }

      const defaultValue = isMethod(item) ? undefined : extractDefaultValue(item as Property);

      const type: SBType =
        isMethod(item) || (section !== 'inputs' && section !== 'properties')
          ? { name: 'other', value: 'void' }
          : extractType(item as Property, defaultValue);
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
            required: isMethod(item) ? false : !item.optional,
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
  // loop so it is unaffected by `FEATURES.angularFilterNonInputControls`.
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
          required: !item.optional,
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
        argTypes[argType.name] = argType;
      });
    }
  });

  return argTypes;
};

export const extractArgTypes = (component: Component | Directive) => {
  const componentData = getComponentData(component);
  return componentData && extractArgTypesFromData(componentData);
};

export const extractComponentDescription = (component: Component | Directive) => {
  const componentData = getComponentData(component);
  return componentData && (componentData.rawdescription || componentData.description);
};
