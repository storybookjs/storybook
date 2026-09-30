import type { ESTreeAST, SvelteAST } from '../../ast.ts';
import {
  AttributeNotArrayError,
  AttributeNotArrayOfStringsError,
  AttributeNotStringError,
} from '../../../utils/error/parser/analyse/story.ts';

interface Params {
  node: SvelteAST.Attribute | undefined;
  filename?: string;
  component: SvelteAST.Component;
}

// Returns the value of a static attribute. A single `{literal}` expression returns the literal's
// value as is, which isn't always a string (for example `exportName={null}`).
export function getLiteralValueFromAttribute(
  params: Params
): ESTreeAST.Literal['value'] | undefined {
  const { node, filename, component } = params;

  if (!node) {
    return;
  }

  const { value } = node;

  if (value === true) {
    throw new AttributeNotStringError({ filename, component, attribute: node });
  }

  if (!Array.isArray(value)) {
    if (value.expression.type === 'Literal') {
      return value.expression.value;
    }

    throw new AttributeNotStringError({ filename, component, attribute: node });
  }

  const [first] = value;

  if (first.type === 'Text') {
    return first.data;
  }

  if (
    first.type === 'ExpressionTag' &&
    first.expression.type === 'Literal' &&
    typeof first.expression.value === 'string'
  ) {
    return first.expression.value;
  }

  throw new AttributeNotStringError({ filename, component, attribute: node });
}

export function getStringValueFromAttribute(params: Params): string | undefined {
  const { node, filename, component } = params;

  if (!node) {
    return;
  }

  const value = getLiteralValueFromAttribute(params);

  if (typeof value !== 'string') {
    throw new AttributeNotStringError({ filename, component, attribute: node });
  }

  return value;
}

// For attributes where a falsy literal (`{null}`, `{0}`, `{false}`) means "not set".
export function getOptionalStringValueFromAttribute(params: Params): string | undefined {
  const { node, filename, component } = params;
  const value = getLiteralValueFromAttribute(params);

  if (typeof value === 'string') {
    return value;
  }

  if (!node || !value) {
    return undefined;
  }

  throw new AttributeNotStringError({ filename, component, attribute: node });
}

export function getArrayOfStringsValueFromAttribute(params: Params) {
  const { node, filename, component } = params;

  if (!node) {
    return [];
  }

  const { value } = node;

  if (value === true) {
    throw new AttributeNotArrayError({
      component,
      filename,
      attribute: node,
    });
  }

  // value is SvelteAST.ExpressionTag
  if (!Array.isArray(value)) {
    if (value.expression.type !== 'ArrayExpression') {
      throw new AttributeNotArrayError({
        component,
        filename,
        attribute: node,
      });
    }

    const arrayOfStrings: string[] = [];

    for (const element of value.expression.elements) {
      if (element?.type !== 'Literal' || typeof element.value !== 'string') {
        throw new AttributeNotArrayOfStringsError({
          filename,
          component,
          attribute: node,
          element,
        });
      }

      arrayOfStrings.push(element.value);
    }

    return arrayOfStrings;
  }

  // value is Array<SvelteAST.ExpressionTag | SvelteAST.Text> - I haven't figured out when it would happen
  if (value[0].type !== 'ExpressionTag' || value[0].expression.type !== 'ArrayExpression') {
    throw new AttributeNotArrayError({
      component,
      filename,
      attribute: node,
    });
  }

  const arrayOfStrings: string[] = [];

  for (const element of value[0].expression.elements) {
    if (element?.type !== 'Literal' || typeof element.value !== 'string') {
      throw new AttributeNotArrayOfStringsError({
        filename,
        component,
        attribute: node,
        element,
      });
    }

    arrayOfStrings.push(element.value);
  }

  return arrayOfStrings;
}
