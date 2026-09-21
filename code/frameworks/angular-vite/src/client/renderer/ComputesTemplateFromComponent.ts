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
) => ({
  inputs: ngComponentInputsOutputs.inputs
    .filter((i) => i.templateName in props)
    .map((i) => i.templateName),
  outputs: ngComponentInputsOutputs.outputs
    .filter((o) => o.templateName in props)
    .map((o) => o.templateName),
});

/** Converts a component into a template with inputs/outputs present in initial props. */
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

  const { inputs, outputs } = separateInputsOutputsAttributes(
    ngComponentInputsOutputs,
    initialProps
  );

  return buildTemplate(ngComponentMetadata.selector, {
    inputs: inputs.map((name) => ({ name, expression: formatPropInTemplate(name) })),
    outputs,
    innerTemplate,
  });
};

/** Renders a component's story source snippet with arg values bound inline. */
export const computesTemplateSourceFromComponent = (
  component: Type<unknown>,
  initialProps?: ICollection
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
  const { inputs, outputs } = separateInputsOutputsAttributes(
    ngComponentInputsOutputs,
    initialProps
  );

  return buildTemplate(ngComponentMetadata.selector, {
    inputs: inputs.map((name) => ({ name, expression: formatInputValue(initialProps?.[name]) })),
    outputs,
  });
};
