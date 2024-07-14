import type { CallExpression } from 'estree';
import type { Root, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

import type { extractModuleNodes } from './module-nodes';

interface Result {
  setTemplateCall: CallExpression | undefined;
}

interface Params {
  instance: Root['instance'];
  moduleNodes: Awaited<ReturnType<typeof extractModuleNodes>>;
  filename?: string;
}

/**
 * Extract Svelte AST nodes via `svelte.compile`,
 * and from the instance tag - `<script>` _(without `context="module"`)_.
 * They are needed for further code analysis/transformation.
	// NOTE: Is optional for the `*.stories.svelte` files to have this tag.
 */
export async function extractInstanceNodes(options: Params): Promise<Result> {
  const { instance, moduleNodes } = options;
  const { setTemplateImport } = moduleNodes;

  if (!instance || !setTemplateImport) {
    return {
      setTemplateCall: undefined,
    };
  }
  const { walk } = await import('zimmerframe');

  const state: Partial<Result> = {};
  const visitors: Visitors<SvelteNode, typeof state> = {
    CallExpression(node, { state }) {
      if (node.callee.type === 'Identifier' && node.callee.name === setTemplateImport?.local.name) {
        state.setTemplateCall = node;
      }
    },
  };

  walk(instance.content, state, visitors);

  const { setTemplateCall } = state;

  return {
    setTemplateCall,
  };
}
