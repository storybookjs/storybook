import type { ExportDefaultDeclaration } from 'estree';

import type { getMetaIdentifier } from '../../../parser/analyse/define-meta/meta-identifier.js';

interface Params {
  metaIdentifier: ReturnType<typeof getMetaIdentifier>;
  filename?: string;
}

export function createExportDefaultMeta(params: Params): ExportDefaultDeclaration {
  const { metaIdentifier } = params;

  return {
    type: 'ExportDefaultDeclaration',
    declaration: metaIdentifier,
  };
}
