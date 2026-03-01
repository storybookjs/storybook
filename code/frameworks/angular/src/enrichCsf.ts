import { types as t } from 'storybook/internal/babel';
import { type CsfFile } from 'storybook/internal/csf-tools';
import type { PresetPropertyFn } from 'storybook/internal/types';

import type { Component, Directive } from './client/compodoc-types';
import { findComponentInCompodoc, loadCompodocJson } from './componentManifest/compodocDocgen';
import { generateAngularSnippet, mergeArgsFromAst } from './componentManifest/generateCodeSnippet';

/**
 * Enriches CSF files with Angular template source code snippets.
 *
 * Implements the `experimental_enrichCsf` preset property.
 * For each story, generates an Angular template snippet and injects it
 * into `Story.parameters.docs.source.code`.
 */
export const enrichCsf: PresetPropertyFn<'experimental_enrichCsf'> = async (input, options) => {
  const features = await options.presets.apply('features');
  if (!features.experimentalCodeExamples) {
    return;
  }

  return async (csf: CsfFile, csfSource: CsfFile) => {
    const compodocJson = loadCompodocJson(process.cwd());
    if (!compodocJson) {
      return;
    }

    const componentName = csfSource._meta?.component;
    if (!componentName) {
      return;
    }

    const componentData = findComponentInCompodoc(componentName, compodocJson) as
      | Component
      | Directive
      | undefined;

    const promises = Object.keys(csf._stories).map(async (key) => {
      let snippet: string | undefined;

      try {
        // Merge meta and story args from AST nodes
        const args = mergeArgsFromAst(
          csfSource._metaNode,
          csfSource._storyAnnotations[key]
        );

        snippet = generateAngularSnippet(
          Object.keys(args).length > 0 ? args : undefined,
          componentData
        );
      } catch (e) {
        if (!(e instanceof Error)) {
          return;
        }
        snippet = e.message;
      }

      if (!snippet) {
        return;
      }

      // e.g. Story.input.parameters
      const originalParameters = t.memberExpression(
        csf._metaIsFactory
          ? t.memberExpression(t.identifier(key), t.identifier('input'))
          : t.identifier(key),
        t.identifier('parameters')
      );

      // e.g. Story.input.parameters?.docs
      const docsParameter = t.optionalMemberExpression(
        originalParameters,
        t.identifier('docs'),
        false,
        true
      );

      // Inject:
      // Story.input.parameters = {
      //   ...Story.input.parameters,
      //   docs: {
      //     ...Story.input.parameters?.docs,
      //     source: {
      //       code: "snippet",
      //       ...Story.input.parameters?.docs?.source
      //     }
      //   }
      // };
      csf._ast.program.body.push(
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            originalParameters,
            t.objectExpression([
              t.spreadElement(originalParameters),
              t.objectProperty(
                t.identifier('docs'),
                t.objectExpression([
                  t.spreadElement(docsParameter),
                  t.objectProperty(
                    t.identifier('source'),
                    t.objectExpression([
                      t.objectProperty(t.identifier('code'), t.stringLiteral(snippet)),
                      t.spreadElement(
                        t.optionalMemberExpression(
                          docsParameter,
                          t.identifier('source'),
                          false,
                          true
                        )
                      ),
                    ])
                  ),
                ])
              ),
            ])
          )
        )
      );
    });

    await Promise.all(promises);
  };
};
