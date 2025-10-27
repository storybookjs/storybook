import { type NodePath, recast, types as t } from 'storybook/internal/babel';
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
    const promises = Object.entries(csf._storyPaths).map(async ([key, storyExport]) => {
      if (!csfSource._meta?.component) {
        return;
      }
      const { format } = await getPrettier();
      let node;
      try {
        node = getCodeSnippet(storyExport, csfSource._metaNode, csfSource._meta?.component);
      } catch (e) {
        // don't bother the user if we can't generate a snippet
        return;
      }

      let snippet;
      try {
        // TODO read the user config
        snippet = await format(recast.print(node).code, {
          filepath: join(process.cwd(), 'component.tsx'),
        });
      } catch (e) {
        return;
      }

      const declaration = storyExport.get('declaration');
      if (!declaration.isVariableDeclaration()) {
        return;
      }

      const declarator = declaration.get('declarations')[0];
      const init = declarator.get('init') as NodePath<t.Expression>;

      if (!init.isExpression()) {
        return;
      }

      const isCsfFactory =
        t.isCallExpression(init.node) &&
        t.isMemberExpression(init.node.callee) &&
        t.isIdentifier(init.node.callee.object) &&
        init.node.callee.object.name === 'meta';

      // e.g. Story.input.parameters
      const originalParameters = t.memberExpression(
        isCsfFactory
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
