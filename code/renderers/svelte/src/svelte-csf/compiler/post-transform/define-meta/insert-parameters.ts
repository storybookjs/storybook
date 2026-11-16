import { logger } from 'storybook/internal/node-logger';

import {
  findASTPropertyIndex,
  findPropertyDescriptionIndex,
  findPropertyDocsIndex,
  findPropertyParametersIndex,
  getDescriptionPropertyValue,
  getDocsPropertyValue,
  getParametersPropertyValue,
} from '../shared/parameters.ts';
import {
  appendASTProperty,
  createASTObjectExpression,
  createASTProperty,
  type ESTreeAST,
} from '../../../parser/ast.ts';
import type { SvelteASTNodes } from '../../../parser/extract/svelte/nodes.ts';
import type { CompiledASTNodes } from '../../../parser/extract/compiled/nodes.ts';
import { getDefineMetaFirstArgumentObjectExpression } from '../../../parser/extract/svelte/define-meta.ts';

interface Params {
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename?: string;
}

// Copies the JSDoc comment above `defineMeta()` into `parameters.docs.description.component`.
export function insertDefineMetaParameters(params: Params): void {
  const { nodes, filename } = params;

  if (!nodes.svelte.defineMetaVariableDeclaration.leadingComments) {
    return;
  }

  const defineMetaFirstArgumentObjectExpression = getDefineMetaFirstArgumentObjectExpression({
    nodes: nodes.compiled,
    filename,
  });

  if (
    findPropertyParametersIndex({
      filename,
      node: defineMetaFirstArgumentObjectExpression,
    }) === -1
  ) {
    appendASTProperty(
      defineMetaFirstArgumentObjectExpression,
      createASTProperty('parameters', createASTObjectExpression())
    );
  }

  if (
    findPropertyDocsIndex({
      filename,
      node: defineMetaFirstArgumentObjectExpression,
    }) === -1
  ) {
    appendASTProperty(
      getParametersPropertyValue({
        filename,
        node: defineMetaFirstArgumentObjectExpression,
      }),
      createASTProperty('docs', createASTObjectExpression())
    );
  }

  if (
    findPropertyDescriptionIndex({
      filename,
      node: defineMetaFirstArgumentObjectExpression,
    }) === -1
  ) {
    appendASTProperty(
      getDocsPropertyValue({
        filename,
        node: defineMetaFirstArgumentObjectExpression,
      }),
      createASTProperty('description', createASTObjectExpression())
    );
  }

  if (
    findASTPropertyIndex({
      name: 'component',
      node: getDescriptionPropertyValue({
        filename,
        node: defineMetaFirstArgumentObjectExpression,
      }),
    }) !== -1
  ) {
    logger.warn(
      `Svelte CSF:
        Description was already set in parameters.docs.description.component,
        ignoring JSDoc comment above defineMeta() in:
        ${filename}`
    );

    return;
  }

  appendASTProperty(
    getDescriptionPropertyValue({
      filename,
      node: defineMetaFirstArgumentObjectExpression,
    }),
    createASTProperty('component', {
      type: 'Literal',
      value: extractDescription(nodes.svelte.defineMetaVariableDeclaration.leadingComments),
    })
  );
}

// Same as the description extraction in csf-tools' `enrichCsf.ts`, but for `estree` comments instead of Babel ones.
function extractDescription(leadingComments: ESTreeAST.Comment[]) {
  const comments = leadingComments
    .map((comment) => {
      if (
        comment.type === 'Line' ||
        // is not a JSDoc format - `/**` - by default parser omits the leading `/*` and ending `*/`
        !comment.value.startsWith('*')
      ) {
        return null;
      }

      return (
        comment.value
          .split('\n')
          // remove leading *'s and spaces from the beginning of each line
          .map((line) => line.replace(/^(\s+)?(\*+)?(\s)?/, ''))
          .join('\n')
          .trim()
      );
    })
    .filter(Boolean);

  return comments.join('\n');
}
