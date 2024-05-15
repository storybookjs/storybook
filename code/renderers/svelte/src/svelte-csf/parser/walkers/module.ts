import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { ObjectExpression, Property } from 'estree';
import type { Root, SvelteNode } from 'svelte/compiler';
import { type Visitors, walk } from 'zimmerframe';

import type { ModuleMeta } from '../types.js';

export function walkOnModule(module: Root['module']): ModuleMeta {
  if (!module) {
    throw new Error(
      `The story file must have a module tag ('<script context="module">') with 'export const meta'.`
    );
  }

  const state: ModuleMeta = {};
  const visitors: Visitors<SvelteNode, typeof state> = {
    ExportNamedDeclaration(node, { state, stop, visit }) {
      const { declaration, leadingComments } = node;

      if (leadingComments) {
        state.description = dedent(leadingComments[0].value.replaceAll(/^ *\*/gm, ''));
      }

      if (!declaration) {
        throw new Error(
          `The 'export' inside the module tag ('<script context="module">') should be a 'const meta'`
        );
      }

      visit(declaration, state);
      stop();
    },
    VariableDeclaration(node, { state, stop, visit }) {
      if (node.kind !== 'const') {
        throw new Error(`The type of variable export should be a 'const' - 'export const meta'.`);
      }
      const { declarations } = node;

      if (declarations.length !== 1) {
        throw new Error(
          `'<script context="module">' should have only one export - 'export const meta'`
        );
      }

      visit(declarations[0], state);
      stop();
    },
    // Walk on `expost const meta` `
    VariableDeclarator(node, { state, visit, stop }) {
      const { id, init } = node;

      if (id.type !== 'Identifier' || id.name !== 'meta') {
        throw new Error(
          `The 'export const' in '<script context="module">' should be called 'meta'`
        );
      }

      if (init?.type !== 'ObjectExpression') {
        throw new Error(
          `'export const meta' should be an object which matches the interface "'import('@storybook/svelte').Meta'"`
        );
      }

      visit(init, state);
      stop();
    },
    // Walk on `expost const meta` properties
    ObjectExpression(node, { state, stop }) {
      const { properties } = node;

      state.id = getStringFromExportMeta('id', properties);
      state.title = getStringFromExportMeta('title', properties);
      state.tags = getTagsFromExportMeta(properties);

      stop();
    },
  };

  walk(module.content, state, visitors);

  return state;
}

function getStringFromExportMeta(propertyName: string, properties: ObjectExpression['properties']) {
  const property = lookupMetaProperty(propertyName, properties);

  if (property && property.value.type === 'Literal') {
    const { value } = property.value;
    if (value) {
      if (typeof value === 'string') {
        return value;
      } else {
        throw new Error(`'meta.${propertyName}' should be a string, found ${typeof value}`);
      }
    }
  }
}

/**
 * WARN: Potential issue, some of the properites might be extended by `SpreadElement`.
 * I couldn't think of the case how it could be ever reached, if the code was already "compiled"(?).
 * I'll leave a warning, to avoid confusion during usage, and in case it actually happens.
 */
function lookupMetaProperty(name: string, properties: ObjectExpression['properties']) {
  return properties.find((p) => {
    if (p.type === 'SpreadElement') {
      logger.warn(
        `Spread operator is not supported in the 'export const meta' export. Please file an issue with an usage case.`
      );
    }

    return p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name;
  }) as Property | undefined;
}

function getTagsFromExportMeta(properties: ObjectExpression['properties']) {
  const tags = lookupMetaProperty('tags', properties);

  if (tags) {
    const { value } = tags;

    if (value.type === 'ArrayExpression') {
      return value.elements.map((item) => {
        if (item?.type === 'Literal') {
          if (typeof item.value !== 'string') {
            throw Error(`meta.tags should be an array of strings.`);
          }

          return item.value;
        } else {
          throw Error(`'meta.tags' should be an array of strings.`);
        }
      });
    }
  }
}
