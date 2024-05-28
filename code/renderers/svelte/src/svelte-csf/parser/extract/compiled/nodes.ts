import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type {
  Comment,
  FunctionDeclaration,
  Identifier,
  ImportSpecifier,
  Node,
  Program,
  VariableDeclaration,
} from 'estree';
import type { Visitors } from 'zimmerframe';

export interface CompiledASTNodes {
  /**
   * Import specifier for `defineMeta` imported from this addon package.
   * Could be renamed - e.g. `import { defineMeta } from "@storybook/addon-svelte-csf"`
   */
  defineMetaImport: ImportSpecifier;
  /**
   * Variable declaration: `const { Story } = defineMeta({ })`
   * Could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
   */
  defineMetaVariableDeclaration: VariableDeclaration;
  /**
   * An identifier for the addon's component `<Story />`.
   * It could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
   */
  storyIdentifier: Identifier;
  /**
   *
   */
  storiesFunctionDeclaration: FunctionDeclaration;
}

const AST_NODES_NAMES = {
  defineMeta: 'defineMeta',
  Story: 'Story',
} as const;

interface Params {
  ast: Program;
  filename: string;
}

/**
 * Extract compiled AST nodes from Vite _(via `rollup`)_.
 * Those nodes are required for further code transformation.
 */
export async function extractCompiledASTNodes(params: Params): Promise<CompiledASTNodes> {
  const { walk } = await import('zimmerframe');

  const { ast, filename } = params;
  const state: Partial<CompiledASTNodes> = {};
  const visitors: Visitors<Node | Comment, typeof state> = {
    ImportDeclaration(node, { state, visit }) {
      const { source, specifiers } = node;

      if (source.value === pkg.name) {
        for (const specifier of specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            throw new Error(
              `Don't use the default/namespace import from "${pkg.name}" in the stories file: ${filename}`
            );
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

    ExportDefaultDeclaration(node, { state }) {
      // NOTE: This may be confusing.
      // In the dev mode the export default is different (Identifier to FunctionDeclaration)
      if (process.env['NODE_ENV'] !== 'development') {
        if (node.declaration.type !== 'FunctionDeclaration') {
          throw new Error(
            `Expected FunctionDeclaration as the default export in the compiled code for stories file: ${filename}`
          );
        }

        state.storiesFunctionDeclaration = node.declaration as FunctionDeclaration;
      }
    },

    FunctionDeclaration(node, { state, stop }) {
      if (process.env['NODE_ENV'] === 'development') {
        if (node.id.name.endsWith('stories')) {
          // NOTE:
          // Is an `export default function <Component>_stories` - we want this one.
          // We will remove the `export default` later
          state.storiesFunctionDeclaration = node;
          stop();
        }
      }
    },
  };

  walk(ast, state, visitors);

  const {
    defineMetaImport,
    defineMetaVariableDeclaration,
    storyIdentifier,
    storiesFunctionDeclaration,
  } = state;

  if (!defineMetaImport) {
    throw new Error(
      `Could not find '${AST_NODES_NAMES.defineMeta}' imported from the "${pkg.name}" in the stories file: ${filename}`
    );
  }

  if (!defineMetaVariableDeclaration) {
    throw new Error(
      `Could not find '${defineMetaImport.local.name}({ ... })' call in the module tag ('<script context="module">') of the stories file: ${filename}`
    );
  }

  if (!storyIdentifier) {
    throw new Error(`No story identifier found.`);
  }

  if (!storiesFunctionDeclaration) {
    throw new Error(`No stories function declaration found.`);
  }

  return {
    defineMetaImport,
    defineMetaVariableDeclaration,
    storyIdentifier,
    storiesFunctionDeclaration,
  };
}
