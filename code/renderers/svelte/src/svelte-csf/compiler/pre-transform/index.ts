import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { ImportDeclaration, VariableDeclaration } from 'estree';
import type { Comment, Fragment, Root, Script, SvelteNode } from 'svelte/compiler';

import { transformComponentMetaToDefineMeta } from '#compiler/pre-transform/codemods/component-meta-to-define-meta';
import { transformExportMetaToDefineMeta } from '#compiler/pre-transform/codemods/export-const-to-define-meta';
import { transformImportDeclaration } from '#compiler/pre-transform/codemods/import-declaration';
import { transformLegacyStory } from '#compiler/pre-transform/codemods/legacy-story';
import { transformTemplateToSnippet } from '#compiler/pre-transform/codemods/template-to-snippet';
import { MissingModuleTagError } from '#utils/error/parser/extract/svelte';

interface Params {
  ast: Root;
  filename?: string;
}

export async function codemodLegacyNodes(params: Params): Promise<Root> {
  const { walk } = await import('zimmerframe');

  const { ast, filename } = params;

  interface State {
    componentIdentifierName: ComponentIdentifierName;
    componentMetaHtmlComment?: Comment;
    defineMetaFromMeta?: VariableDeclaration;
  }
  const state: State = {
    componentIdentifierName: {},
  };
  let transformedAst = walk(ast as SvelteNode | Script, state, {
    _(_node, context) {
      const { next, state } = context;

      next(state);
    },

    Root(node, context) {
      const { fragment, module, ...rest } = node;
      const { state, visit } = context;

      if (!module) {
        throw new MissingModuleTagError(filename);
      }

      const transformedModule = visit(module, state) as Script;
      const transformedFragment = visit(fragment, state) as Fragment;

      return {
        ...rest,
        fragment: transformedFragment,
        module: transformedModule,
      };
    },

    Script(node, context) {
      const { next, state } = context;

      if (node.context === 'module') {
        next(state);
      }
    },

    Program(_node, context) {
      const { next, state } = context;

      next(state);
    },

    ImportDeclaration(node, context) {
      const { source, specifiers } = node;
      const { state } = context;
      const { value } = source;

      if (value === pkg.name) {
        state.componentIdentifierName = getComponentsIdentifiersNames(specifiers);

        return transformImportDeclaration({ node, filename });
      }
    },

    ExportNamedDeclaration(node, _context) {
      const { declaration } = node;

      if (
        declaration &&
        declaration.type === 'VariableDeclaration' &&
        declaration.declarations[0].type === 'VariableDeclarator' &&
        declaration.declarations[0].id.type === 'Identifier' &&
        declaration.declarations[0].id.name === 'meta'
      ) {
        return transformExportMetaToDefineMeta(node);
      }
    },

    Fragment(_node, context) {
      const { next, state } = context;

      next(state);
    },

    Comment(node, context) {
      const { state } = context;

      state.componentMetaHtmlComment = node;
    },

    Component(node, context) {
      const { name } = node;
      const { state } = context;
      const { componentIdentifierName, componentMetaHtmlComment } = state;

      if (name === componentIdentifierName?.Meta) {
        state.defineMetaFromMeta = transformComponentMetaToDefineMeta({
          component: node,
          comment: componentMetaHtmlComment,
        });
      }

      if (name === componentIdentifierName?.Story) {
        state.componentMetaHtmlComment = undefined;
        return transformLegacyStory({ node, filename });
      }

      if (name === componentIdentifierName?.Template) {
        state.componentMetaHtmlComment = undefined;
        return transformTemplateToSnippet(node);
      }
    },
  });

  const { componentIdentifierName, defineMetaFromMeta } = state;

  // Clean-up
  // TODO: To optimize it (stop walking on AST again)...
  // it might be possible to use `visit(path(-1))` for some cases in the previous AST walk,
  // but I haven't managed to get it to work properly
  transformedAst = walk(transformedAst, null, {
    Script(node, context) {
      const { context: scriptContext } = node;

      if (scriptContext === 'module') {
        const { next, state } = context;

        next(state);
      }
    },

    Program(node, _context) {
      let { body, ...rest } = node;

      if (defineMetaFromMeta) {
        body.push(defineMetaFromMeta);

        return { ...rest, body };
      }
    },

    Fragment(node, context) {
      const { stop } = context;

      if (defineMetaFromMeta) {
        let { nodes, ...rest } = node;

        const componentMetaIndex = nodes.findIndex(
          (node) => node.type === 'Component' && node.name === componentIdentifierName.Meta
        );

        if (componentMetaIndex !== -1) {
          // NOTE: Removes Meta component AST
          nodes.splice(componentMetaIndex, 1);

          if (nodes[componentMetaIndex - 1]?.type === 'Comment') {
            // NOTE: Removes leading Ccomment
            nodes.splice(componentMetaIndex - 1, 1);
          }

          if (
            nodes[componentMetaIndex - 1]?.type === 'Text' &&
            nodes[componentMetaIndex - 2]?.type === 'Comment'
          ) {
            // NOTE: Remove leading Comment - sometimes there might a new line and indent - aka `\n    `
            nodes.splice(componentMetaIndex - 2, 2);
          }
        }

        return { ...rest, nodes };
      }

      stop();
    },
  });

  return transformedAst as Root;
}

interface ComponentIdentifierName {
  Meta?: string;
  Story?: string;
  Template?: string;
}
function getComponentsIdentifiersNames(
  specifiers: ImportDeclaration['specifiers']
): ComponentIdentifierName {
  let results: ComponentIdentifierName = {};

  for (const specifier of specifiers) {
    if (specifier.imported.name === 'Meta') {
      results.Meta = specifier.local.name;
    }

    if (specifier.imported.name === 'Story') {
      results.Story = specifier.local.name;
    }

    if (specifier.imported.name === 'Template') {
      results.Template = specifier.local.name;
    }
  }

  return results;
}
