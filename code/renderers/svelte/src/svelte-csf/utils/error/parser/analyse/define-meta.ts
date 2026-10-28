import type * as ESTreeAST from 'estree';
import { dedent } from 'ts-dedent';

import { DOCS, StorybookSvelteCSFError, filepathURL } from '../../../error.ts';

const category = StorybookSvelteCSFError.CATEGORY.parserAnalyseDefineMeta;

const propertyName = (property: ESTreeAST.Property) => (property.key as ESTreeAST.Identifier).name;

export class InvalidComponentValueError extends StorybookSvelteCSFError {
  constructor({
    filename,
    componentProperty,
  }: {
    filename?: string;
    componentProperty: ESTreeAST.Property;
  }) {
    super({
      name: 'InvalidComponentValueError',
      category,
      code: 1,
      documentation: DOCS.meta,
      message: dedent`
        The 'component' property of 'defineMeta' must reference an imported Svelte component.
        The current type of the property is '${componentProperty.value.type}'.
        For example: defineMeta({ component: Button }) or defineMeta({ component: Input.Select }), with Button or Input imported.
        Computed access such as Input['Select'], deeper chains such as Input.Group.Item, and expressions on 'this' are not supported.

        The issue occurred in Stories file: ${filepathURL(filename)}
      `,
    });
  }
}

export class NoDestructuredDefineMetaCallError extends StorybookSvelteCSFError {
  constructor({
    filename,
    defineMetaVariableDeclarator,
  }: {
    filename?: string;
    defineMetaVariableDeclarator: ESTreeAST.VariableDeclarator;
  }) {
    super({
      name: 'NoDestructuredDefineMetaCallError',
      category,
      code: 2,
      documentation: DOCS.meta,
      message: dedent`
        The return value of the 'defineMeta' call was not destructured to { Story }.
        The issue occurred in Stories file: ${filepathURL(filename)}

        The current pattern type is: "${defineMetaVariableDeclarator.id.type}", and expected is "ObjectPattern".
        For example: const { Story } = defineMeta({ ... });
      `,
    });
  }
}

export class NoStringLiteralError extends StorybookSvelteCSFError {
  constructor({ filename, property }: { filename?: string; property: ESTreeAST.Property }) {
    super({
      name: 'NoStringLiteralError',
      category,
      code: 3,
      documentation: DOCS.meta,
      message: dedent`
        The '${propertyName(property)}' passed to 'defineMeta()' must be a static string literal.
        But it is of type '${property.value.type}'.
        Dynamic values, such as variables, function calls or template strings, are not supported.

        This issue occurred in stories file: ${filepathURL(filename)}
      `,
    });
  }
}

export class NoArrayExpressionError extends StorybookSvelteCSFError {
  constructor({ filename, property }: { filename?: string; property: ESTreeAST.Property }) {
    super({
      name: 'NoArrayExpressionError',
      category,
      code: 4,
      documentation: DOCS.tags,
      message: dedent`
        The '${propertyName(property)}' passed to 'defineMeta()' must be a static array.
        But it is of type '${property.value.type}'.
        For example: defineMeta({ ${propertyName(property)}: ['autodocs', '!dev'] })

        This issue occurred in stories file: ${filepathURL(filename)}
      `,
    });
  }
}

export class ArrayElementNotStringError extends StorybookSvelteCSFError {
  constructor({
    filename,
    property,
    element,
  }: {
    filename?: string;
    property: ESTreeAST.Property;
    element: ESTreeAST.ArrayExpression['elements'][number];
  }) {
    super({
      name: 'ArrayElementNotStringError',
      category,
      code: 5,
      documentation: DOCS.tags,
      message: dedent`
        All entries in the '${propertyName(property)}' property passed to 'defineMeta()' must be static strings.
        One of the elements is not a string but is instead of type '${element?.type}'.
        For example: defineMeta({ ${propertyName(property)}: ['autodocs', '!dev'] })

        This issue occurred in stories file: ${filepathURL(filename)}
      `,
    });
  }
}

export class InvalidRenderValueError extends StorybookSvelteCSFError {
  constructor({
    filename,
    renderProperty,
  }: {
    filename?: string;
    renderProperty: ESTreeAST.Property;
  }) {
    super({
      name: 'InvalidRenderValueError',
      category,
      code: 6,
      documentation: DOCS.customRendering,
      message: dedent`
        The 'render' property of 'defineMeta' must reference a root-level Svelte snippet.
        The current type of the property is '${renderProperty.value.type}'.
        For example: defineMeta({ render: template }), with {#snippet template(args)} ... {/snippet} at the root of the stories file.

        The issue occurred in Stories file: ${filepathURL(filename)}
      `,
    });
  }
}
