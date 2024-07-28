import { Type } from '@angular/core';
import { ArgTypes } from 'storybook/internal/types';
import { ICollection } from '../types';
import {
  ComponentInputsOutputs,
  getComponentDecoratorMetadata,
  getComponentInputsOutputs,
} from './utils/NgComponentAnalyzer';

/**
 * Check if the name matches the criteria for a valid identifier.
 * A valid identifier can only contain letters, digits, underscores, or dollar signs.
 * It cannot start with a digit.
 */
const isValidIdentifier = (name: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);

/**
 * Returns the property name, if it can be accessed with dot notation. If not,
 * it returns `this['propertyName']`.
 */
export const formatPropInTemplate = (propertyName: string) =>
  isValidIdentifier(propertyName) ? propertyName : `this['${propertyName}']`;

const separateInputsOutputsAttributes = (
  ngComponentInputsOutputs: ComponentInputsOutputs,
  props: ICollection = {}
) => {
  const inputs = ngComponentInputsOutputs.inputs
    .filter((i) => i.templateName in props)
    .map((i) => i.templateName);
  const outputs = ngComponentInputsOutputs.outputs
    .filter((o) => o.templateName in props)
    .map((o) => o.templateName);

  return {
    inputs,
    outputs,
    otherProps: Object.keys(props).filter((k) => ![...inputs, ...outputs].includes(k)),
  };
};

/**
 * Converts a component into a template with inputs/outputs present in initial props
 * @param component
 * @param initialProps
 * @param innerTemplate
 */
export const computesTemplateFromComponent = (
  component: Type<unknown>,
  initialProps?: ICollection,
  innerTemplate = ''
) => {
  const ngComponentMetadata = getComponentDecoratorMetadata(component);
  const ngComponentInputsOutputs = getComponentInputsOutputs(component);

  if (!ngComponentMetadata.selector) {
    // Allow to add renderer component when NgComponent selector is undefined
    return `<ng-container *ngComponentOutlet="storyComponent"></ng-container>`;
  }

  const { inputs: initialInputs, outputs: initialOutputs } = separateInputsOutputsAttributes(
    ngComponentInputsOutputs,
    initialProps
  );

  const templateInputs =
    initialInputs.length > 0
      ? ` ${initialInputs.map((i) => `[${i}]="${formatPropInTemplate(i)}"`).join(' ')}`
      : '';
  const templateOutputs =
    initialOutputs.length > 0
      ? ` ${initialOutputs.map((i) => `(${i})="${formatPropInTemplate(i)}($event)"`).join(' ')}`
      : '';

  return buildTemplate(
    ngComponentMetadata.selector,
    innerTemplate,
    templateInputs,
    templateOutputs
  );
};

/**
 * Stringify an object with a placholder in the circular references.
 */
function stringifyCircular(obj: any) {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}

const createAngularInputProperty = ({
  propertyName,
  value,
  argType,
}: {
  propertyName: string;
  value: any;
  argType?: ArgTypes[string];
}) => {
  let templateValue;
  switch (typeof value) {
    case 'string':
      templateValue = `'${value}'`;
      break;
    case 'object':
      templateValue = stringifyCircular(value)
        .replace(/'/g, '\u2019')
        .replace(/\\"/g, '\u201D')
        .replace(/"([^-"]+)":/g, '$1: ')
        .replace(/"/g, "'")
        .replace(/\u2019/g, "\\'")
        .replace(/\u201D/g, "\\'")
        .split(',')
        .join(', ');
      break;
    default:
      templateValue = value;
  }

  return `[${propertyName}]="${templateValue}"`;
};

/**
 * Converts a component into a template with inputs/outputs present in initial props
 * @param component
 * @param initialProps
 * @param innerTemplate
 */
export const computesTemplateSourceFromComponent = (
  component: Type<unknown>,
  initialProps?: ICollection,
  argTypes?: ArgTypes
) => {
  const ngComponentMetadata = getComponentDecoratorMetadata(component);
  if (!ngComponentMetadata) {
    return null;
  }

  if (!ngComponentMetadata.selector) {
    // Allow to add renderer component when NgComponent selector is undefined
    return `<ng-container *ngComponentOutlet="${component.name}"></ng-container>`;
  }

  const ngComponentInputsOutputs = getComponentInputsOutputs(component);
  const { inputs: initialInputs, outputs: initialOutputs } = separateInputsOutputsAttributes(
    ngComponentInputsOutputs,
    initialProps
  );

  const templateInputs =
    initialInputs.length > 0
      ? ` ${initialInputs
          .map((propertyName) =>
            createAngularInputProperty({
              propertyName,
              value: initialProps[propertyName],
              argType: argTypes?.[propertyName],
            })
          )
          .join(' ')}`
      : '';
  const templateOutputs =
    initialOutputs.length > 0
      ? ` ${initialOutputs.map((i) => `(${i})="${formatPropInTemplate(i)}($event)"`).join(' ')}`
      : '';

  return buildTemplate(ngComponentMetadata.selector, '', templateInputs, templateOutputs);
};

const buildTemplate = (
  selector: string,
  innerTemplate: string,
  inputs: string,
  outputs: string
) => {
  // https://www.w3.org/TR/2011/WD-html-markup-20110113/syntax.html#syntax-elements
  const voidElements = [
    'area',
    'base',
    'br',
    'col',
    'command',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ];

  const firstSelector = selector.split(',')[0];
  const templateReplacers: [
    string | RegExp,
    string | ((substring: string, ...args: any[]) => string),
  ][] = [
    [/(^.*?)(?=[,])/, '$1'],
    [/(^\..+)/, 'div$1'],
    [/(^\[.+?])/, 'div$1'],
    [/([\w[\]]+)(\s*,[\w\s-[\],]+)+/, `$1`],
    [/#([\w-]+)/, ` id="$1"`],
    [/((\.[\w-]+)+)/, (_, c) => ` class="${c.split`.`.join` `.trim()}"`],
    [/(\[.+?])/g, (_, a) => ` ${a.slice(1, -1)}`],
    [
      /([\S]+)(.*)/,
      (template, elementSelector) => {
        return voidElements.some((element) => elementSelector === element)
          ? template.replace(/([\S]+)(.*)/, `<$1$2${inputs}${outputs} />`)
          : template.replace(/([\S]+)(.*)/, `<$1$2${inputs}${outputs}>${innerTemplate}</$1>`);
      },
    ],
  ];

  return templateReplacers.reduce(
    (prevSelector, [searchValue, replacer]) => prevSelector.replace(searchValue, replacer as any),
    firstSelector
  );
};
