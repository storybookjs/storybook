import { print } from 'esrap';
import MagicString from 'magic-string';

import { createExportOrderVariable } from './appendix/create-export-order';
import { createRuntimeStoriesImport } from './appendix/create-import';
import { createVariableFromRuntimeStoriesCall } from './appendix/create-variable-from-runtime-stories-call';
import { createNamedExportStory } from './appendix/create-named-export-story';

import { createASTIdentifier, type ESTreeAST } from '../../parser/ast';
import { getStoriesIdentifiers } from '../../parser/analyse/story/attributes/identifiers';
import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes';
import type { SvelteASTNodes } from '../../parser/extract/svelte/nodes';

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
