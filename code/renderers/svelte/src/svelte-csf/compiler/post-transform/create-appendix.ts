import { print } from 'esrap';
import MagicString from 'magic-string';

import { createExportOrderVariable } from './appendix/create-export-order.js';
import { createRuntimeStoriesImport } from './appendix/create-import.js';
import { createVariableFromRuntimeStoriesCall } from './appendix/create-variable-from-runtime-stories-call.js';
import { createNamedExportStory } from './appendix/create-named-export-story.js';

import { createASTIdentifier, type ESTreeAST } from '$lib/parser/ast.js';
import { getStoriesIdentifiers } from '$lib/parser/analyse/story/attributes/identifiers.js';
import type { CompiledASTNodes } from '$lib/parser/extract/compiled/nodes.js';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes.js';

interface Params {
  code: MagicString;
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename?: string;
}

export async function createAppendix(params: Params) {
  const { code, nodes, filename } = params;
  const { compiled, svelte } = nodes;
  const { storiesFunctionDeclaration } = compiled;

  const storyIdentifiers = getStoriesIdentifiers({
    nodes: svelte,
    filename,
  });
  const variableFromRuntimeStoriesCall = createVariableFromRuntimeStoriesCall({
    storiesFunctionDeclaration,
    filename,
  });
  const storiesExports = storyIdentifiers.map(({ exportName }) =>
    createNamedExportStory({
      exportName,
      filename,
      node: variableFromRuntimeStoriesCall,
    })
  );

  const appendix = print({
    type: 'Program',
    sourceType: 'module',
    body: [
      createRuntimeStoriesImport(),
      variableFromRuntimeStoriesCall,
      createExportDefaultMeta(),
      createExportOrderVariable({ storyIdentifiers, filename }),
      ...storiesExports,
    ],
  });

  code.append('\n' + appendix.code);
}

function createExportDefaultMeta(): ESTreeAST.ExportDefaultDeclaration {
  return {
    type: 'ExportDefaultDeclaration',
    declaration: createASTIdentifier('meta'),
  };
}
