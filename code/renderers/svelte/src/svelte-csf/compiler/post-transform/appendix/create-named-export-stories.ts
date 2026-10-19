import { STORYBOOK_INTERNAL_PREFIX } from '../../../constants.ts';
import type { getStoriesIdentifiers } from '../../../parser/analyse/story/attributes/identifiers.ts';
import { createASTIdentifier, type ESTreeAST } from '../../../parser/ast.ts';

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
