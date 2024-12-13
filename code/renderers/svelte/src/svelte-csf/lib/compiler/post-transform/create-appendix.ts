import { print } from 'esrap';
import MagicString from 'magic-string';

import { createExportDefaultMeta } from './appendix/create-export-default';
import { createExportOrderVariable } from './appendix/create-export-order';
import { createRuntimeStoriesImport } from './appendix/create-import';
import { createVariableFromRuntimeStoriesCall } from './appendix/create-variable-from-runtime-stories-call';
import { createNamedExportStory } from './appendix/create-named-export-story';

import { getMetaIdentifier } from '$lib/parser/analyse/define-meta/meta-identifier';
import type { CompiledASTNodes } from '$lib/parser/extract/compiled/nodes';
import type { SvelteASTNodes } from '$lib/parser/extract/svelte/nodes';
import { getStoriesIdentifiers } from '$lib/parser/analyse/story/attributes/identifiers';

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
  const { defineMetaVariableDeclaration, storiesFunctionDeclaration } = compiled;

  const storyIdentifiers = getStoriesIdentifiers({
    nodes: svelte,
    filename,
  });
  const metaIdentifier = getMetaIdentifier({
    node: defineMetaVariableDeclaration,
    filename,
  });
  const variableFromRuntimeStoriesCall = createVariableFromRuntimeStoriesCall({
    storiesFunctionDeclaration,
    metaIdentifier,
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
      createExportDefaultMeta({ metaIdentifier, filename }),
      createExportOrderVariable({ storyIdentifiers, filename }),
      ...storiesExports,
    ],
  });

  code.append('\n' + appendix.code);
}
