import {
  findPropertyParametersIndex,
  getParametersPropertyValue,
} from '$lib/compiler/post-transform/shared/description';

import type { extractStoriesNodesFromExportDefaultFn } from '$lib/parser/extract/compiled/stories';
import { getStoryPropsObjectExpression } from '$lib/parser/extract/compiled/story';
import type { SvelteASTNodes, extractSvelteASTNodes } from '$lib/parser/extract/svelte/nodes';
import { getStoryChildrenRawCode } from '$lib/parser/analyse/story/children';
import { createASTObjectExpression, createASTProperty } from '$lib/parser/ast';

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
    storyPropsObjectExpression.properties.push(
      createASTProperty('parameters', createASTObjectExpression())
    );
  }

  const rawCode = getStoryChildrenRawCode({
    nodes: {
      component: component.svelte.component,
      svelte,
    },
    originalCode,
  });

  getParametersPropertyValue({
    filename,
    component: component.svelte.component,
    node: storyPropsObjectExpression,
  }).properties.push(
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
