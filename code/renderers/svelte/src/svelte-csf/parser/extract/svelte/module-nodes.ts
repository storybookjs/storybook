import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { Visitors } from 'zimmerframe';

import type { ESTreeAST, SvelteAST } from '$lib/parser/ast.js';
import {
  DefaultOrNamespaceImportUsedError,
  MissingDefineMetaImportError,
  MissingDefineMetaVariableDeclarationError,
  MissingModuleTagError,
  NoStoryComponentDestructuredError,
} from '$lib/utils/error/parser/extract/svelte.js';

const AST_NODES_NAMES = {
  defineMeta: 'defineMeta',
  Story: 'Story',
} as const;

interface Result {
  /**
   * Import specifier for `defineMeta` imported from this addon package.
   * Could be renamed - e.g. `import { defineMeta as df } from "@storybook/addon-svelte-csf"`
   */
  defineMetaImport: ESTreeAST.ImportSpecifier;
  /**
   * Variable declaration: `const { Story } = defineMeta({ })`
   * Could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
   */
  defineMetaVariableDeclaration: ESTreeAST.VariableDeclaration;
  /**
   * An identifier for the addon's component `<Story />`.
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
  const visitors: Visitors<SvelteAST.SvelteNode, typeof state> = {
    ImportDeclaration(node, { state, visit }) {
      const { source, specifiers } = node;

      if (source.value === pkg.name) {
        for (const specifier of specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            throw new DefaultOrNamespaceImportUsedError(filename);
          }

          visit(specifier, state);
        }
      }
    },

    ImportSpecifier(node, {}) {
      if (node.imported.name === AST_NODES_NAMES.defineMeta) {
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

  const { defineMetaImport, defineMetaVariableDeclaration, storyIdentifier } =
    state;

  if (!defineMetaImport) {
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
