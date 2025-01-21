import { StorybookSvelteCSFError } from '$lib/utils/error.js';
import dedent from 'dedent';
import type * as ESTreeAST from 'estree';

export class InvalidComponentValueError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 1;
  public documentation = true;

  public componentProperty: ESTreeAST.Property;

  constructor({
    filename,
    componentProperty,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    componentProperty: InvalidComponentValueError['componentProperty'];
  }) {
    super({ filename });
    this.componentProperty = componentProperty;
  }

  template(): string {
    return dedent`
      The 'component' property of 'defineMeta' must reference an imported Svelte component.
      The current type of the property is '${this.componentProperty.value.type}'.

      The issue occurred in Stories file: ${this.filepathURL}
    `;
  }
}

export class NoDestructuredDefineMetaCallError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 2;
  public documentation = true;

  public node: ESTreeAST.VariableDeclarator;

  constructor({
    filename,
    defineMetaVariableDeclarator,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    defineMetaVariableDeclarator: NoDestructuredDefineMetaCallError['node'];
  }) {
    super({ filename });
    this.node = defineMetaVariableDeclarator;
  }

  template(): string {
    return dedent`
      The return value of the 'defineMeta' call was not destructured to { Story }.
      The issue occurred in Stories file: ${this.filepathURL}

      The current pattern type is: "${this.node.id.type}", and expected is "ObjectPattern".
    `;
  }
}

export class NoStringLiteralError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 3;
  public documentation = true;

  readonly property: ESTreeAST.Property;

  constructor({
    filename,
    property,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    property: NoStringLiteralError['property'];
  }) {
    super({ filename });
    this.property = property;
  }

  template(): string {
    return dedent`
      The '${(this.property.key as ESTreeAST.Identifier).name}' passed to 'defineMeta()' must be a static string literal.
      But it is of type '${this.property.value.type}'.

      This issue occurred in stories file: ${this.filepathURL}
    `;
  }
}

export class NoArrayExpressionError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 4;
  public documentation = true;

  readonly property: ESTreeAST.Property;

  constructor({
    filename,
    property,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    property: NoArrayExpressionError['property'];
  }) {
    super({ filename });
    this.property = property;
  }

  template(): string {
    return dedent`
      The '${(this.property.key as ESTreeAST.Identifier).name}' passed to 'defineMeta()' must be a static array.
      But it is of type '${this.property.value.type}'.

      This issue occurred in stories file: ${this.filepathURL}
    `;
  }
}

export class ArrayElementNotStringError extends StorybookSvelteCSFError {
  readonly category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;
  readonly code = 5;
  public documentation = true;

  readonly property: ESTreeAST.Property;
  readonly element: ESTreeAST.ArrayExpression['elements'][number];

  constructor({
    filename,
    property,
    element,
  }: {
    filename: StorybookSvelteCSFError['filename'];
    property: ArrayElementNotStringError['property'];
    element: ArrayElementNotStringError['element'];
  }) {
    super({ filename });
    this.element = element;
    this.property = property;
  }

  template(): string {
    return dedent`
      All entries in the '${(this.property.key as ESTreeAST.Identifier).name}' property passed to 'defineMeta()' must be static strings.
      One of the elements is not a string but is instead of type '${this.element?.type}'.

      This issue occurred in stories file: ${this.filepathURL}
    `;
  }
}
