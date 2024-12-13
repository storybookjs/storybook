import {
  createASTArrayExpression,
  createASTExpressionTag,
  type ESTreeAST,
  type SvelteAST,
} from '$lib/parser/ast';

interface Params {
  component: SvelteAST.Component;
  comment?: SvelteAST.Comment;
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
export function transformComponentMetaToDefineMeta(params: Params): ESTreeAST.VariableDeclaration {
  const { component, comment } = params;
  const { attributes, start, end } = component;

  let properties: ESTreeAST.ObjectExpression['properties'] = [];

  for (const attribute of attributes) {
    if (attribute.type === 'Attribute') {
      properties.push(attributeToObjectExpressionProperty(attribute));
    }
  }

  const firstArgument = {
    type: 'ObjectExpression',
    properties,
  } satisfies ESTreeAST.ObjectExpression;

  const key = {
    type: 'Identifier',
    name: 'Story',
  } satisfies ESTreeAST.Identifier;

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
): NonNullable<NonNullable<ESTreeAST.VariableDeclaration['leadingComments']>[number]> {
  const { data } = comment;

  return {
    type: 'Block',
    value: `*${data.replace(/\n/, '\n* ')}`,
  };
}

function attributeToObjectExpressionProperty(attribute: SvelteAST.Attribute): ESTreeAST.Property {
  const { name } = attribute;

  if (name === 'tags') {
    transformTags(attribute);
  }

  const key = {
    type: 'Identifier',
    name,
  } satisfies ESTreeAST.Identifier;

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

function attributeValueToPropertyValue(
  value: SvelteAST.Attribute['value']
): ESTreeAST.Property['value'] {
  if (value === true) {
    return {
      type: 'Literal',
      value: true,
    };
  }

  if (!Array.isArray(value)) {
    return value.expression;
  }

  if (value[0].type === 'Text') {
    return {
      type: 'Literal',
      value: value[0].raw,
    };
  }

  return value[0].expression;
}

function transformTags(tags: SvelteAST.Attribute): void {
  if (tags.value === true) {
    // NOTE: The error on invalid type (boolean) is likely visible
    // 1. via TypeScript
    // 2. and thrown by storybook internal, right?
    return;
  }

  // tags.value is SvelteAST.ExpressionTag
  if (!Array.isArray(tags.value)) {
    if (typeof tags.value.expression.value !== 'string') {
      // NOTE: The error on invalid type (not a string) is likely visible
      // 1. via TypeScript
      // 2. and thrown by storybook internal, right?
      return;
    }
    // NOTE: This is the only case so far where
    // we need to transform tags from singular string literal to an array expression - to align with CSF3 format
    tags.value.expression = createASTArrayExpression([tags.value.expression]);
    return;
  }

  if (tags.value[0].type === 'ExpressionTag' && tags.value[0].expression.type === 'Literal') {
    if (typeof tags.value[0].expression.value !== 'string') {
      // NOTE: The error on invalid type (not a string) is likely visible
      // 1. via TypeScript
      // 2. and thrown by storybook internal, right?
      return;
    }
    // NOTE: This is the only case so far where
    // we need to transform tags from singular string literal to an array expression - to align with CSF3 format
    tags.value = createASTExpressionTag(
      createASTArrayExpression([
        {
          type: 'Literal',
          value: tags.value[0].data,
        },
      ])
    );
    return;
  }

  if (tags.value[0].type === 'Text') {
    tags.value = createASTExpressionTag(
      createASTArrayExpression([
        {
          type: 'Literal',
          value: tags.value[0].data,
        },
      ])
    );
  }
}
