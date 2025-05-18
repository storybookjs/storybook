import fs from 'node:fs/promises';

import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import { preprocess } from 'svelte/compiler';
import type { IndexInput } from 'storybook/internal/types';

import { getSvelteAST, type ESTreeAST, type SvelteAST } from '$lib/parser/ast.js';
import { extractStoryAttributesNodes } from '$lib/parser/extract/svelte/story/attributes.js';
import { getStoryIdentifiers } from '$lib/parser/analyse/story/attributes/identifiers.js';
import {
  getArrayOfStringsValueFromAttribute,
  getStringValueFromAttribute,
} from '$lib/parser/analyse/story/attributes.js';
import {
  getPropertyArrayOfStringsValue,
  getPropertyStringValue,
} from '$lib/parser/analyse/define-meta/properties.js';
import type { StorybookAddonSvelteCsFOptions } from '$lib/preset.js';
import {
  DefaultOrNamespaceImportUsedError,
  GetDefineMetaFirstArgumentError,
  MissingModuleTagError,
  NoStoryComponentDestructuredError,
} from '$lib/utils/error/parser/extract/svelte.js';
import { NoDestructuredDefineMetaCallError } from '$lib/utils/error/parser/analyse/define-meta.js';
import {
  StoryTemplateAndChildrenError,
  StoryTemplateAndAsChildError,
  StoryAsChildWithoutChildrenError,
} from '$lib/utils/error/parser/analyse/story.js';
import { extractStoryTemplateSnippetBlock } from '../parser/extract/svelte/story/template.js';

interface Results {
  meta: Pick<IndexInput, 'title' | 'tags'>;
  stories: Array<Pick<IndexInput, 'exportName' | 'name' | 'tags'>>;
  isLegacy: boolean;
}

export async function parseForIndexer(
  filename: string,
  options: Partial<StorybookAddonSvelteCsFOptions>
): Promise<Results> {
  let [code, { walk }, { loadSvelteConfig }] = await Promise.all([
    fs.readFile(filename, { encoding: 'utf8' }),
    import('zimmerframe'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);

  const { legacyTemplate } = options;
  const svelteConfig = await loadSvelteConfig();

  if (svelteConfig?.preprocess) {
    code = (
      await preprocess(code, svelteConfig.preprocess, {
        filename: filename,
      })
    ).code;
  }

  const svelteAST = getSvelteAST({ code, filename });
  let results: Results & {
    defineMetaImport?: ESTreeAST.ImportSpecifier;
    legacyMetaImport?: ESTreeAST.ImportSpecifier;
    legacyStoryImport?: ESTreeAST.ImportSpecifier;
    defineMetaStory?: ESTreeAST.Identifier;
  } = {
    meta: {},
    stories: [],
    isLegacy: false,
  };

  let foundMeta = false;

  walk(svelteAST as SvelteAST.SvelteNode | SvelteAST.Script, results, {
    _(_node, context) {
      const { next, state } = context;
      next(state);
    },

    Root(node, context) {
      const {
        fragment,
        // TODO: Remove it in the next major version
        instance,
        module,
      } = node;
      const { state, visit } = context;

      // TODO: Remove it in the next major version
      if (legacyTemplate && instance) {
        visit(instance, state);
      }

      if (module) {
        visit(module, state);
      } else if (!legacyTemplate) {
        throw new MissingModuleTagError(filename);
      }

      visit(fragment, state);
    },

    // NOTE: We walk on instance (if flag was enabled - `Root` handles it) or module
    Script(node, context) {
      const { content } = node;
      const { state, visit } = context;

      visit(content, state);
    },

    Program(node, context) {
      const { body } = node;
      const { state, visit } = context;

      for (const statement of body) {
        if (statement.type === 'ImportDeclaration' && statement.source.value === pkg.name) {
          visit(statement, state);
        }

        if (statement.type === 'VariableDeclaration') {
          visit(statement, state);
        }

        // TODO: Remove it in the next major version
        if (legacyTemplate && statement.type === 'ExportNamedDeclaration') {
          const { declaration } = statement;

          if (declaration?.type === 'VariableDeclaration') {
            visit(declaration, state);
          }
        }
      }
    },

    ImportDeclaration(node, context) {
      const { specifiers } = node;
      const { state } = context;

      for (const specifier of specifiers) {
        if (specifier.type !== 'ImportSpecifier') {
          throw new DefaultOrNamespaceImportUsedError(filename);
        }

        if (specifier.imported.name === 'defineMeta') {
          state.defineMetaImport = specifier;
        }

        // TODO: Remove it in the next major version
        if (legacyTemplate && specifier.imported.name === 'Meta') {
          state.legacyMetaImport = specifier;
          state.isLegacy = true;
        }

        // TODO: Remove it in the next major version
        if (legacyTemplate && specifier.imported.name === 'Story') {
          state.legacyStoryImport = specifier;
          state.isLegacy = true;
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
          foundMeta = true;

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

      // TODO: Remove in the next major version
      if (legacyTemplate && !foundMeta && id.type === 'Identifier') {
        const { name } = id;

        if (name === 'meta' && init?.type === 'ObjectExpression') {
          foundMeta = true;
          visit(init, state);
        }
      }
    },

    // NOTE: We assume this one is value of first argument passed to `defineMeta({ ... })` call,
    // or assigned value to legacy `export const meta = {}`
    ObjectExpression(node, context) {
      const { properties } = node;
      const { state, visit } = context;

      for (const property of properties) {
        if (property.type === 'Property' && property.key.type === 'Identifier') {
          visit(property, state);
        }
      }
    },

    // NOTE: We assume these properties are from 'meta' _(from `defineMeta` or `export const meta`)_ object expression
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

      // TODO: Remove in the next major version
      if (!foundMeta && legacyTemplate && name === state.legacyMetaImport?.local.name) {
        const { attributes } = node;
        for (const attribute of attributes) {
          if (attribute.type === 'Attribute') {
            const { name } = attribute;

            if (name === 'title') {
              state.meta.title = getStringValueFromAttribute({
                component: node,
                node: attribute,
                filename,
              });
            }

            if (name === 'tags') {
              state.meta.tags = getArrayOfStringsValueFromAttribute({
                component: node,
                node: attribute,
                filename,
              });
            }
          }
        }
      }

      if (
        state.defineMetaStory?.name === name ||
        // TODO: Remove in the next major version
        (legacyTemplate && name === state.legacyStoryImport?.local.name)
      ) {
        const storyAttributes = extractStoryAttributesNodes({
          component: node,
          attributes: ['exportName', 'name', 'tags', 'template', 'asChild', 'children'],
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

        state.stories.push({
          exportName,
          name: storyName,
          tags,
        });
      }
    },
  });

  const { meta, stories, isLegacy } = results;

  return {
    meta,
    stories,
    isLegacy,
  };
}
