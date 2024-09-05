import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type {
  Identifier,
  ImportDeclaration,
  ObjectExpression,
  Program,
  VariableDeclaration,
} from 'estree';
import type { Comment, Fragment, Root, Script, SvelteNode } from 'svelte/compiler';

import { transformComponentMetaToDefineMeta } from '#compiler/pre-transform/codemods/component-meta-to-define-meta';
import { transformExportMetaToDefineMeta } from '#compiler/pre-transform/codemods/export-const-to-define-meta';
import { transformImportDeclaration } from '#compiler/pre-transform/codemods/import-declaration';
import { transformLegacyStory } from '#compiler/pre-transform/codemods/legacy-story';
import { transformTemplateToSnippet } from '#compiler/pre-transform/codemods/template-to-snippet';
import { createASTScript } from '#parser/ast';

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
    defineMetaFromExportConstMeta?: VariableDeclaration;
    defineMetaFromComponentMeta?: VariableDeclaration;
    currentScript?: 'instance' | 'module';
    pkgImportDeclaration?: ImportDeclaration;
    storiesComponentIdentifier?: Identifier;
    storiesComponentImportDeclaration?: ImportDeclaration;
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
      const { fragment, instance, module, ...rest } = node;
      const { state, visit } = context;

      // NOTE: We walk on instance first to see if the package import declaration is there or `export const meta`
      const transformedInstance = (instance ? visit(instance, state) : null) as Script | null;
      // NOTE: We will create in 'clean-up' walk if it wasn't there
      const transformedModule = module ? (visit(module, state) as Script) : null;
      const transformedFragment = visit(fragment, state) as Fragment;

      return {
        ...rest,
        fragment: transformedFragment,
        instance: transformedInstance,
        module: transformedModule,
      };
    },

    // NOTE: It walks either on module or instance tag
    Script(node, context) {
      const { next, state } = context;

      state.currentScript = node.context === 'module' ? 'module' : 'instance';

      next(state);
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
        const { currentScript } = state;

        state.componentIdentifierName = getComponentsIdentifiersNames(specifiers);

        const transformedImportDeclaration = transformImportDeclaration({ node, filename });

        if (currentScript !== 'module') {
          // NOTE: We store current node in AST walker state.
          // And will remove it from instance & append it to module in the "clean-up" walk after this one.
          state.pkgImportDeclaration = transformedImportDeclaration;
        }

        return transformedImportDeclaration;
      }
    },

    ExportNamedDeclaration(node, context) {
      const { declaration } = node;
      const { state } = context;

      if (
        !(
          declaration &&
          declaration.type === 'VariableDeclaration' &&
          declaration.declarations[0].type === 'VariableDeclarator' &&
          declaration.declarations[0].id.type === 'Identifier' &&
          declaration.declarations[0].id.name === 'meta'
        )
      ) {
        return;
      }
      const transformed = transformExportMetaToDefineMeta(node);
      const { currentScript } = state;

      if (currentScript === 'instance') {
        state.defineMetaFromExportConstMeta = transformed;
      }

      // NOTE:
      // Type assertion because we already ran transform codemod function by this point (`transformed`).
      // So the possible issue is on our side, not user.
      const { init } = declaration.declarations[0] as ObjectExpression;

      const { properties } = init;

      for (const property of properties) {
        if (
          property.type === 'Property' &&
          property.key.name === 'component' &&
          property.value.type === 'Identifier'
        ) {
          state.storiesComponentIdentifier = property.value;
        }
      }

      return transformed;
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
        state.defineMetaFromComponentMeta = transformComponentMetaToDefineMeta({
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

  // Clean-up
  // TODO: To optimize it (stop walking on AST again)...
  // it might be possible to use `visit(path(-1))` for some cases in the previous AST walk,
  // but I haven't managed to get it to work properly
  transformedAst = walk(transformedAst, state, {
    Root(node, context) {
      let { fragment, instance, module, ...rest } = node;
      const { state, visit } = context;

      // NOTE: At this point, we decide for walker where it should walk first instead of using `next(state)`
      instance = instance ? (visit(instance, state) as Script) : null;

      if (!module) {
        const {
          pkgImportDeclaration,
          defineMetaFromExportConstMeta,
          storiesComponentImportDeclaration,
        } = state;

        let body: Program['body'] = [];

        // WARN: This scope is bug prone

        if (pkgImportDeclaration) {
          body.push(pkgImportDeclaration);
        }

        if (storiesComponentImportDeclaration) {
          body.push(storiesComponentImportDeclaration);
        }

        if (defineMetaFromExportConstMeta) {
          body.push(defineMetaFromExportConstMeta);
        }

        module = createASTScript({
          module: true,
          content: {
            type: 'Program',
            body,
            sourceType: 'module',
          },
        });
      }

      visit(module, state);

      fragment = visit(fragment, state) as Fragment;

      // NOTE: Remove if body is empty
      if (instance && instance.content.body.length === 0) {
        instance = null;
      }

      return {
        ...rest,
        module,
        instance,
        fragment,
      };
    },

    Script(node, context) {
      let { content, context: scriptContext, ...rest } = node;
      const { state, visit } = context;

      state.currentScript = scriptContext === 'module' ? 'module' : 'instance';

      content = visit(content, state) as Program;

      return { ...rest, content, context: scriptContext };
    },

    Program(node, _context) {
      let { body, ...rest } = node;
      const { currentScript, pkgImportDeclaration } = state;

      if (pkgImportDeclaration && currentScript === 'instance') {
        let instanceBody: Program['body'] = [];

        for (const declaration of body) {
          if (declaration.type === 'ImportDeclaration') {
            const { specifiers, source } = declaration;

            if (source.value === pkg.name) {
              continue;
            }

            const { storiesComponentIdentifier } = state;
            const storiesComponentSpecifier = specifiers.find(
              (s) => s.local.name === storiesComponentIdentifier?.name
            );

            if (storiesComponentSpecifier) {
              state.storiesComponentImportDeclaration = declaration;
              continue;
            }
          }

          if (declaration.type === 'VariableDeclaration') {
            const { init } = declaration.declarations[0];

            if (init?.type === 'CallExpression' && init.callee.name === 'defineMeta') {
              continue;
            }
          }

          instanceBody.push(declaration);
        }

        body = instanceBody;
      }

      if (currentScript === 'module') {
        const { defineMetaFromComponentMeta } = state;

        if (defineMetaFromComponentMeta) {
          body.push(defineMetaFromComponentMeta);
        }
      }

      return { ...rest, body };
    },

    Fragment(node, context) {
      const { state, stop } = context;
      const { componentIdentifierName, defineMetaFromComponentMeta } = state;

      if (defineMetaFromComponentMeta) {
        let { nodes, ...rest } = node;

        const componentMetaIndex = nodes.findIndex(
          (node) => node.type === 'Component' && node.name === componentIdentifierName.Meta
        );

        if (componentMetaIndex !== -1) {
          // NOTE: Removes Meta component AST
          nodes.splice(componentMetaIndex, 1);

          if (nodes[componentMetaIndex - 1]?.type === 'Comment') {
            // NOTE: Removes leading Comment
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
