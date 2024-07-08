import type { ArrayExpression, Identifier, Literal, ObjectExpression } from 'estree';
import type {
  Attribute,
  Component,
  ExpressionTag,
  Fragment,
  LetDirective,
  SnippetBlock,
} from 'svelte/compiler';

import {
  createASTAttribute,
  createASTExpressionTag,
  createASTObjectExpression,
  createASTProperty,
} from '#parser/ast';

export function transformLegacyStory(component: Component): Component {
  let { attributes, fragment, ...rest } = component;

  let newAttributes: Component['attributes'] = [];
  let autodocs: Attribute | undefined;
  let source: Attribute | undefined;
  let parameters: Attribute | undefined;
  let tags: Attribute | undefined;
  let letDirectiveArgs: LetDirective | undefined;
  let letDirectiveContext: LetDirective | undefined;

  for (let attribute of attributes) {
    if (attribute.type === 'LetDirective' && attribute.name === 'args') {
      letDirectiveArgs = attribute;
      continue;
    }
    if (attribute.type === 'LetDirective' && attribute.name === 'context') {
      letDirectiveContext = attribute;
      continue;
    }

    if (attribute.type === 'Attribute' && attribute.name === 'autodocs') {
      autodocs = attribute;
      continue;
    }

    if (attribute.type === 'Attribute' && attribute.name === 'source') {
      const { value } = attribute;
      if (value === true) continue;
      source = attribute;
      continue;
    }

    if (attribute.type === 'Attribute' && attribute.name === 'parameters') {
      const { value } = attribute;
      if (value === true || value[0].type === 'Text') continue; // WARN: Invalid syntax (shorthand or text expression), but lets move on
      parameters = attribute;
      continue;
    }

    if (attribute.type === 'Attribute' && attribute.name === 'tags') {
      const { value } = attribute;
      if (value === true || value[0].type === 'Text') continue; // WARN: Invalid syntax (shorthand or text expression), but lets move on
      tags = attribute;
      continue;
    }

    if (attribute.type === 'Attribute' && attribute.name === 'template') {
      attribute = templateToChildren(attribute);
    }

    newAttributes.push(attribute);
  }

  if (autodocs) {
    transformAutodocs({
      autodocs,
      tags,
      newAttributes,
    });
  }

  if (source) {
    transformSource({
      source,
      parameters,
      newAttributes,
    });
  }

  if (letDirectiveArgs || letDirectiveContext) {
    fragment = transformFragment({
      letDirectiveArgs,
      letDirectiveContext,
      fragment,
    });
  }

  return {
    ...rest,
    attributes: newAttributes,
    fragment,
  };
}

interface InsertAutodocsParams {
  autodocs?: Attribute;
  tags?: Attribute;
  newAttributes: Component['attributes'];
}
function transformAutodocs(params: InsertAutodocsParams): void {
  let { autodocs, tags, newAttributes } = params;

  if (!autodocs) {
    return;
  }

  if (!tags) {
    tags = createASTAttribute('tags', [
      createASTExpressionTag({
        type: 'ArrayExpression',
        elements: [],
      }),
    ]);
  }

  const autodocsLiteral = {
    type: 'Literal',
    value: 'autodocs',
  } satisfies Literal;

  ((tags?.value as ExpressionTag[])[0].expression as ArrayExpression).elements.push(
    autodocsLiteral
  );
  newAttributes.push(tags);
}

interface InsertSourceParams {
  source?: Attribute;
  parameters?: Attribute;
  newAttributes: Component['attributes'];
}
function transformSource(params: InsertSourceParams): void {
  let { source, parameters, newAttributes } = params;

  if (!source) return;

  const value = getSourceValue(source);

  if (!value) return;

  const codeLiteralValue = {
    type: 'Literal',
    value,
  } satisfies Literal;

  if (!parameters) {
    parameters = createASTAttribute('parameters', [
      createASTExpressionTag(createASTObjectExpression()),
    ]);
  }

  let docsProperty = (
    (parameters.value as ExpressionTag[])[0].expression as ObjectExpression
  ).properties.find(
    (property) => property.type === 'Property' && (property.key as Identifier).name === 'docs'
  );

  if (!docsProperty) {
    docsProperty = createASTProperty('docs', createASTObjectExpression());
  }

  let sourceProperty = (docsProperty.value as ObjectExpression).properties.find(
    (property) => property.type === 'Property' && (property.key as Identifier).name === 'source'
  );

  if (!sourceProperty) {
    sourceProperty = createASTProperty('source', createASTObjectExpression());
  }

  let codeProperty = (sourceProperty.value as ObjectExpression).properties.find(
    (property) => property.type === 'Property' && (property.key as Identifier).name === 'code'
  );

  if (!codeProperty) {
    codeProperty = createASTProperty('code', codeLiteralValue);
    (sourceProperty.value as ObjectExpression).properties.push(codeProperty);
    (docsProperty.value as ObjectExpression).properties.push(sourceProperty);
    ((parameters.value as ExpressionTag[])[0].expression as ObjectExpression).properties.push(
      docsProperty
    );
  } else {
    // TODO: Create a warning?
  }

  newAttributes.push(parameters);
}

function getSourceValue(attribute: Attribute): string | undefined {
  const { value } = attribute;

  if (value[0].type === 'ExpressionTag' && value[0].expression.type === 'Literal') {
    return value[0].expression.value as string;
  }

  if (value[0].type === 'Text') {
    return value[0].raw;
  }
}

function templateToChildren(attribute: Attribute): Attribute {
  const { name, value, ...rest } = attribute;

  if (value === true) {
    // TODO: Improve error message
    throw new Error('');
  }

  return {
    ...rest,
    name: 'children',
    value: [
      createASTExpressionTag({
        type: 'Identifier',
        // TODO: Transform name to be snakeCase or valid JavaScript syntax for naming variables
        name:
          value[0].type === 'Text'
            ? value[0].data
            : ((value[0].expression as Literal).value as string),
      }),
    ],
  };
}

interface TransformTemplateParams {
  letDirectiveArgs?: LetDirective;
  letDirectiveContext?: LetDirective;
  fragment: Fragment;
}
function transformFragment(params: TransformTemplateParams): Fragment {
  let { letDirectiveArgs, letDirectiveContext, fragment } = params;

  let parameters: SnippetBlock['parameters'] = [
    {
      type: 'Identifier',
      name: letDirectiveArgs ? 'args' : '_args',
    },
  ];

  if (letDirectiveContext) {
    parameters.push({
      type: 'Identifier',
      name: 'context',
    });
  }

  const snippetBlock = {
    type: 'SnippetBlock',
    body: fragment,
    expression: {
      type: 'Identifier',
      name: 'children',
    },
    parameters,
    // TODO: Those are useless at this point, but I needed TypeScript to 🤫
    // Reference: https://github.com/sveltejs/svelte/issues/12292
    start: 0,
    end: 0,
    parent: null,
  } satisfies SnippetBlock;

  return {
    ...fragment,
    nodes: [snippetBlock],
  };
}
