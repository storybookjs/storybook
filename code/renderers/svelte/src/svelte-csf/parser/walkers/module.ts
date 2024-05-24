import type { Script, SvelteNode } from 'svelte/compiler';
import type { Visitors } from 'zimmerframe';

import pkg from '../../../package.json' with { type: 'json' };

import { ADDON_AST_NODES, type AddonASTNodes } from '../types.js';

export async function walkOnModule(module: Script): Promise<AddonASTNodes> {
  const { walk } = await import('zimmerframe');
  
  const state: Partial<AddonASTNodes> = {};
  const visitors: Visitors<SvelteNode, typeof state> = {
    ImportDeclaration(node, { state }) {
      const { source, specifiers } = node;

      if (
        source.value === pkg.name ||
        // FIXME:
        // This should be for this package testing purpose only.
        // Need a condition to prevent it running outside this package
        (typeof source.value === 'string' && source.value.includes('src/index'))
      ) {
        for (const specifier of specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            throw new Error(`Don't use the default/namespace import from "${pkg.name}"`);
          }

          if (specifier.imported.name === ADDON_AST_NODES.defineMeta) {
            state.defineMetaImport = specifier;
          }
        }

        if (!state.defineMetaImport) {
          throw new Error(
            `Could not find '${ADDON_AST_NODES.defineMeta}' imported from the "${pkg.name}" in the Stories file`
          );
        }
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
        state.defineMetaVar = node;

        for (const property of id.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === ADDON_AST_NODES.Story &&
            property.value.type === 'Identifier'
          ) {
            state.Story = property.value;
          }
        }

        if (!state.Story) {
          throw new Error(
            `Component 'Story' was not destructured from the '${state.defineMetaImport.local.name}({ ... })' function call`
          );
        }
      }

      if (!state.defineMetaVar) {
        throw new Error(
          `Couldn't find the variable declarator with function call of '${state.defineMetaImport?.local.name}({ ... })' inside the module tag ('<script context="module">')`
        );
      }
    },
  };

  walk(module.content, state, visitors);

  const { defineMetaImport, defineMetaVar, Story } = state;

  if (!defineMetaImport || !defineMetaVar || !Story) {
    throw new Error('Could not extract Story or defineMeta from walking on the module tag');
  }

  return {
    defineMetaImport,
    defineMetaVar,
    Story,
  };
}
