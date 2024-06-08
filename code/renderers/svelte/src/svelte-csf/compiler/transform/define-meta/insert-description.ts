import { logger } from '@storybook/client-logger';
import type { Comment } from 'estree';

import {
  createASTObjectExpression,
  createASTProperty,
  findASTPropertyIndex,
  findPropertyDescriptionIndex,
  findPropertyDocsIndex,
  findPropertyParametersIndex,
  getDescriptionPropertyValue,
  getDocsPropertyValue,
  getParametersPropertyValue,
} from '../shared/description';

import type { SvelteASTNodes } from '#parser/extract/svelte/nodes';
import type { CompiledASTNodes } from '#parser/extract/compiled/nodes';

import { getDefineMetaFirstArgumentNode } from '#parser/analyse/define-meta/first-argument';

interface Params {
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename?: string;
}

/**
 * Attempt to insert JSDoc comment above the `defineMeta()` call.
 *
 * Before:
 *
 * ```js
 * // Some description about the component
 * const { Story } = defineMeta({});
 * ```
 *
 * After:
 * ```js
 * // Some description about the component
 * const { Story } = defineMeta({
 *   parameters: {
 *     docs: {
 *       description: { component: "Some description about the component" },
 *     },
 *   },
 * });
 * ```
 */
export function insertDefineMetaJSDocCommentAsDescription(params: Params): void {
  const { nodes, filename } = params;
  const { compiled, svelte } = nodes;
  const { defineMetaVariableDeclaration } = svelte;
  const { leadingComments } = defineMetaVariableDeclaration;

  if (!leadingComments) {
    return;
  }

  const defineMetaFirstArgumentObjectExpression = getDefineMetaFirstArgumentNode({
    nodes: compiled,
    filename,
  });

  if (findPropertyParametersIndex(defineMetaFirstArgumentObjectExpression) === -1) {
    defineMetaFirstArgumentObjectExpression.properties.push(
      createASTProperty('parameters', createASTObjectExpression())
    );
  }

  if (findPropertyDocsIndex(defineMetaFirstArgumentObjectExpression) === -1) {
    getParametersPropertyValue(defineMetaFirstArgumentObjectExpression).properties.push(
      createASTProperty('docs', createASTObjectExpression())
    );
  }

  if (findPropertyDescriptionIndex(defineMetaFirstArgumentObjectExpression) === -1) {
    getDocsPropertyValue(defineMetaFirstArgumentObjectExpression).properties.push(
      createASTProperty('description', createASTObjectExpression())
    );
  }

  if (
    findASTPropertyIndex(
      'component',
      getDescriptionPropertyValue(defineMetaFirstArgumentObjectExpression)
    ) !== -1
  ) {
    logger.warn(
      `defineMeta() already has explictly set description. Ignoring the JSDoc comment above. Stories file: ${filename}`
    );

    return;
  }

  getDescriptionPropertyValue(defineMetaFirstArgumentObjectExpression).properties.push(
    createASTProperty('component', {
      type: 'Literal',
      value: extractDescription(leadingComments),
    })
  );
}

/**
 * Adopted from: https://github.com/storybookjs/storybook/blob/next/code/lib/csf-tools/src/enrichCsf.ts/#L148-L164
 * Adjusted for this addon, because here we use AST format from `estree`, not `babel`.
 */
function extractDescription(leadingComments: Comment[]) {
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
