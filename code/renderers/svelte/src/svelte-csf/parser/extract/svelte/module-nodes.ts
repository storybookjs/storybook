import { findMeta, findMetaImports, hasMetaImport } from '../../../utils/import-source.ts';

import type { ESTreeAST, SvelteAST } from '../../ast.ts';
import {
  DefaultOrNamespaceImportUsedError,
  MissingDefineMetaImportError,
  MissingDefineMetaVariableDeclarationError,
  MissingModuleTagError,
  NoStoryComponentDestructuredError,
} from '../../../utils/error/parser/extract/svelte.ts';

interface Result {
  // `true` for `preview.meta()`, which creates a CSF factories meta
  isFactory: boolean;
  // `const { Story } = defineMeta({})` or `preview.meta({})`, or `const meta = preview.meta({})` then `const { Story } = meta`
  defineMetaVariableDeclaration: ESTreeAST.VariableDeclaration;
  // `meta` in `const meta = preview.meta({})`
  metaIdentifier?: ESTreeAST.Identifier;
  // Local names, because the destructuring can rename `Story`, as in `const { Story: S } = defineMeta({})`
  storyNames: string[];
}

interface Params {
  module: SvelteAST.Root['module'];
  filename?: string;
}

export async function extractModuleNodes(options: Params): Promise<Result> {
  const { module, filename } = options;

  if (!module) {
    throw new MissingModuleTagError(filename);
  }

  const imports = findMetaImports(module.content.body);
  const meta = findMeta(module.content.body, imports, filename);

  if (!hasMetaImport(imports)) {
    if (imports.hasDefaultOrNamespaceImport) {
      throw new DefaultOrNamespaceImportUsedError(filename);
    }

    throw new MissingDefineMetaImportError(filename);
  }

  if (!meta) {
    throw new MissingDefineMetaVariableDeclarationError(filename);
  }

  if (meta.storyNames.length === 0) {
    throw new NoStoryComponentDestructuredError({
      filename,
      metaFunctionName: meta.functionName,
    });
  }

  return {
    isFactory: meta.isFactory,
    defineMetaVariableDeclaration: meta.declaration,
    metaIdentifier: meta.metaIdentifier,
    storyNames: meta.storyNames,
  };
}
