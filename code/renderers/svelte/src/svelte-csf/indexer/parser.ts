import fs from 'node:fs/promises';

import { findMeta, findMetaImports, hasMetaImport } from '../utils/import-source.ts';
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
  MissingDefineMetaVariableDeclarationError,
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
import { type ExtendableStory, getStoryParents } from '../parser/analyse/story/extend.ts';
import { getStoryChain } from '../utils/story-chain.ts';

interface Results {
  meta: Pick<IndexInput, 'title' | 'tags' | 'metaId'>;
  stories: Array<Pick<IndexInput, 'exportName' | 'name' | 'tags'>>;
}

type IndexedStory = ExtendableStory & { tags: string[] };

// Script blocks and comments are matched first, as they can contain "<style"
const styleBlocks =
  /<script(?:\s(?:"[^"]*"|'[^']*'|[^>"'])*)?>[\s\S]*?<\/script\s*>|<!--[\s\S]*?-->|(<style(?:\s(?:"[^"]*"|'[^']*'|[^>"'])*)?>)([\s\S]*?)(<\/style\s*>)/g;

// Preprocessors don't run here, so a style block in SCSS and similar fails to compile. Then the
// style content is blanked. Newlines stay, so error positions stay correct.
export function getIndexableAST(code: string, filename: string) {
  try {
    return getSvelteAST({ code, filename });
  } catch {
    const blanked = code.replace(styleBlocks, (match, open?: string, content = '', close = '') =>
      open === undefined ? match : open + content.replace(/[^\r\n]/g, ' ') + close
    );
    return getSvelteAST({ code: blanked, filename });
  }
}

export async function parseForIndexer(filename: string): Promise<Results> {
  const [code, { walk }] = await Promise.all([
    fs.readFile(filename, { encoding: 'utf8' }),
    import('zimmerframe'),
  ]);

  const svelteAST = getIndexableAST(code, filename);
  const results: Omit<Results, 'stories'> & {
    hasMetaImport?: boolean;
    isFactory: boolean;
    storyNames: string[];
    stories: IndexedStory[];
  } = {
    meta: {},
    stories: [],
    isFactory: false,
    storyNames: [],
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
      const imports = findMetaImports(body);
      const meta = findMeta(body, imports, filename);

      state.hasMetaImport = hasMetaImport(imports);
      hasDefaultOrNamespaceImport = imports.hasDefaultOrNamespaceImport;

      if (!meta) {
        if (state.hasMetaImport) {
          throw new MissingDefineMetaVariableDeclarationError(filename);
        }
        return;
      }

      const [declarator] = meta.declaration.declarations;

      if (!meta.isFactory && declarator.id.type !== 'ObjectPattern') {
        throw new NoDestructuredDefineMetaCallError({
          defineMetaVariableDeclarator: declarator,
          filename,
        });
      }

      if (meta.storyNames.length === 0) {
        throw new NoStoryComponentDestructuredError({
          filename,
          metaFunctionName: meta.functionName,
        });
      }

      state.storyNames = meta.storyNames;
      state.isFactory = meta.isFactory;

      if (meta.call.arguments[0]?.type !== 'ObjectExpression') {
        throw new GetDefineMetaFirstArgumentError({
          filename,
          defineMetaVariableDeclaration: meta.declaration,
        });
      }

      visit(meta.call.arguments[0], state);
    },

    // NOTE: We assume this one is value of first argument passed to `defineMeta({ ... })` or `preview.meta({ ... })` call
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

      if (name === 'id') {
        state.meta.metaId = getPropertyStringValue({ node, filename });
      }

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
        } else if (node.type === 'RegularElement') {
          visit(node.fragment, state);
        }
      }
    },

    Component(node, context) {
      const { name } = node;
      const { state } = context;

      if (state.storyNames.includes(name)) {
        const storyAttributes = extractStoryAttributesNodes({
          component: node,
          attributes: [
            'exportName',
            'name',
            'tags',
            'template',
            'asChild',
            'children',
            'play',
            'extend',
          ],
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

        // A story that extends another story can inherit the children
        if (hasAsChild && !hasChildren && !storyAttributes.extend) {
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
          component: node,
          exportName,
          name: storyName,
          tags,
        });
      }
    },
  });

  if (!results.hasMetaImport) {
    if (hasDefaultOrNamespaceImport) {
      throw new DefaultOrNamespaceImportUsedError(filename);
    }

    throw new MissingDefineMetaImportError(filename);
  }

  const { meta, stories, isFactory } = results;
  const parents = getStoryParents({ stories, isFactory, filename });
  const byExportName = new Map(stories.map((story) => [story.exportName, story]));

  return {
    meta,
    // A story has the tags of the stories it extends, before its own
    stories: stories.map(({ exportName, name }) => ({
      exportName,
      name,
      tags: getStoryChain(parents, exportName)
        .reverse()
        .flatMap((storyExportName) => byExportName.get(storyExportName)!.tags),
    })),
  };
}
