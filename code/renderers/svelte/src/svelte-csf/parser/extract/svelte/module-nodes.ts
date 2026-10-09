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
  /** `true` when the meta comes from `preview.meta()`, which creates a CSF factories meta. */
  isFactory: boolean;
  /**
   * Variable declaration with the meta call: `const { Story } = defineMeta({ })`, or
   * `preview.meta({ })` in place of `defineMeta({ })`. It can also be `const meta =
   * preview.meta({ })`, followed by `const { Story } = meta`.
   */
  defineMetaVariableDeclaration: ESTreeAST.VariableDeclaration;
  /** `meta` in `const meta = preview.meta({ })`. */
  metaIdentifier?: ESTreeAST.Identifier;
  /**
   * An identifier for the `<Story />` component.
   * It could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
   */
  storyIdentifier: ESTreeAST.Identifier;
}

interface Params {
  module: SvelteAST.Root['module'];
  filename?: string;
}

/**
 * Extract Svelte AST nodes via `svelte.compile`,
 * and from the module tag - `<script module>`.
 * They are needed for further code analysis/transformation.
 */
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

  if (!meta.storyIdentifier) {
    throw new NoStoryComponentDestructuredError({
      filename,
      metaFunctionName: meta.functionName,
    });
  }

  return {
    isFactory: meta.isFactory,
    defineMetaVariableDeclaration: meta.declaration,
    metaIdentifier: meta.metaIdentifier,
    storyIdentifier: meta.storyIdentifier,
  };
}
