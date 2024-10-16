import type { getMetaIdentifier } from '#parser/analyse/define-meta/meta-identifier';
import type { ESTreeAST } from '#parser/ast';

interface Params {
  metaIdentifier: ReturnType<typeof getMetaIdentifier>;
  filename?: string;
}

export function createExportDefaultMeta(params: Params): ESTreeAST.ExportDefaultDeclaration {
  const { metaIdentifier } = params;

  return {
    type: 'ExportDefaultDeclaration',
    declaration: metaIdentifier,
  };
}
