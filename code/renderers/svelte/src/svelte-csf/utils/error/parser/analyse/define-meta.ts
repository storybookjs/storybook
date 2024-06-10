import { StorybookSvelteCSFError } from '#utils/error';
import dedent from 'dedent';
import type { ArrayExpression, Identifier, Property, VariableDeclarator } from 'estree';

export class InvalidComponentValueError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 1;

  public componentProperty: Property;

  constructor({
    filename,
    componentProperty,
  }: {
    filename: StorybookSvelteCSFError['storiesFilename'];
    componentProperty: InvalidComponentValueError['componentProperty'];
  }) {
    super({ filename });
    this.componentProperty = componentProperty;
  }

  template(): string {
    return dedent`
      Invalid schema.

      'defineMeta's property with key 'component' value should be an identifier to Svelte component import specifier.
      The current type is '${this.componentProperty.value.type}'.

      The issue occured in Stories file: ${this.filepathURL}
    `;
  }
}

export class NoDestructuredDefineMetaCallError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 2;

  public defineMetaVariableDeclarator: VariableDeclarator;

  constructor({
    filename,
    defineMetaVariableDeclarator,
  }: {
    filename: StorybookSvelteCSFError['storiesFilename'];
    defineMetaVariableDeclarator: NoDestructuredDefineMetaCallError['defineMetaVariableDeclarator'];
  }) {
    super({ filename });
    this.defineMetaVariableDeclarator = defineMetaVariableDeclarator;
  }

  template(): string {
    return dedent`
      Invalid schema.

      Storybook addon "${StorybookSvelteCSFError.packageName}" tried to access destructured object pattern from a variable declaration with 'defineMeta()' call.
      The issue occured in Stories file: ${this.filepathURL}

      The current pattern type is: "${this.defineMetaVariableDeclarator.id.type}", and expected is "ObjectPattern".

      Please verify if you're using the following syntax:

      const { Story } = defineMeta({ /* ... */ });
    `;
  }
}

export class NoMetaIdentifierFoundError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 3;

  constructor(filename: StorybookSvelteCSFError['storiesFilename']) {
    super({ filename });
  }

  template(): string {
    return dedent`
			Could not find 'meta' identifier in the compiled output of stories file: ${this.filepathURL}

      This is most likely a bug in the parser of addon - "${StorybookSvelteCSFError.packageName}".

      If you see this error, please report it using the link below:
      https://github.com/storybookjs/addon-svelte-csf/issues/new

      While you create an issue, please provide original code,
      it will help us invegistate the occured issue better.
    `;
  }
}

export class NoStringLiteralError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 4;

  readonly property: Property;

  constructor({
    filename,
    property,
  }: {
    filename: StorybookSvelteCSFError['storiesFilename'];
    property: NoStringLiteralError['property'];
  }) {
    super({ filename });
    this.property = property;
  }

  template(): string {
    return dedent`
      Invalid schema.

      'defineMeta()' first argument object property '${(this.property.key as Identifier).name}' value is supposed to be a static string literal.
      Instead it has a type '${this.property.value.type}'.

      This issue occured in stories file: ${this.filepathURL}
    `;
  }
}

export class NoArrayExpressionError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 5;

  readonly property: Property;

  constructor({
    filename,
    property,
  }: {
    filename: StorybookSvelteCSFError['storiesFilename'];
    property: NoArrayExpressionError['property'];
  }) {
    super({ filename });
    this.property = property;
  }

  template(): string {
    return dedent`
      Invalid schema.

      'defineMeta()' first argument object property '${(this.property.key as Identifier).name}' value is supposed to be an array expression.
      Instead it has a type '${this.property.value.type}'.

      This issue occured in stories file: ${this.filepathURL}
    `;
  }
}

export class ArrayElementNotStringError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 6;

  readonly property: Property;
  readonly element: ArrayExpression['elements'][number];

  constructor({
    filename,
    property,
    element,
  }: {
    filename: StorybookSvelteCSFError['storiesFilename'];
    property: ArrayElementNotStringError['property'];
    element: ArrayElementNotStringError['element'];
  }) {
    super({ filename });
    this.element = element;
    this.property = property;
  }

  template(): string {
    return dedent`
      Invalid schema.

      'defineMeta()' first argument object property '${(this.property.key as Identifier).name}' value is supposed to be an array with only static string literals.
      One of the elements is not a string. Instead it has a type '${this.element?.type}'.

      This issue occured in stories file: ${this.filepathURL}
    `;
  }
}
