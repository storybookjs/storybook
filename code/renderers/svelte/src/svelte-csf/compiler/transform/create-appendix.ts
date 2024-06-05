import MagicString from 'magic-string';
import { toJs } from 'estree-util-to-js';

import { createExportDefaultMeta } from './appendix/create-export-default.js';
import { createCodeByStoryMap } from './appendix/create-code-by-story-map.js';
import { createExportOrderVariable } from './appendix/create-export-order.js';
import { createImport } from './appendix/create-import.js';
import { createVariableFromRuntimeStoriesCall } from './appendix/create-variable-from-runtime-stories-call.js';
import { createNamedExportStory } from './appendix/create-named-export-story.js';

import { getMetaIdentifier } from '../../parser/analyse/meta/identifier.js';
import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes.js';
import type { SvelteASTNodes } from '../../parser/extract/svelte/nodes.js';
import { getStoriesIdentifiers } from '../../parser/analyse/Story/attributes/identifiers.js';

interface Params {
  code: MagicString;
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  filename: string;
}

export async function createAppendix(params: Params) {
  const { code, nodes, filename } = params;
  const { compiled, svelte } = nodes;
  const { defineMetaVariableDeclaration, storiesFunctionDeclaration } = compiled;

  const storyIdentifiers = await getStoriesIdentifiers({ nodes: svelte, filename });
  const metaIdentifier = getMetaIdentifier({
    node: defineMetaVariableDeclaration,
    filename,
  });
  const codeByStoryMapDeclaration = createCodeByStoryMap({ storyIdentifiers });
  const variableFromRuntimeStoriesCall = createVariableFromRuntimeStoriesCall({
    storiesFunctionDeclaration,
    metaIdentifier,
    codeByStoryMapDeclaration,
    filename,
  });
  const storiesExports = await Promise.all(
    storyIdentifiers.map(({ exportName }) =>
      createNamedExportStory({
        exportName,
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
      createCodeByStoryMap({ storyIdentifiers }),
      variableFromRuntimeStoriesCall,
      createExportDefaultMeta({ metaIdentifier, filename }),
      createExportOrderVariable({ storyIdentifiers, filename }),
      ...storiesExports,
    ],
  });

  code.append('\n' + appendix.value);
}
