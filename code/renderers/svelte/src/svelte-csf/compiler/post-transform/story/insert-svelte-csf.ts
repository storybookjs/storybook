import { findPropertyParametersIndex, getParametersPropertyValue } from '../shared/parameters.ts';

import type { extractStoriesNodesFromExportDefaultFn } from '../../../parser/extract/compiled/stories.ts';
import { getStoryPropsObjectExpression } from '../../../parser/extract/compiled/story.ts';
import type {
  SvelteASTNodes,
  extractSvelteASTNodes,
} from '../../../parser/extract/svelte/nodes.ts';
import { getStoryContentRawCode } from '../../../parser/analyse/story/content.ts';
import {
  appendASTProperty,
  createASTObjectExpression,
  createASTProperty,
} from '../../../parser/ast.ts';

interface Params {
  nodes: {
    component: {
      svelte: SvelteASTNodes['storyComponents'][number];
      compiled: Awaited<ReturnType<typeof extractStoriesNodesFromExportDefaultFn>>[number];
    };
    svelte: Awaited<ReturnType<typeof extractSvelteASTNodes>>;
  };
  filename?: string;
  originalCode: string;
}

/**
 * Insert addon's internal object `__svelteCsf`
 * to `parameters` of every `<Story />` component **into the compiled code**.
 */
export function insertSvelteCSFToStoryParameters(params: Params) {
  const { nodes, filename, originalCode } = params;
  const { component, svelte } = nodes;

  const storyPropsObjectExpression = getStoryPropsObjectExpression({
    node: component.compiled,
    filename,
  });

  if (
    findPropertyParametersIndex({
      filename,
      component: component.svelte.component,
      node: storyPropsObjectExpression,
    }) === -1
  ) {
    appendASTProperty(
      storyPropsObjectExpression,
      createASTProperty('parameters', createASTObjectExpression())
    );
  }

  const rawCode = getStoryContentRawCode({
    nodes: {
      component: component.svelte.component,
      svelte,
    },
    originalCode,
  });

  appendASTProperty(
    getParametersPropertyValue({
      filename,
      component: component.svelte.component,
      node: storyPropsObjectExpression,
    }),
    createASTProperty(
      '__svelteCsf',
      createASTObjectExpression([
        createASTProperty('rawCode', {
          type: 'Literal',
          value: rawCode,
        }),
      ])
    )
  );
}
