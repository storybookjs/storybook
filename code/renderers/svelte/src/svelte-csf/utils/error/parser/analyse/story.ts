import dedent from 'dedent';

import type { getStoryIdentifiers } from '#parser/analyse/story/attributes/identifiers';
import type { ESTreeAST, SvelteAST } from '#parser/ast';
import { StorybookSvelteCSFError } from '#utils/error';

export class AttributeNotStringError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 1;
  public documentation = true;

  public attribute: SvelteAST.Attribute;

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
      In the stories file: ${this.filepathURL}

      A '${this.quickStoryRawCodeIdentifier}' has a prop '${this.attribute.name}' whose value must be a static literal string.
    `;
  }
}

export class AttributeNotArrayError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 2;
  public documentation = true;

  public attribute: SvelteAST.Attribute;

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
    const { attribute } = this;
    const { value } = attribute;

    if (value === true) {
      return true;
    }

    // value is SvelteAST.ExpressionTag
    if (!Array.isArray(value)) {
      return (value.expression as ESTreeAST.Literal).value;
    }

    if (value[0].type === 'Text') {
      return value[0].data;
    }

    return (value[0].expression as ESTreeAST.Literal).value;
  }

  template(): string {
    return dedent`
      In the stories file: ${this.filepathURL}

      A '${this.quickStoryRawCodeIdentifier}' has a prop'${this.attribute.name}' whose value was expected to be a static array.
      Instead the value type is '${this.valueType}'.
    `;
  }
}

export class AttributeNotArrayOfStringsError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 3;
  public documentation = true;

  public attribute: SvelteAST.Attribute;
  public element: ESTreeAST.ArrayExpression['elements'][number];

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
    const { attribute } = this;
    const { value } = attribute;

    if (value === true) {
      return true;
    }

    if (!Array.isArray(value)) {
      return (value.expression as ESTreeAST.Literal).value;
    }

    if (value[0].type === 'Text') {
      return value[0].data;
    }

    return (value[0].expression as ESTreeAST.Literal).value;
  }

  template(): string {
    return dedent`
      In the stories file: ${this.filepathURL}

      A '${this.quickStoryRawCodeIdentifier}' has attribute '${this.attribute.name}' whose value was expected to be an array expression.
      All elements in the array must be static literal strings only, but one of the elements is of type '${this.valueType}'.
    `;
  }
}

export class NoStoryIdentifierError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 4;
  public documentation = true;

  constructor({
    filename,
    component,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    component: NonNullable<StorybookSvelteCSFError['component']>;
  }) {
    super({ component, filename });
  }

  template(): string {
    return dedent`
        Missing 'name' or 'exportName' attribute (prop) in a '<Story />' definition in the stories file:  '${this.filepathURL}'.
        All stories must either have a 'name' or an 'exportName' prop, or both.
    `;
  }
}

export class InvalidStoryExportNameError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 5;
  public documentation = true;

  public value: string;

  constructor({
    filename,
    component,
    value,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    component: NonNullable<StorybookSvelteCSFError['component']>;
    value: InvalidStoryExportNameError['value'];
  }) {
    super({ component, filename });
    this.value = value;
  }

  template(): string {
    return dedent`
		Invalid attribute 'exportName' value '${this.value}' found in '<Story />' component inside stories file: ${this.filepathURL}

    'exportName' value must be a valid JavaScript variable name.
    It must start with a letter, $ or _, followed by letters, numbers, $ or _.
    Reserved words like 'default' are also not allowed (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words)
    `;
  }
}

export class DuplicateStoryIdentifiersError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseStory;
  readonly code = 6;
  public documentation = true;

  public identifiers: ReturnType<typeof getStoryIdentifiers>;
  public duplicateIdentifiers: NonNullable<ReturnType<typeof getStoryIdentifiers>>;

  constructor({
    filename,
    identifiers,
    duplicateIdentifiers,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    identifiers: DuplicateStoryIdentifiersError['identifiers'];
    duplicateIdentifiers: DuplicateStoryIdentifiersError['duplicateIdentifiers'];
  }) {
    super({ filename });
    this.identifiers = identifiers;
    this.duplicateIdentifiers = duplicateIdentifiers;
  }

  template(): string {
    return dedent`
      Duplicate exportNames found between two '<Story />' definitions in stories file: ${this.filepathURL}

      First instance: <Story name=${this.duplicateIdentifiers.name ? `"${this.duplicateIdentifiers.name}"` : '{undefined}'} exportName="${this.duplicateIdentifiers.exportName}" ... />
      Second instance: <Story name=${this.identifiers.name ? `"${this.identifiers.name}"` : '{undefined}'} exportName="${this.identifiers.exportName}" ... />

      This can happen when 'exportName' is implicitly derived by 'name'.
      Complex names will be simplified to a PascalCased, valid JavaScript variable name,
      eg. 'Some story name!!' will be converted to 'SomeStoryName'.
      You can fix this collision by providing a unique 'exportName' prop with <Story exportName="SomeUniqueExportName" ... />.
    `;
  }
}
