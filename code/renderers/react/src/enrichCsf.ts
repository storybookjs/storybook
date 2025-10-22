import { type NodePath, recast, types as t } from 'storybook/internal/babel';
import { getPrettier } from 'storybook/internal/common';
import { type CsfFile } from 'storybook/internal/csf-tools';
import type { PresetPropertyFn } from 'storybook/internal/types';

import { join } from 'pathe';
import invariant from 'tiny-invariant';

import { getCodeSnippet } from './componentManifest/generateCodeSnippet';

export const enrichCsf: PresetPropertyFn<'experimental_enrichCsf'> = async (input, options) => {
  const features = await options.presets.apply('features');
  if (!features.experimentalCodeExamples) {
    return;
  }
  return async (csf: CsfFile, csfSource: CsfFile) => {
    await Promise.all(
      Object.entries(csf._storyPaths).map(async ([key, storyExport]) => {
        if (csfSource._meta?.component) {
          const { format } = await getPrettier();

          const code = recast.print(
            getCodeSnippet(storyExport, csfSource._metaNode, csfSource._meta?.component)
          ).code;

          // TODO read the user config
          const snippet = await format(code, { filepath: join(process.cwd(), 'component.tsx') });

          const declaration = storyExport.get('declaration') as NodePath<t.Declaration>;
          invariant(declaration.isVariableDeclaration(), 'Expected variable declaration');

          const declarator = declaration.get('declarations')[0] as NodePath<t.VariableDeclarator>;
          const init = declarator.get('init') as NodePath<t.Expression>;
          invariant(init.isExpression(), 'Expected story initializer to be an expression');

          const parameters = [];
          const isCsfFactory =
            t.isCallExpression(init.node) &&
            t.isMemberExpression(init.node.callee) &&
            t.isIdentifier(init.node.callee.object) &&
            init.node.callee.object.name === 'meta';

          // in csf 1/2/3 use Story.parameters; CSF factories use Story.input.parameters
          const baseStoryObject = isCsfFactory
            ? t.memberExpression(t.identifier(key), t.identifier('input'))
            : t.identifier(key);

          const originalParameters = t.memberExpression(
            baseStoryObject,
            t.identifier('parameters')
          );
          parameters.push(t.spreadElement(originalParameters));
          const optionalDocs = t.optionalMemberExpression(
            originalParameters,
            t.identifier('docs'),
            false,
            true
          );
          const extraDocsParameters = [];

          if (snippet) {
            const optionalSource = t.optionalMemberExpression(
              optionalDocs,
              t.identifier('source'),
              false,
              true
            );

            extraDocsParameters.push(
              t.objectProperty(
                t.identifier('source'),
                t.objectExpression([
                  t.objectProperty(t.identifier('code'), t.stringLiteral(snippet)),
                  t.spreadElement(optionalSource),
                ])
              )
            );
          }

          // docs: { description: { story: %%description%% } },
          if (extraDocsParameters.length > 0) {
            parameters.push(
              t.objectProperty(
                t.identifier('docs'),
                t.objectExpression([t.spreadElement(optionalDocs), ...extraDocsParameters])
              )
            );
            const addParameter = t.expressionStatement(
              t.assignmentExpression('=', originalParameters, t.objectExpression(parameters))
            );
            csf._ast.program.body.push(addParameter);
          }
        }
      })
    );
  };
};
