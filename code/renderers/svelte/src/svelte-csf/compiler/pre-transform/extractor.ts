import type { Component, SvelteNode } from 'svelte/compiler';

interface Results {
  componentsTemplate: Component[];
}

/**
 * Extract legacy AST nodes, for usage with codemods into modern syntax.
 */
export async function extractLegacyNodes(parsed: SvelteNode): Promise<Results> {
  const { walk } = await import('zimmerframe');

  const state: {
    componentsTemplate: Component[];
  } = {
    componentsTemplate: [],
  };

  walk(parsed, state, {
    _(_node, context) {
      const { next, state } = context;

      next(state);
    },

    Root(node, context) {
      const { fragment } = node;
      const { visit, state } = context;

      visit(fragment, state);
    },

    Fragment(node, context) {
      const { nodes } = node;
      const { state, visit } = context;

      for (const node of nodes) {
        visit(node, state);
      }
    },

    Component(node, context) {
      const { name } = node;
      const { state } = context;

      // TODO: Add support for renamed import specifiers of `Template` on user request
      // e.g. `import { Template as T } from "@storybook/addon-svelte-csf"`
      if (name === 'Template') {
        state.componentsTemplate.push(node);
      }
    },
  });

  return state;
}
