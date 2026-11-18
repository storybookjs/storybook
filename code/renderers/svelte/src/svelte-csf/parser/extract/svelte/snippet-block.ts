import { unwrapExpression } from 'storybook/internal/csf-tools';

import type { SvelteAST } from '../../ast.ts';
import type { SvelteASTNodes } from './nodes.ts';
import { extractStoryAttributesNodes } from './story/attributes.ts';

import { InvalidStoryTemplateAttributeError } from '../../../utils/error/parser/extract/svelte.ts';
import { getDefineMetaRenderValue } from '../../analyse/define-meta/render-identifier.ts';

export function findStoryAttributeTemplateSnippetBlock(options: {
  component: SvelteAST.Component;
  nodes: SvelteASTNodes;
  filename?: string;
}): SvelteAST.SnippetBlock | undefined {
  const { component, nodes, filename } = options;
  const { template } = extractStoryAttributesNodes({
    component,
    attributes: ['template'],
  });

  if (!template) {
    return;
  }

  if (template.value === true || Array.isArray(template.value)) {
    throw new InvalidStoryTemplateAttributeError({
      component,
      filename,
    });
  }

  return findSnippetBlockByName({
    name: (unwrapExpression(template.value.expression) as any).name,
    nodes: nodes,
  });
}

export function findMetaRenderSnippetBlock(options: {
  nodes: SvelteASTNodes;
  filename?: string;
}): SvelteAST.SnippetBlock | undefined {
  const { nodes, filename } = options;

  const defineMetaRenderValue = getDefineMetaRenderValue({
    nodes,
    filename,
  });

  if (!defineMetaRenderValue) {
    return;
  }

  return findSnippetBlockByName({
    name: defineMetaRenderValue.name,
    nodes: nodes,
  });
}

function findSnippetBlockByName(options: {
  name: string;
  nodes: SvelteASTNodes;
}): SvelteAST.SnippetBlock | undefined {
  const { name, nodes } = options;
  const { snippetBlocks } = nodes;

  return snippetBlocks.find((snippetBlock) => snippetBlock.expression.name === name);
}
