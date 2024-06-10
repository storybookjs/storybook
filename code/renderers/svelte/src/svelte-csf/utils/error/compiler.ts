import dedent from 'dedent';
import type { Property } from 'estree';

import { StorybookSvelteCSFError } from '#utils/error';

export class ParametersNotObjectExpressionError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.compiler;
  readonly code = 1;
  readonly documentation = 'https://storybook.js.org/docs/writing-stories/parameters';

  public property: Property;

  constructor({
    filename,
    component,
    property,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    component: StorybookSvelteCSFError['component'];
    property: ParametersNotObjectExpressionError['property'];
  }) {
    super({ filename, component });
    this.property = property;
  }

  template() {
    if (this.component) {
      return dedent`
      Invalid schema.
      Expected '${this.quickStoryRawCodeIdentifier}' attribute 'parameters' value to be an object expression.
      Instead it was '${this.property.value.type}'

      This issue occured in the stories file: ${this.filepathURL}
    `;
    }

    return `
      Invalid schema.
      Expected 'defineMeta' property 'parameters' value to be an object expression.
      Instead it was '${this.property.value.type}'

      This issue occured in the stories file: ${this.filepathURL}
   `;
  }
}

export class DocsNotObjectExpressionError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.compiler;
  readonly code = 2;

  public property: Property;

  constructor({
    filename,
    component,
    property,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    component: StorybookSvelteCSFError['component'];
    property: DocsNotObjectExpressionError['property'];
  }) {
    super({ filename, component });
    this.property = property;
  }

  template() {
    if (this.component) {
      return dedent`
      Invalid schema.
      Expected '${this.quickStoryRawCodeIdentifier}' property 'parameters.docs' value to be an object expression.
      Instead it was '${this.property.value.type}'

      This issue occured in the stories file: ${this.filepathURL}
    `;
    }

    return `
      Invalid schema.
      Expected 'defineMeta' property 'parameters.docs' value to be an object expression.
      Instead it was '${this.property.value.type}'

      This issue occured in the stories file: ${this.filepathURL}
   `;
  }
}

export class DescriptionNotObjectExpressionError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.compiler;
  readonly code = 3;

  public property: Property;

  constructor({
    filename,
    component,
    property,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    component: StorybookSvelteCSFError['component'];
    property: DescriptionNotObjectExpressionError['property'];
  }) {
    super({ filename, component });
    this.property = property;
  }

  template() {
    if (this.component) {
      return dedent`
      Invalid schema.
      Expected '${this.quickStoryRawCodeIdentifier}' property 'parameters.docs.description' value to be an object expression.
      Instead it was '${this.property.value.type}'

      This issue occured in the stories file: ${this.filepathURL}
    `;
    }

    return `
      Invalid schema.
      Expected 'defineMeta' property 'parameters.docs.description' value to be an object expression.
      Instead it was '${this.property.value.type}'

      This issue occured in the stories file: ${this.filepathURL}
   `;
  }
}
