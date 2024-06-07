import MagicString from 'magic-string';
import { toJs } from 'estree-util-to-js';

import { createExportDefaultMeta } from './appendix/create-export-default.js';
import { createExportOrderVariable } from './appendix/create-export-order.js';
import { createRuntimeStoriesImport } from './appendix/create-import.js';
import { createVariableFromRuntimeStoriesCall } from './appendix/create-variable-from-runtime-stories-call.js';
import { createNamedExportStory } from './appendix/create-named-export-story.js';

import { getMetaIdentifier } from '../../parser/analyse/define-meta/meta-identifier.js';
import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes.js';
import type { SvelteASTNodes } from '../../parser/extract/svelte/nodes.js';
import { getStoriesIdentifiers } from '../../parser/analyse/story/svelte/attributes/identifiers.js';

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

  const appendix = toJs({
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

  code.append('\n' + appendix.value);
}
