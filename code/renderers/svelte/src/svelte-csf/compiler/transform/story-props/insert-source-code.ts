import type { ObjectExpression, Property } from 'estree';
import type { Component } from 'svelte/compiler';

import { createASTObjectExpression, createASTProperty, findASTPropertyIndex } from './shared.js';

import { getStoryChildrenRawSource } from '../../../parser/analyse/Story/children.js';
import type { extractSvelteASTNodes } from '../../../parser/extract/svelte/nodes.js';

interface Params {
  component: Component;
  svelteASTNodes: Awaited<ReturnType<typeof extractSvelteASTNodes>>;
  currentDocsProperty: Property;
  filename?: string;
  originalCode: string;
}

/**
 * Continue to "walking" through the AST node of `parameters.docs` {@link ObjectExpression},
 * to see if the user has explicitly set a `source.code`.
 * If he didn't, then it will insert to the existing ObjectExpression.
 */
export function insertSourceCode(params: Params) {
  const { component, svelteASTNodes, currentDocsProperty, filename, originalCode } = params;

  if (currentDocsProperty.value.type !== 'ObjectExpression') {
    throw new Error(
      `Invalid schema for property "docs" value - expected "ObjectExpression", but got ${currentDocsProperty.value.type}. Stories file: ${filename}`
    );
  }

  // Will need to check twice, because of scenario:
  // Index of the AST property was not found - then we create o new AST property.
  // After that, we need to check again to get the index of newly created AST node - property.
  const findSourceIndex = () =>
    findASTPropertyIndex('source', currentDocsProperty.value as ObjectExpression);

  if (findSourceIndex() === -1) {
    currentDocsProperty.value.properties.push(
      createASTProperty('source', createASTObjectExpression())
    );
  }

  const currentSourceProperty = currentDocsProperty.value.properties[findSourceIndex()] as Property;

  if (currentSourceProperty.value.type !== 'ObjectExpression') {
    throw new Error(
      `Invalid schema for property "source" value - expected "ObjectExpression", but got ${currentSourceProperty.value.type}. Stories file: ${filename}`
    );
  }

  // Will need to check twice, because of scenario:
  // Index of the AST property was not found - thwn we create o new AST property.
  // After that, we need to check again to get the index of newly created AST node - property.
  const findStoryIndex = () =>
    findASTPropertyIndex('story', currentSourceProperty.value as ObjectExpression);

  if (findStoryIndex() !== -1) {
    // TODO: That's not unepected, curious or anything.
    // No need for a warning, right?
    return;
  }

  const value = getStoryChildrenRawSource({
    component,
    svelteASTNodes,
    originalCode,
  });

  currentSourceProperty.value.properties.push(
    createASTProperty('code', { type: 'Literal', value })
  );

  currentDocsProperty.value.properties[findStoryIndex()] = currentSourceProperty;
}
