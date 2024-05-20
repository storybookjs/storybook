import { logger } from '@storybook/client-logger';
import dedent from 'dedent';
import type { ObjectExpression, Property } from 'estree';
import type { Root, SvelteNode } from 'svelte/compiler';
import { type Visitors, walk } from 'zimmerframe';

import pkg from '../../../package.json' with { type: 'json' };

import {
  ADDON_COMPONENT_NAME,
  ADDON_FN_NAME,
  ADDON_META_VAR_NAME,
  type ModuleMeta,
} from '../types.js';

export function walkOnModule(module: Root['module']): ModuleMeta {
  if (!module) {
    throw new Error(`The story file must have a module tag ('<script context="module">').`);
  }

  const state: Partial<ModuleMeta> = {};
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

          const { imported, local } = specifier;

          if (imported.name === ADDON_FN_NAME) {
            state.addonFnName = local.name;
          }
        }
      }
    },

    // ExportNamedDeclaration(node, { state }) {
    // 	const { declaration, leadingComments } = node;
    //
    // 	if (leadingComments) {
    // 		state.description = dedent(
    // 			leadingComments[0].value.replaceAll(/^ *\*/gm, ""),
    // 		);
    // 	}
    //
    // 	if (
    // 		declaration &&
    // 		declaration.type === "VariableDeclaration" &&
    // 		declaration.kind === "const" &&
    // 		declaration.declarations[0].id.type === "Identifier" &&
    // 		declaration.declarations[0].id.name === "meta" &&
    // 		declaration.declarations[0].init?.type === "ObjectExpression"
    // 	) {
    // 		const { init, leadingComments } = declaration.declarations[0];
    // 		const { properties } = init;
    //
    // 		if (leadingComments) {
    // 			state.description = dedent(
    // 				leadingComments[0].value.replaceAll(/^ *\*/gm, ""),
    // 			);
    // 		}
    //
    // 		state.id = getStringFromMeta("id", properties);
    // 		state.title = getStringFromMeta("title", properties);
    // 		state.tags = getTagsFromMeta(properties);
    // 	}
    // },

    VariableDeclaration(node, { state, visit }) {
      const { declarations, leadingComments } = node;
      const declaration = declarations[0];
      const { id, init } = declaration;

      if (
        id.type === 'ObjectPattern' &&
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === state.addonFnName
      ) {
        visit(init, state);

        if (leadingComments) {
          state.description = dedent(leadingComments[0].value.replaceAll(/^ *\*/gm, ''));
        }

        for (const property of id.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === ADDON_COMPONENT_NAME &&
            property.value.type === 'Identifier'
          ) {
            state.addonComponentName = property.value.name;
          }

          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === ADDON_META_VAR_NAME &&
            property.value.type === 'Identifier'
          ) {
            state.addonMetaVarName = property.value.name;
          }
        }
      }
    },

    // Walk on `defineMeta` call called by `visit` from `VariableDeclarator`
    CallExpression(node, { state, stop }) {
      if (node.arguments.length !== 1) {
        throw new Error('defineMeta takes 1 argument only');
      }

      const objectExpression = node.arguments[0];

      if (objectExpression.type !== 'ObjectExpression') {
        throw new Error('defineMeta takes an object literal which satisfies Meta');
      }

      const { properties } = objectExpression;

      // FIXME: Why we need them during parsing time?
      // state.id = getStringFromMeta("id", properties);
      // state.title = getStringFromMeta("title", properties);
      state.tags = getTagsFromMeta(properties);

      stop();
    },
  };

  walk(module.content, state, visitors);

  if (!state.addonFnName) {
    throw new Error(
      `Could not find the 'import { defineComponent } from "${pkg.name}";' in the module tag ('<script context="module">')`
    );
  }

  if (!state.addonComponentName) {
    throw new Error(
      `Could not find the destructured 'Story' component from ${state.addonFnName}({ ... })')`
    );
  }

  if (!state.addonMetaVarName) {
    throw new Error(
      `Could not find the destructured 'meta' component from ${state.addonFnName}({ ... })')`
    );
  }

  return {
    ...state,
    addonFnName: state.addonFnName,
    addonComponentName: state.addonComponentName,
    addonMetaVarName: state.addonMetaVarName,
  };
}

function getStringFromMeta(propertyName: string, properties: ObjectExpression['properties']) {
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
        `Spread operator is not supported in the 'defineMeta' literal object. Please file an issue with an use case.`
      );
    }

    return p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === name;
  }) as Property | undefined;
}

function getTagsFromMeta(properties: ObjectExpression['properties']) {
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
