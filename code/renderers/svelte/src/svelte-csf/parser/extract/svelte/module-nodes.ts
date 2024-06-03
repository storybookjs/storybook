import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { Identifier, ImportSpecifier, VariableDeclaration } from 'estree';
import type { Root, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

const AST_NODES_NAMES = {
  defineMeta: 'defineMeta',
  setTemplate: 'setTemplate',
  Story: 'Story',
} as const;

interface Result {
  /**
   * Import specifier for `defineMeta` imported from this addon package.
   * Could be renamed - e.g. `import { defineMeta as df } from "@storybook/addon-svelte-csf"`
   */
  defineMetaImport: ImportSpecifier;
  /**
   * Import specifier for `setTemplate` imported from this addon package.
   * Could be renamed - e.g. `import { setTemplate as st } from "@storybook/addon-svelte-csf"`
   */
  setTemplateImport: ImportSpecifier | undefined;
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
}

interface Params {
  module: Root['module'];
  filename?: string;
}

/**
 * Extract Svelte AST nodes via `svelte.compile`,
 * and from the module tag - `<script context=module>`.
 * They are needed for further code analysis/transformation.
 */
export async function extractModuleNodes(options: Params): Promise<Result> {
  const { module, filename } = options;

  // TODO: Perhaps we can use some better way to insert error messages?
  // String interpolations doesn't feel right if we want to provide a whole example (code snippet).
  if (!module) {
    throw new Error(
      `Couldn't find a module tag. Add (<script context="module">) to the stories file: ${filename}`
    );
  }

  const { walk } = await import('zimmerframe');

  const state: Partial<Result> = {};
  const visitors: Visitors<SvelteNode, typeof state> = {
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

      if (node.imported.name === AST_NODES_NAMES.setTemplate) {
        state.setTemplateImport = node;
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

  const { defineMetaImport, setTemplateImport, defineMetaVariableDeclaration, storyIdentifier } =
    state;

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
    throw new Error(
      `Component 'Story' was not destructured from the '${defineMetaImport.local.name}({ ... })' function call. Use 'const { Story } = defineMeta({ ... })' in the stories file: ${filename}`
    );
  }

  return {
    defineMetaImport,
    setTemplateImport,
    defineMetaVariableDeclaration,
    storyIdentifier,
  };
}
