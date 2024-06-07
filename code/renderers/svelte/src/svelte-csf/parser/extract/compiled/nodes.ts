import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type {
  Comment,
  ExportDefaultDeclaration,
  FunctionDeclaration,
  Identifier,
  ImportSpecifier,
  Node,
  Program,
  VariableDeclaration,
} from 'estree';
import type { Visitors } from 'zimmerframe';

/**
 * Important AST nodes from the compiled output of a single `*.stories.svelte` file.
 * They are needed for further code transformation by this addon.
 * Powered by `rollup`'s internal [`this.parse()`](https://rollupjs.org/plugin-development/#this-parse)
 */
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
   * Store the `export default declaration`, we will need to remove it later.
   * Why? Storybook expects `export default meta`, instead of what `@sveltejs/vite-plugin-svelte` will produce.
   */
  exportDefault: ExportDefaultDeclaration;
  /**
   * An identifier for the addon's component `<Story />`.
   * It could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
   */
  storyIdentifier: Identifier;
  /**
   * A function declaration for the main Svelte component which is the `*.stories.svelte` file.
   */
  storiesFunctionDeclaration: FunctionDeclaration;
}

const AST_NODES_NAMES = {
  defineMeta: 'defineMeta',
  Story: 'Story',
} as const;

interface Params {
  ast: Program;
  filename?: string;
}

/**
 * Extract compiled AST nodes from Vite _(via `rollup`)_.
 * Those nodes are required for further code transformation.
 */
export async function extractCompiledASTNodes(params: Params): Promise<CompiledASTNodes> {
  const { walk } = await import('zimmerframe');

  const { ast, filename } = params;
  const state: Partial<CompiledASTNodes> & {
    potentialStoriesFunctionDeclaration: FunctionDeclaration[];
  } = { potentialStoriesFunctionDeclaration: [] };
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
        state.storiesFunctionDeclaration = node.declaration as FunctionDeclaration;
      } else if (node.declaration.type === 'Identifier') {
        /*
        In development, Svelte will compile the component to:
        function COMPONENT_NAME () {...}
        export default COMPONENT_NAME;
        */
        const { name } = node.declaration as Identifier;
        state.storiesFunctionDeclaration = state.potentialStoriesFunctionDeclaration?.find(
          (potential) => potential.id.name === name
        );
      }
    },
  };

  walk(ast, state, visitors);

  const {
    defineMetaImport,
    defineMetaVariableDeclaration,
    exportDefault,
    storyIdentifier,
    storiesFunctionDeclaration,
  } = state;

  if (!defineMetaImport) {
    throw new Error(
      `Could not find '${AST_NODES_NAMES.defineMeta}' imported from the "${pkg.name}" in the compiled output of stories file: ${filename}`
    );
  }

  if (!defineMetaVariableDeclaration) {
    throw new Error(
      `Could not find '${defineMetaImport.local.name}({ ... })' in the compiled output of the stories file: ${filename}`
    );
  }

  if (!exportDefault) {
    throw new Error(
      `Could not find 'export default' in the compiled output of the stories file: ${filename}`
    );
  }

  if (!storyIdentifier) {
    throw new Error(
      `Could not find 'Story' identifier in the compiled output of the stories file: ${filename}`
    );
  }

  if (!storiesFunctionDeclaration) {
    throw new Error(
      `Could not find the stories component '*.stories.svelte' function in the compiled output of the stories file: ${filename}`
    );
  }

  return {
    defineMetaImport,
    defineMetaVariableDeclaration,
    exportDefault,
    storyIdentifier,
    storiesFunctionDeclaration,
  };
}
