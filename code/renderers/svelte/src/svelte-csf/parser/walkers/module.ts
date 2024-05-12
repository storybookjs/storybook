import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { ObjectExpression, Property } from 'estree';
import { walk } from 'estree-walker';
import type { Root, SvelteNode } from 'svelte/compiler';

import type { ModuleMeta } from '../types.js';

export function walkOnModule(module: Root['module']): ModuleMeta {
  const moduleMeta: ModuleMeta = {};

  if (!module) {
    throw new Error(
      `The story file must have a module tag ('<script context="module">') with 'export const meta'.`
    );
  }

  walk(module.content, {
    enter(node: SvelteNode) {
      if (node.type === 'ExportNamedDeclaration') {
        const { declaration, leadingComments } = node;

        if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'const') {
          throw new Error(
            `The 'export' inside the module tag ('<script context="module">') is not a 'const meta'`
          );
        }

        const { declarations } = declaration;

        if (declarations.length !== 1) {
          throw new Error(
            `'<script context="module">' should have only one export - 'export const meta'`
          );
        }

        const { id, init } = declarations[0];

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

        const { properties } = init;

        moduleMeta.id = getStringFromExportMeta('id', properties);
        moduleMeta.title = getStringFromExportMeta('title', properties);
        moduleMeta.tags = getTagsFromExportMeta(properties);

        if (leadingComments) {
          moduleMeta.description = dedent(leadingComments[0].value.replaceAll(/^ *\*/gm, ''));
        }
      }
    },
    leave(node: SvelteNode) {
      //
    },
  });

  return moduleMeta;
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

function getTagsFromExportMeta(properties: ObjectExpression['properties']) {
  const tags = lookupMetaProperty('tags', properties);

  if (tags) {
    let { value } = tags;

    // NOTE: I think it would be more convienient with `zod`
    if (value.type === 'ArrayExpression' && value.elements.length === 1) {
      return value.elements.map((el) => {
        if (el?.type === 'Literal') {
          if (typeof el.value !== 'string') {
            throw Error(`meta.tags should be an array of strings.`);
          }
          return el.value;
        } else {
          throw Error(`'meta.tags' should be an array of strings.`);
        }
      });
    }
  }
}

/**
 * WARN: Potential issue, some of the properites might be extended by `SpreadElement`.
 * I couldn't think of the case how it could be reached, if the code was already compiled.
 * I'll leave a warning, to avoid confusion during usage, and in case it actually happens.
 */
function lookupMetaProperty(name: string, properties: ObjectExpression['properties']) {
  return properties.find((p) => {
    if (p.type === 'SpreadElement') {
      logger.warn(
        `Spread operator is not supported in the 'export const meta' export. Please file an issue with an usage case.`
      );
    }

    p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name;
  }) as Property | undefined;
}
