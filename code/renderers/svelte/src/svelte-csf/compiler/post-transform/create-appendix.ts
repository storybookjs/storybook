import { print } from 'esrap';
import type MagicString from 'magic-string';

import { createExportOrderVariableDeclaration } from './appendix/create-export-order.ts';
import { createRuntimeStoriesImport } from './appendix/create-import.ts';
import { createVariableFromRuntimeStoriesCall } from './appendix/create-variable-from-runtime-stories-call.ts';
import { createNamedExportStories } from './appendix/create-named-export-stories.ts';

import { STORYBOOK_META_IDENTIFIER } from '../../constants.ts';
import { createASTIdentifier, type ESTreeAST, type SvelteAST } from '../../parser/ast.ts';
import { type ExtendableStory, orderByParents } from '../../parser/analyse/story/extend.ts';
import type { StoryParents } from '../../utils/story-chain.ts';
import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes.ts';
import type { SvelteASTNodes } from '../../parser/extract/svelte/nodes.ts';
import { createRuntimeStoryVariableDeclaration } from './appendix/create-runtime-story-variable-declaration.ts';

interface Params {
  code: MagicString;
  nodes: {
    compiled: CompiledASTNodes;
    svelte: SvelteASTNodes;
  };
  stories: ExtendableStory[];
  parents: StoryParents;
  filename?: string;
}

export async function createAppendix(params: Params) {
  const { code, nodes, stories, parents, filename } = params;
  const { compiled, svelte } = nodes;
  const { storiesFunctionDeclaration } = compiled;
  const factoryMeta = compiled.isFactory
    ? (compiled.metaIdentifier ?? createASTIdentifier(STORYBOOK_META_IDENTIFIER))
    : undefined;

  const variableFromRuntimeStoriesCall = createVariableFromRuntimeStoriesCall({
    storiesFunctionDeclaration,
    factoryMeta,
    filename,
  });
  const exportNames = stories.map(({ exportName }) => exportName);
  // A story that extends another one reads it, so the parent is declared first
  const storiesVariableDeclarations = orderByParents(exportNames, parents).map((exportName) =>
    createRuntimeStoryVariableDeclaration({
      exportName,
      parentExportName: parents.get(exportName),
      filename,
      nodes: {
        variable: variableFromRuntimeStoriesCall,
        tags: getStoryTags({
          storyComponents: svelte.storyComponents,
          idx: exportNames.indexOf(exportName),
        }),
        factoryMeta,
      },
    })
  );

  const appendix = print({
    type: 'Program',
    sourceType: 'module',
    body: [
      createRuntimeStoriesImport(),
      variableFromRuntimeStoriesCall,
      // A CSF factories file has no default export: core finds the meta through the stories
      ...(factoryMeta ? [] : [createExportDefaultMeta()]),
      createExportOrderVariableDeclaration({ storiesIdentifiers: stories, filename }),
      ...storiesVariableDeclarations,
      createNamedExportStories({ storiesIdentifiers: stories }),
    ],
  });

  code.append('\n' + appendix.code);
}

function createExportDefaultMeta(): ESTreeAST.ExportDefaultDeclaration {
  return {
    type: 'ExportDefaultDeclaration',
    declaration: createASTIdentifier(STORYBOOK_META_IDENTIFIER),
  };
}

interface GetStoryTagsParams {
  storyComponents: SvelteASTNodes['storyComponents'];
  idx: number;
}
function getStoryTags(params: GetStoryTagsParams): ESTreeAST.ArrayExpression | undefined {
  const storyComponent = params.storyComponents[params.idx];
  const tags = storyComponent.component.attributes.find((a) => a.name === 'tags');

  if (!tags) return;

  return (tags.value as SvelteAST.ExpressionTag).expression as ESTreeAST.ArrayExpression;
}
