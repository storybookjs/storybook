import { recast, types as t } from 'storybook/internal/babel';
import { getPrettier } from 'storybook/internal/common';
import { type CsfFile } from 'storybook/internal/csf-tools';
import type { PresetPropertyFn } from 'storybook/internal/types';

import { join } from 'pathe';

import { getCodeSnippet } from './componentManifest/generateCodeSnippet';

export const enrichCsf: PresetPropertyFn<'experimental_enrichCsf'> = async (input, options) => {
  const features = await options.presets.apply('features');
  if (!features.experimentalCodeExamples) {
    return;
  }
  return async (csf: CsfFile, csfSource: CsfFile) => {
    const promises = Object.keys(csf._stories).map(async (key) => {
      if (!csfSource._meta?.component) {
        return;
      }
      const { format } = await getPrettier();
      let node;
      let snippet;
      try {
        node = getCodeSnippet(csfSource, key, csfSource._meta?.component);
      } catch (e) {
        if (!(e instanceof Error)) {
          return;
        }
        snippet = e.message;
      }

      try {
        // TODO read the user config
        if (!snippet && node) {
          snippet = await format(recast.print(node).code, {
            filepath: join(process.cwd(), 'component.tsx'),
          });
        }
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

      // For example:
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
