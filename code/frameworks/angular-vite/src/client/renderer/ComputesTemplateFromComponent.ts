import type { ArgTypes } from 'storybook/internal/types';

import type { Type } from '@angular/core';

import {
  buildComponentOutletTemplate,
  buildTemplate,
  formatInputValue,
  formatPropInTemplate,
} from '../../template-grammar.ts';
import type { ICollection } from '../types.ts';
import type { ComponentInputsOutputs } from './utils/NgComponentAnalyzer.ts';
import {
  getComponentDecoratorMetadata,
  getComponentInputsOutputs,
} from './utils/NgComponentAnalyzer.ts';

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

const renderOutputBindings = (outputs: string[]) =>
  outputs.length > 0
    ? ` ${outputs.map((i) => `(${i})="${formatPropInTemplate(i)}($event)"`).join(' ')}`
    : '';

/**
 * Converts a component into a template with inputs/outputs present in initial props
 *
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

  return buildTemplate(ngComponentMetadata.selector, {
    inputs: templateInputs,
    outputs: renderOutputBindings(initialOutputs),
    innerTemplate,
  });
};

/**
 * Converts a component into a template with inputs/outputs present in initial props
 *
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
    return buildComponentOutletTemplate(component.name);
  }

  const ngComponentInputsOutputs = getComponentInputsOutputs(component);
  const { inputs: initialInputs, outputs: initialOutputs } = separateInputsOutputsAttributes(
    ngComponentInputsOutputs,
    initialProps
  );

  const templateInputs =
    initialInputs.length > 0
      ? ` ${initialInputs
          .map(
            (propertyName) => `[${propertyName}]="${formatInputValue(initialProps[propertyName])}"`
          )
          .join(' ')}`
      : '';

  return buildTemplate(ngComponentMetadata.selector, {
    inputs: templateInputs,
    outputs: renderOutputBindings(initialOutputs),
  });
};
