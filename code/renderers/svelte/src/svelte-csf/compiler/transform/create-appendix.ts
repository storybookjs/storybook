import MagicString from 'magic-string';
import { toJs } from 'estree-util-to-js';

import { createExportDefaultMeta } from './appendix/create-export-default.js';
import { createExportOrderVariable } from './appendix/create-export-order.js';
import { createImport } from './appendix/create-import.js';
import { createVariableFromRuntimeStoriesCall } from './appendix/create-variable-from-runtime-stories-call.js';
import { createNamedExportStory } from './appendix/create-named-export-story.js';

import { getMetaIdentifier } from '../../parser/analyse/meta/identifier.js';
import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes.js';
import type { SvelteASTNodes } from '../../parser/extract/svelte/nodes.js';
import { getStoriesNames } from '../../parser/analyse/Story/attributes/name.js';

interface Params {
  componentName: string;
  code: MagicString;
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename: string;
}

export async function createAppendix(params: Params) {
  const { componentName, code, nodes, filename } = params;
  const { compiled, svelte } = nodes;
  const { defineMetaVariableDeclaration } = compiled;

  const names = await getStoriesNames({ nodes: svelte, filename });
  const metaIdentifier = getMetaIdentifier({
    node: defineMetaVariableDeclaration,
    filename,
  });
  const variableFromRuntimeStoriesCall = createVariableFromRuntimeStoriesCall({
    componentName,
    metaIdentifier,
    filename,
  });
  const storiesExports = await Promise.all(
    names.map((name) =>
      createNamedExportStory({
        name,
        filename,
        node: variableFromRuntimeStoriesCall,
      })
    )
  );

  const appendix = toJs({
    type: 'Program',
    sourceType: 'module',
    body: [
      createImport(),
      variableFromRuntimeStoriesCall,
      createExportDefaultMeta({ metaIdentifier, filename }),
      createExportOrderVariable({ names, filename }),
      ...storiesExports,
    ],
  });

  code.append('\n' + appendix.value);
}
