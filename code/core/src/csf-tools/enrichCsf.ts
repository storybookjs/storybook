import { generate, types as t } from 'storybook/internal/babel';
import { type CsfEnricher } from 'storybook/internal/types';

import type { CsfFile } from './CsfFile.ts';

export interface EnrichCsfOptions {
  disableSource?: boolean;
  disableDescription?: boolean;
  enrichCsf?: CsfEnricher;
}

const isMetaStoryFactory = (storyExport: t.Node, csfSource: CsfFile) =>
  csfSource._metaIsFactory &&
  t.isCallExpression(storyExport) &&
  t.isMemberExpression(storyExport.callee) &&
  t.isIdentifier(storyExport.callee.object) &&
  t.isIdentifier(storyExport.callee.property) &&
  storyExport.callee.property.name === 'story' &&
  storyExport.callee.object.name === csfSource._metaVariableName;

const isStoryExtend = (storyExport: t.Node) =>
  t.isCallExpression(storyExport) &&
  t.isMemberExpression(storyExport.callee) &&
  t.isIdentifier(storyExport.callee.property) &&
  storyExport.callee.property.name === 'extend';

export const enrichCsfStory = (
  csf: CsfFile,
  csfSource: CsfFile,
  key: string,
  options?: EnrichCsfOptions
) => {
  const storyExport = csfSource.getStoryExport(key);
  const isCsfFactory = isMetaStoryFactory(storyExport, csfSource);
  const source = !options?.disableSource && extractSource(storyExport);
  const description =
    !options?.disableDescription && extractDescription(csfSource._storyStatements[key]);
  if (source || description) {
    const addParameter = (baseStoryObject: t.Expression) => {
      const originalParameters = t.memberExpression(baseStoryObject, t.identifier('parameters'));
      const optionalDocs = t.optionalMemberExpression(
        originalParameters,
        t.identifier('docs'),
        false,
        true
      );
      const docsParameters = [];
      if (source) {
        docsParameters.push(
          t.objectProperty(
            t.identifier('source'),
            t.objectExpression([
              t.objectProperty(t.identifier('originalSource'), t.stringLiteral(source)),
              t.spreadElement(
                t.optionalMemberExpression(optionalDocs, t.identifier('source'), false, true)
              ),
            ])
          )
        );
      }
      if (description) {
        docsParameters.push(
          t.objectProperty(
            t.identifier('description'),
            t.objectExpression([
              t.objectProperty(t.identifier('story'), t.stringLiteral(description)),
              t.spreadElement(
                t.optionalMemberExpression(optionalDocs, t.identifier('description'), false, true)
              ),
            ])
          )
        );
      }
      return t.expressionStatement(
        t.assignmentExpression(
          '=',
          originalParameters,
          t.objectExpression([
            t.spreadElement(originalParameters),
            t.objectProperty(
              t.identifier('docs'),
              t.objectExpression([t.spreadElement(optionalDocs), ...docsParameters])
            ),
          ])
        )
      );
    };
    const story = t.identifier(key);
    const storyInput = t.memberExpression(story, t.identifier('input'));
    const isFactoryStory = t.binaryExpression(
      '===',
      t.memberExpression(story, t.identifier('_tag')),
      t.stringLiteral('Story')
    );
    csf._ast.program.body.push(
      isStoryExtend(storyExport) && !isCsfFactory
        ? t.ifStatement(
            isFactoryStory,
            t.blockStatement([addParameter(storyInput)]),
            t.blockStatement([addParameter(story)])
          )
        : addParameter(isCsfFactory ? storyInput : story)
    );
  }
};

const addComponentDescription = (
  node: t.ObjectExpression,
  path: string[],
  value: t.ObjectProperty
) => {
  if (!path.length) {
    const hasExistingComponent = node.properties.find(
      (p) => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'component'
    );
    if (!hasExistingComponent) {
      // make this the lowest-priority so that if the user is object-spreading on top of it,
      // the users' code will "win"
      node.properties.unshift(value);
    }
    return;
  }
  const [first, ...rest] = path;
  const existing = node.properties.find(
    (p) =>
      t.isObjectProperty(p) &&
      t.isIdentifier(p.key) &&
      p.key.name === first &&
      t.isObjectExpression(p.value)
  );
  let subNode: t.ObjectExpression;
  if (existing) {
    subNode = (existing as t.ObjectProperty).value as t.ObjectExpression;
  } else {
    subNode = t.objectExpression([]);
    node.properties.push(t.objectProperty(t.identifier(first), subNode));
  }
  addComponentDescription(subNode, rest, value);
};

export const enrichCsfMeta = (csf: CsfFile, csfSource: CsfFile, options?: EnrichCsfOptions) => {
  const description = !options?.disableDescription && extractDescription(csfSource._metaStatement);
  // docs: { description: { component: %%description%% } },
  if (description) {
    const metaNode = csf._metaNode;
    if (metaNode && !csf._metaNodeIsSynthetic && t.isObjectExpression(metaNode)) {
      addComponentDescription(
        metaNode,
        ['parameters', 'docs', 'description'],
        t.objectProperty(t.identifier('component'), t.stringLiteral(description))
      );
    }
  }
};

export const enrichCsf = async (csf: CsfFile, csfSource: CsfFile, options?: EnrichCsfOptions) => {
  enrichCsfMeta(csf, csfSource, options);
  await options?.enrichCsf?.(csf, csfSource);
  Object.keys(csf._storyExports).forEach((key) => {
    enrichCsfStory(csf, csfSource, key, options);
  });
};

export const extractSource = (node: t.Node) => {
  const src = t.isVariableDeclarator(node) ? node.init : node;
  const { code } = generate(src as t.Node, {});
  return code;
};

export const extractDescription = (node?: t.Node) => {
  if (!node?.leadingComments) {
    return '';
  }
  const comments = node.leadingComments
    .map((comment) => {
      if (comment.type === 'CommentLine' || !comment.value.startsWith('*')) {
        return null;
      }
      return (
        comment.value
          .split('\n')
          // remove leading *'s and spaces from the beginning of each line
          .map((line) => line.replace(/^(\s+)?(\*+)?(\s)?/, ''))
          .join('\n')
          .trim()
      );
    })
    .filter(Boolean);
  return comments.join('\n');
};
