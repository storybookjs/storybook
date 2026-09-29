import { STORYBOOK_INTERNAL_PREFIX } from '$lib/constants.js';
import type { getStoriesIdentifiers } from '$lib/parser/analyse/story/attributes/identifiers.js';
import { createASTIdentifier, type ESTreeAST } from '$lib/parser/ast.js';

interface NamedExportStoriesParams {
  storiesIdentifiers: ReturnType<typeof getStoriesIdentifiers>;
}

export function createNamedExportStories(
  params: NamedExportStoriesParams
): ESTreeAST.ExportNamedDeclaration {
  return {
    type: 'ExportNamedDeclaration',
    specifiers: params.storiesIdentifiers.map(createExportSpecifier),
    declaration: null,
    attributes: [],
  };
}

function createExportSpecifier(
  storyIdentifier: ReturnType<typeof getStoriesIdentifiers>[number]
): ESTreeAST.ExportSpecifier {
  return {
    type: 'ExportSpecifier',
    local: createASTIdentifier(`${STORYBOOK_INTERNAL_PREFIX}${storyIdentifier.exportName}`),
    exported: createASTIdentifier(storyIdentifier.exportName),
  };
}
