import type { Identifier, ObjectExpression, Property, VariableDeclaration } from 'estree';
import type { Attribute, Comment, Component } from 'svelte/compiler';

interface Params {
  component: Component;
  comment?: Comment;
}

/**
 * Codemod to transform AST node of `<Meta>` component to `defineMeta`
 *
 * @example
 * ```diff
 * - <Meta title="Atom/Button" component={Button} args={{ ... }} />
 * + const { Story } = defineMeta({
 * +   title: "Atom/Button",
 * +   component: Button,
 * +   args: { ... },
 * + });
 * ```
 */
export function transformComponentMetaToDefineMeta(params: Params): VariableDeclaration {
  const { component, comment } = params;
  const { attributes, start, end } = component;

  let properties: ObjectExpression['properties'] = [];

  for (const attribute of attributes) {
    if (attribute.type === 'Attribute') {
      properties.push(attributeToObjectExpressionProperty(attribute));
    }
  }

  const firstArgument = {
    type: 'ObjectExpression',
    properties,
  } satisfies ObjectExpression;

  const key = {
    type: 'Identifier',
    name: 'Story',
  } satisfies Identifier;

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        init: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'defineMeta',
          },
          arguments: [firstArgument],
          optional: false,
        },
        id: {
          type: 'ObjectPattern',
          properties: [
            {
              type: 'Property',
              kind: 'init',
              key,
              value: key,
              method: false,
              shorthand: true,
              computed: false,
            },
          ],
        },
      },
    ],
    leadingComments: comment ? [transformMetaCommentToBlockComment(comment)] : undefined,
    start,
    end,
  };
}

function transformMetaCommentToBlockComment(
  comment: NonNullable<Params['comment']>
): NonNullable<NonNullable<VariableDeclaration['leadingComments']>[number]> {
  const { data } = comment;

  return {
    type: 'Block',
    value: `*${data.replace(/\n/, '\n* ')}`,
  };
}

function attributeToObjectExpressionProperty(attribute: Attribute): Property {
  const { name } = attribute;

  const key = {
    type: 'Identifier',
    name,
  } satisfies Identifier;

  return {
    type: 'Property',
    kind: 'init',
    key,
    value: attributeValueToPropertyValue(attribute.value),
    shorthand: true,
    method: false,
    computed: false,
  };
}

function attributeValueToPropertyValue(value: Attribute['value']): Property['value'] {
  if (value === true) {
    return {
      type: 'Literal',
      value: true,
    };
  }

  if (value[0].type === 'Text') {
    return {
      type: 'Literal',
      value: value[0].raw,
    };
  }

  return value[0].expression;
}
