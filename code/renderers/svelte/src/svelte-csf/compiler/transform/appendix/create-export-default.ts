import type { ExportDefaultDeclaration } from 'estree';

import type { getMetaIdentifier } from '../../../parser/analyse/meta/identifier.js';

interface Params {
  metaIdentifier: ReturnType<typeof getMetaIdentifier>;
  filename: string;
}

export function createExportDefaultMeta(params: Params): ExportDefaultDeclaration {
  const { metaIdentifier, filename } = params;

  return {
    type: 'ExportDefaultDeclaration',
    declaration: metaIdentifier,
  };
}
