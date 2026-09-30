import fs from 'node:fs/promises';

import { isSvelteCsfImportSource } from '../utils/import-source.ts';
import { preprocess } from 'svelte/compiler';
import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte';
import type { IndexInput } from 'storybook/internal/types';

import { getSvelteAST, type ESTreeAST, type SvelteAST } from '../parser/ast.ts';
import { extractStoryAttributesNodes } from '../parser/extract/svelte/story/attributes.ts';
import { getStoryIdentifiers } from '../parser/analyse/story/attributes/identifiers.ts';
import { getArrayOfStringsValueFromAttribute } from '../parser/analyse/story/attributes.ts';
import {
  getPropertyArrayOfStringsValue,
  getPropertyStringValue,
} from '../parser/analyse/define-meta/properties.ts';
import {
  DefaultOrNamespaceImportUsedError,
  GetDefineMetaFirstArgumentError,
  MissingDefineMetaImportError,
  MissingModuleTagError,
  NoStoryComponentDestructuredError,
} from '../utils/error/parser/extract/svelte.ts';
import { NoDestructuredDefineMetaCallError } from '../utils/error/parser/analyse/define-meta.ts';
import {
  StoryTemplateAndChildrenError,
  StoryTemplateAndAsChildError,
  StoryAsChildWithoutChildrenError,
} from '../utils/error/parser/analyse/story.ts';
import { extractStoryTemplateSnippetBlock } from '../parser/extract/svelte/story/template.ts';

interface Results {
  meta: Pick<IndexInput, 'title' | 'tags'>;
  stories: Array<Pick<IndexInput, 'exportName' | 'name' | 'tags'>>;
}

/**
 * The indexer runs once per `*.stories.svelte` file, while the Svelte config is per-project state.
 * Cache the lookup so the config-file scan runs once per process instead of once per story file —
 * without this, projects without a `svelte.config.js` get one
 * "no Svelte config found ... using default configuration" log line per story file.
 * Trade-off: adding or changing a svelte.config file while `storybook dev` runs requires a restart to be picked up.
 */
let svelteConfigPromise: Promise<Partial<SvelteConfig> | undefined> | undefined;

async function loadCachedSvelteConfig(): Promise<Partial<SvelteConfig> | undefined> {
  svelteConfigPromise ??= import('@sveltejs/vite-plugin-svelte')
    .then(({ loadSvelteConfig }) => loadSvelteConfig())
    .catch((error) => {
      // Don't cache failures (e.g. a broken svelte.config.js), so the next indexing run retries.
      svelteConfigPromise = undefined;
      throw error;
    });
  return svelteConfigPromise;
}

export async function parseForIndexer(filename: string): Promise<Results> {
  const [rawCode, { walk }, svelteConfig] = await Promise.all([
    fs.readFile(filename, { encoding: 'utf8' }),
    import('zimmerframe'),
    loadCachedSvelteConfig(),
  ]);

  let code = rawCode;

  if (svelteConfig?.preprocess) {
    code = (
      await preprocess(code, svelteConfig.preprocess, {
        filename: filename,
      })
    ).code;
  }

  const svelteAST = getSvelteAST({ code, filename });
  const results: Results & {
    defineMetaImport?: ESTreeAST.ImportSpecifier;
    defineMetaStory?: ESTreeAST.Identifier;
  } = {
    meta: {},
    stories: [],
  };

  let hasDefaultOrNamespaceImport = false;

  walk(svelteAST as SvelteAST.SvelteNode | SvelteAST.Script, results, {
    _(_node, context) {
      const { next, state } = context;
      next(state);
    },

    Root(node, context) {
      const { fragment, module } = node;
      const { state, visit } = context;

      if (!module) {
        throw new MissingModuleTagError(filename);
      }

      visit(module, state);
      visit(fragment, state);
    },

    Script(node, context) {
      const { content } = node;
      const { state, visit } = context;

      visit(content, state);
    },

    Program(node, context) {
      const { body } = node;
      const { state, visit } = context;

      for (const statement of body) {
        if (
          statement.type === 'ImportDeclaration' &&
          isSvelteCsfImportSource(statement.source.value)
        ) {
          visit(statement, state);
        }

        if (statement.type === 'VariableDeclaration') {
          visit(statement, state);
        }
      }
    },

    ImportDeclaration(node, context) {
      const { specifiers } = node;
      const { state } = context;

      for (const specifier of specifiers) {
        if (specifier.type !== 'ImportSpecifier') {
          // The main entry has other exports, so this is only an error without a named `defineMeta` import
          hasDefaultOrNamespaceImport = true;
          continue;
        }
        if (!('name' in specifier.imported)) {
          return;
        }

        if (specifier.imported.name === 'defineMeta') {
          state.defineMetaImport = specifier;
        }
      }
    },

    VariableDeclaration(node, context) {
      const { declarations } = node;
      const { state, visit } = context;
      const { id, init } = declarations[0];

      if (init?.type === 'CallExpression') {
        const { arguments: arguments_, callee } = init;

        if (callee.type === 'Identifier' && callee.name === state.defineMetaImport?.local.name) {
          if (id?.type !== 'ObjectPattern') {
            throw new NoDestructuredDefineMetaCallError({
              defineMetaVariableDeclarator: declarations[0],
              filename,
            });
          }

          const { properties } = id;
          const destructuredStoryIdentifier = properties.find(
            (property) =>
              property.type === 'Property' &&
              property.key.type === 'Identifier' &&
              property.key.name === 'Story'
          ) as ESTreeAST.Property | undefined;

          if (!destructuredStoryIdentifier) {
            throw new NoStoryComponentDestructuredError({
              filename,
              defineMetaImport: state.defineMetaImport,
            });
          }

          state.defineMetaStory = destructuredStoryIdentifier.value as ESTreeAST.Identifier;

          if (arguments_[0].type !== 'ObjectExpression') {
            throw new GetDefineMetaFirstArgumentError({
              filename,
              defineMetaVariableDeclaration: node,
            });
          }

          visit(arguments_[0], state);
        }
      }
    },

    // NOTE: We assume this one is value of first argument passed to `defineMeta({ ... })` call
    ObjectExpression(node, context) {
      const { properties } = node;
      const { state, visit } = context;

      for (const property of properties) {
        if (property.type === 'Property' && property.key.type === 'Identifier') {
          visit(property, state);
        }
      }
    },

    // NOTE: We assume these properties are from the `defineMeta` object expression
    Property(node: ESTreeAST.Property, context) {
      const { key } = node as ESTreeAST.Property;
      const { state } = context;
      const { name } = key as ESTreeAST.Identifier;

      if (name === 'title') {
        state.meta.title = getPropertyStringValue({ node, filename });
      }

      if (name === 'tags') {
        state.meta.tags = getPropertyArrayOfStringsValue({
          node,
          filename,
        });
      }

      if (name === 'play') {
        state.meta.tags ??= [];
        state.meta.tags.push('play-fn');
      }
    },

    Fragment(node, context) {
      const { nodes } = node;
      const { state, visit } = context;

      for (const node of nodes) {
        if (node.type === 'Component') {
          visit(node, state);
        }
      }
    },

    Component(node, context) {
      const { name } = node;
      const { state } = context;

      if (state.defineMetaStory?.name === name) {
        const storyAttributes = extractStoryAttributesNodes({
          component: node,
          attributes: ['exportName', 'name', 'tags', 'template', 'asChild', 'children', 'play'],
        });
        const templateSnippet = extractStoryTemplateSnippetBlock(node);

        const hasChildren = storyAttributes.children || node.fragment.nodes.length > 0;
        const hasTemplate = storyAttributes.template || templateSnippet;
        const hasAsChild = storyAttributes.asChild !== undefined;

        // TODO: This could actually work in the future, by supporting referencing a template
        // and forwarding any children to that.
        if (storyAttributes.template && hasChildren) {
          throw new StoryTemplateAndChildrenError({ component: node, filename });
        }

        if (hasTemplate && hasAsChild) {
          throw new StoryTemplateAndAsChildError({ component: node, filename });
        }

        if (hasAsChild && !hasChildren) {
          throw new StoryAsChildWithoutChildrenError({ component: node, filename });
        }

        const { exportName, name: storyName } = getStoryIdentifiers({
          component: node,
          nameNode: storyAttributes.name,
          exportNameNode: storyAttributes.exportName,
          filename,
        });
        const tags = getArrayOfStringsValueFromAttribute({
          component: node,
          node: storyAttributes.tags,
          filename,
        });
        if (storyAttributes.play !== undefined) {
          tags.push('play-fn');
        }

        state.stories.push({
          exportName,
          name: storyName,
          tags,
        });
      }
    },
  });

  if (!results.defineMetaImport) {
    if (hasDefaultOrNamespaceImport) {
      throw new DefaultOrNamespaceImportUsedError(filename);
    }

    throw new MissingDefineMetaImportError(filename);
  }

  const { meta, stories } = results;

  return {
    meta,
    stories,
  };
}
