import dedent from 'dedent';
import type { Attribute } from 'svelte/compiler';

import { StorybookSvelteCSFError } from '#utils/error';
import type { ArrayExpression, Literal } from 'estree';

export class AttributeNotStringError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 1;

  public attribute: Attribute;

  constructor({
    filename,
    attribute,
    component,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    component: NonNullable<StorybookSvelteCSFError['component']>;
    attribute: AttributeNotStringError['attribute'];
  }) {
    super({ component, filename });
    this.attribute = attribute;
  }

  template(): string {
    return dedent`
      Invalid schema.
      In the stories file: ${this.filepathURL}

      A '${this.quickStoryRawCodeIdentifier}' has an attribute '${this.attribute.name}' whose value was expected to be a static literal string.

      Any dynamic values are not currently supported.
    `;
  }
}

export class AttributeNotArrayError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 2;

  public attribute: Attribute;

  constructor({
    filename,
    attribute,
    component,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    component: NonNullable<StorybookSvelteCSFError['component']>;
    attribute: AttributeNotStringError['attribute'];
  }) {
    super({ component, filename });
    this.attribute = attribute;
  }

  get valueType() {
    const { value } = this.attribute;
    if (value === true) {
      return true;
    }
    if (value[0].type === 'Text') {
      return value[0].data;
    }

    return (value[0].expression as Literal).value;
  }

  template(): string {
    return dedent`
      Invalid schema.
      In the stories file: ${this.filepathURL}

        A '${this.quickStoryRawCodeIdentifier}' has attribute '${this.attribute.name}' whose value was expected to be an array expression.
        Instead the value type is '${this.valueType}'.
    `;
  }
}

export class AttributeNotArrayOfStringsError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 3;

  public attribute: Attribute;
  public element: ArrayExpression['elements'][number];

  constructor({
    filename,
    attribute,
    component,
    element,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    component: NonNullable<StorybookSvelteCSFError['component']>;
    attribute: AttributeNotArrayOfStringsError['attribute'];
    element: AttributeNotArrayOfStringsError['element'];
  }) {
    super({ component, filename });
    this.attribute = attribute;
    this.element = element;
  }

  get valueType() {
    const { value } = this.attribute;
    if (value === true) {
      return true;
    }
    if (value[0].type === 'Text') {
      return value[0].data;
    }

    return (value[0].expression as Literal).value;
  }

  template(): string {
    return dedent`
      Invalid schema.
      In the stories file: ${this.filepathURL}

      A '${this.quickStoryRawCodeIdentifier}' has attribute '${this.attribute.name}' whose value was expected to be an array expression.
      And this array elements are supposed to be static literal strings only.
      One of the elements has a type '${this.valueType}'
    `;
  }
}
