import { isSvelteCsfImportSource } from '../../../utils/import-source.ts';
import type { Visitors } from 'zimmerframe';

import type { ESTreeAST, SvelteAST } from '../../ast.ts';
import {
  DefaultOrNamespaceImportUsedError,
  MissingDefineMetaImportError,
  MissingDefineMetaVariableDeclarationError,
  MissingModuleTagError,
  NoStoryComponentDestructuredError,
} from '../../../utils/error/parser/extract/svelte.ts';
import type { Identifier } from 'estree';

const AST_NODES_NAMES = {
  defineMeta: 'defineMeta',
  Story: 'Story',
} as const;

interface Result {
  /**
   * Import specifier for `defineMeta`, imported from one of `SVELTE_CSF_IMPORT_SOURCES`.
   * Could be renamed - e.g. `import { defineMeta as df } from "@storybook/svelte"`
   */
  defineMetaImport: ESTreeAST.ImportSpecifier;
  /**
   * Variable declaration: `const { Story } = defineMeta({ })`
   * Could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
   */
  defineMetaVariableDeclaration: ESTreeAST.VariableDeclaration;
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

  const { walk } = await import('zimmerframe');

  const state: Partial<Result> = {};
  let hasDefaultOrNamespaceImport = false;
  const visitors: Visitors<SvelteAST.SvelteNode, typeof state> = {
    ImportDeclaration(node, { state, visit }) {
      const { source, specifiers } = node;

      if (isSvelteCsfImportSource(source.value)) {
        for (const specifier of specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            // The main entry has other exports, so this is only an error without a named `defineMeta` import
            hasDefaultOrNamespaceImport = true;
            continue;
          }

          visit(specifier, state);
        }
      }
    },

    ImportSpecifier(node) {
      if ('name' in node.imported && node.imported.name === AST_NODES_NAMES.defineMeta) {
        state.defineMetaImport = node;
      }
    },

    VariableDeclaration(node, { state }) {
      const { declarations } = node;
      const declaration = declarations[0];
      const { id, init } = declaration;

      if (
        id.type === 'ObjectPattern' &&
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === state.defineMetaImport?.local.name
      ) {
        state.defineMetaVariableDeclaration = node;

        for (const property of id.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === AST_NODES_NAMES.Story &&
            property.value.type === 'Identifier'
          ) {
            state.storyIdentifier = property.value;
          }
        }
      }
    },
  };

  walk(module.content, state, visitors);

  const { defineMetaImport, defineMetaVariableDeclaration, storyIdentifier } = state;

  if (!defineMetaImport) {
    if (hasDefaultOrNamespaceImport) {
      throw new DefaultOrNamespaceImportUsedError(filename);
    }

    throw new MissingDefineMetaImportError(filename);
  }

  if (!defineMetaVariableDeclaration) {
    throw new MissingDefineMetaVariableDeclarationError(filename);
  }

  if (!storyIdentifier) {
    throw new NoStoryComponentDestructuredError({ filename, defineMetaImport });
  }

  return {
    defineMetaImport,
    defineMetaVariableDeclaration,
    storyIdentifier,
  };
}
