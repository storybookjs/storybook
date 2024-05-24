import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { SvelteNode } from 'svelte/compiler';
import type { ObjectExpression, Property } from 'estree';
import type { Visitors } from 'zimmerframe';

import type { AddonASTNodes, DefineMeta } from '../types.js';

export async function walkOnDefineMeta(nodes: AddonASTNodes): Promise<DefineMeta> {
  const { walk } = await import('zimmerframe');
  
  const state: Partial<DefineMeta> = {};
  const visitors: Visitors<SvelteNode, typeof state> = {
    // Walk on `const { ... } = defineMeta()`
    VariableDeclaration(node, { state, visit }) {
      const { declarations, leadingComments } = node;

      if (leadingComments) {
        state.description = dedent(leadingComments[0].value.replaceAll(/^ *\*/gm, ''));
      }

      const declaration = declarations[0];
      const { id, init } = declaration;

      if (
        id.type === 'ObjectPattern' &&
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier'
      ) {
        visit(init, state);
      }
    },

    // Walk on `defineMeta` function call - called by `visit()` from `VariableDeclarator`
    CallExpression(node, { state, stop }) {
      if (node.arguments.length !== 1) {
        throw new Error(
          `Function '${nodes.defineMetaImport.local.name}({ ... })' takes 1 argument only`
        );
      }

      if (node.arguments[0].type !== 'ObjectExpression') {
        throw new Error(
          `Function '${nodes.defineMetaImport?.local.name}({ ... })' takes an object literal which satisfies Meta`
        );
      }

      const { properties } = node.arguments[0];

      state.id = getString('id', properties);
      state.title = getString('title', properties);
      state.tags = getTags(properties);

      stop();
    },
  };

  walk(nodes.defineMetaVar, state, visitors);

  return state;
}

function getString(propertyName: string, properties: ObjectExpression['properties']) {
  const property = lookupProperty(propertyName, properties);

  if (property && property.value.type === 'Literal') {
    const { value } = property.value;

    if (value) {
      if (typeof value === 'string') {
        return value;
      }

      throw new Error(`'meta.${propertyName}' should be a string, found ${typeof value}`);
    }
  }
}

function getTags(properties: ObjectExpression['properties']) {
  const tags = lookupProperty('tags', properties);

  if (tags) {
    const { value } = tags;

    if (value.type === 'ArrayExpression') {
      return value.elements.map((item) => {
        if (item?.type === 'Literal') {
          if (typeof item.value !== 'string') {
            throw Error(`'meta.tags' should be an array of strings.`);
          }

          return item.value;
        }

        throw Error(`'meta.tags' should be an array of strings.`);
      });
    }
  }
}

/**
 * WARN: Potential issue, some of the properites might be extended by `SpreadElement`.
 * I couldn't think of the case how it could be ever reached, if the code was already "compiled"(?).
 * I'll leave a warning, to avoid confusion during usage, and in case it actually happens.
 */
function lookupProperty(name: string, properties: ObjectExpression['properties']) {
  return properties.find((p) => {
    if (p.type === 'SpreadElement') {
      logger.warn(
        `Spread operator is not supported in the 'defineMeta' literal object. Please file an issue with an use case.`
      );
    }

    return p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name;
  }) as Property | undefined;
}
