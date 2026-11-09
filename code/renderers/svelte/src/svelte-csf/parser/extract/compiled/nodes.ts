import { findMeta, findMetaImports, hasMetaImport } from '../../../utils/import-source.ts';
import type { ParseAst } from 'rollup';
import type { Visitors } from 'zimmerframe';

import type { ESTreeAST } from '../../ast.ts';
import {
  MissingDefineMetaVariableDeclarationError,
  MissingImportedDefineMetaError,
  NoExportDefaultError,
  NoStoriesFunctionDeclarationError,
  NoStoryIdentifierFoundError,
} from '../../../utils/error/parser/extract/compiled.ts';
import { DefaultOrNamespaceImportUsedError } from '../../../utils/error/parser/extract/svelte.ts';

export interface CompiledASTNodes {
  // `true` for `preview.meta()`, which creates a CSF factories meta
  isFactory: boolean;
  // `const { Story } = defineMeta({})` or `preview.meta({})`, or `const meta = preview.meta({})` then `const { Story } = meta`
  defineMetaVariableDeclaration: ESTreeAST.VariableDeclaration;
  // `meta` in `const meta = preview.meta({})`
  metaIdentifier?: ESTreeAST.Identifier;
  // Removed later, because Storybook expects `export default meta` instead of the compiled component
  exportDefault: ESTreeAST.ExportDefaultDeclaration;
  // Local names, because the destructuring can rename `Story`, as in `const { Story: S } = defineMeta({})`
  storyNames: string[];
  storiesFunctionDeclaration: ESTreeAST.FunctionDeclaration;
}

interface Params {
  // Rollup's AST has its own copy of the ESTree types
  ast: ESTreeAST.Program | ReturnType<ParseAst>;
  filename?: string;
}

export async function extractCompiledASTNodes(params: Params): Promise<CompiledASTNodes> {
  const { ast, filename } = params;

  const { walk } = await import('zimmerframe');

  const state: Partial<CompiledASTNodes> & {
    potentialStoriesFunctionDeclaration: ESTreeAST.FunctionDeclaration[];
  } = { potentialStoriesFunctionDeclaration: [] };
  const { body } = ast as ESTreeAST.Program;
  const imports = findMetaImports(body);
  const meta = findMeta(body, imports, filename);

  const visitors: Visitors<ESTreeAST.Node | ESTreeAST.Comment, typeof state> = {
    FunctionDeclaration(node, { state }) {
      state.potentialStoriesFunctionDeclaration.push(node);
    },

    ExportDefaultDeclaration(node, { state }) {
      state.exportDefault = node;
      if (node.declaration.type === 'FunctionDeclaration') {
        /*
        In production, Svelte will compile the component to:
        export default COMPONENT_NAME () {...}
        */
        state.storiesFunctionDeclaration = node.declaration as ESTreeAST.FunctionDeclaration;
      } else if (node.declaration.type === 'Identifier') {
        /*
        In development, Svelte will compile the component to:
        function COMPONENT_NAME () {...}
        export default COMPONENT_NAME;
        */
        const { name } = node.declaration as ESTreeAST.Identifier;
        state.storiesFunctionDeclaration = state.potentialStoriesFunctionDeclaration?.find(
          (potential) => potential.id.name === name
        );
      }
    },
  };

  walk(ast as ESTreeAST.Program, state, visitors);

  const { exportDefault, storiesFunctionDeclaration } = state;

  if (!hasMetaImport(imports)) {
    if (imports.hasDefaultOrNamespaceImport) {
      throw new DefaultOrNamespaceImportUsedError(filename);
    }

    throw new MissingImportedDefineMetaError(filename);
  }

  if (!meta) {
    throw new MissingDefineMetaVariableDeclarationError(filename);
  }

  if (!exportDefault) {
    throw new NoExportDefaultError(filename);
  }

  if (meta.storyNames.length === 0) {
    throw new NoStoryIdentifierFoundError(filename);
  }

  if (!storiesFunctionDeclaration) {
    throw new NoStoriesFunctionDeclarationError(filename);
  }

  return {
    isFactory: meta.isFactory,
    defineMetaVariableDeclaration: meta.declaration,
    metaIdentifier: meta.metaIdentifier,
    exportDefault,
    storyNames: meta.storyNames,
    storiesFunctionDeclaration,
  };
}
