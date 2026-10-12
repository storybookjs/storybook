import type * as ESTreeAST from 'estree';

import { SVELTE_CSF_IMPORT_SOURCES } from '../constants.ts';
import { isOneOf } from './is-one-of.ts';

export function isSvelteCsfImportSource(source: unknown): boolean {
  return typeof source === 'string' && isOneOf(SVELTE_CSF_IMPORT_SOURCES, source);
}

interface DefineMetaImport {
  defineMetaImport?: ESTreeAST.ImportSpecifier;
  hasDefaultOrNamespaceImport: boolean;
}

// Imports are only allowed at the top level, so there's no need to walk the whole AST
export function findDefineMetaImport(body: ESTreeAST.Program['body']): DefineMetaImport {
  const result: DefineMetaImport = { hasDefaultOrNamespaceImport: false };

  for (const statement of body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      !isSvelteCsfImportSource(statement.source.value)
    ) {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ImportSpecifier') {
        result.hasDefaultOrNamespaceImport = true;
      } else if ('name' in specifier.imported && specifier.imported.name === 'defineMeta') {
        result.defineMetaImport = specifier;
      }
    }
  }

  return result;
}
