import type { ObjectExpression, Property, Statement } from 'estree';
import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';

import {
  createASTObjectExpression,
  createASTProperty,
  findASTPropertyIndex,
} from './story-props/shared.js';
import { insertDescriptionStory } from './story-props/insert-description.js';
import { insertSourceCode } from './story-props/insert-source-code.js';

import type { extractStoriesNodesFromExportDefaultFn } from '../../parser/extract/compiled/stories.js';
import type { SvelteASTNodes } from '../../parser/extract/svelte/nodes.js';

interface Params {
  code: MagicString;
  componentASTNodes: {
    svelte: SvelteASTNodes['storyComponents'][number];
    compiled: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];
  };
  svelteASTNodes: SvelteASTNodes;
  filename: string;
  originalCode: string;
}

export function updateCompiledStoryProps(params: Params) {
  const { code, svelteASTNodes, componentASTNodes, filename, originalCode } = params;
  const { svelte, compiled } = componentASTNodes;
  const { component, comment } = svelte;

  const storyPropsObjectExpression = getStoryPropsObjectExpression(compiled);

  // Will need to check twice, because of scenario:
  // Index of the AST property was not found - then we create a new AST property.
  // After that, we need to check again to get the index of newly created AST node - property.
  const findPropertyParametersIndex = () =>
    findASTPropertyIndex('parameters', storyPropsObjectExpression);

  if (findPropertyParametersIndex() === -1) {
    storyPropsObjectExpression.properties.push(
      createASTProperty('parameters', createASTObjectExpression())
    );
  }

  const currentParametersProperty = storyPropsObjectExpression.properties[
    findPropertyParametersIndex()
  ] as Property;

  if (currentParametersProperty.value.type !== 'ObjectExpression') {
    throw new Error('Invalid schema');
  }

  // Will need to check twice, because of scenario:
  // Index of the AST property was not found - thwn we create o new AST property.
  // After that, we need to check again to get the index of newly created AST node - property.
  const findPropertyDocsIndex = () =>
    findASTPropertyIndex('docs', currentParametersProperty.value as ObjectExpression);

  if (findPropertyDocsIndex() === -1) {
    currentParametersProperty.value.properties.push(
      createASTProperty('docs', createASTObjectExpression())
    );
  }

  const currentDocsProperty = currentParametersProperty.value.properties[
    findPropertyDocsIndex()
  ] as Property;

  if (currentDocsProperty.value.type !== 'ObjectExpression') {
    throw new Error('Invalid schema');
  }

  if (comment) {
    insertDescriptionStory({ comment, currentDocsProperty });
  }
  insertSourceCode({
    component,
    svelteASTNodes,
    currentDocsProperty,
    filename,
    originalCode,
  });

  return updateCompiledCode({
    code,
    nodes: componentASTNodes,
    metaObjectExpression: storyPropsObjectExpression,
  });
}

/**
 * Get an {@link ObjectExpression} with props passed down to Svelte component in compiled code.
 *
 * - In **development** mode, extract from the {@link ExpressionStatement}.
 *   How it looks in **development** mode:
 *
 *   ```js
 *   $.validate_component(Story)(node_1, { props })
 *   ```
 *
 * - In **production** mode, extract from the {@link CallExpression}.
 *   And in **production** mode:
 *
 *   ```js
 *   Story(node_1, { props })
 *   ```
 */
function getStoryPropsObjectExpression(
  node: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number]
): ObjectExpression {
  if (node.type === 'CallExpression' && node.arguments[1].type === 'ObjectExpression') {
    return node.arguments[1];
  }

  if (
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'CallExpression' &&
    node.expression.arguments[1].type === 'ObjectExpression'
  ) {
    return node.expression.arguments[1];
  }

  throw new Error('Internal error in attempt to extract meta as object expression.');
}

/**
 * Once we finish mutating the {@link ObjectExpression} with props for each compiled `<Story />` svelte component,
 * print updated AST nodes to the existing code.
 */
function updateCompiledCode({
  code,
  nodes,
  metaObjectExpression,
}: {
  code: Params['code'];
  nodes: Params['componentASTNodes'];
  metaObjectExpression: ObjectExpression;
}) {
  const { compiled } = nodes;

  if (compiled.type === 'CallExpression') {
    compiled.arguments[1] === metaObjectExpression;
  }

  if (compiled.type === 'ExpressionStatement' && compiled.expression.type === 'CallExpression') {
    compiled.expression.arguments[1] === metaObjectExpression;
  }

  // @ts-expect-error FIXME: These keys exists at runtime, perhaps I missed some type extension from `svelte/compiler`?
  const { start, end } = compiled;

  code.update(
    start,
    end,
    toJs({
      type: 'Program',
      sourceType: 'module',
      body: [compiled as Statement],
    }).value
  );
}
