/* eslint-disable no-underscore-dangle */
import * as t from '@babel/types';

import bg from '@babel/generator';
import type { CsfFile } from './CsfFile';

// @ts-expect-error (needed due to it's use of `exports.default`)
const generate = (bg.default || bg) as typeof bg;

export interface EnrichCsfOptions {
  disableSource?: boolean;
  disableDescription?: boolean;
}

export const enrichCsfStory = (
  csf: CsfFile,
  csfSource: CsfFile,
  key: string,
  options?: EnrichCsfOptions
) => {
  const storyExport = csfSource.getStoryExport(key);
  const source = !options?.disableSource && extractSource(storyExport);
  const description =
    !options?.disableDescription && extractDescription(csfSource._storyStatements[key]);
  const parameters = [];
  const originalParameters = t.memberExpression(t.identifier(key), t.identifier('parameters'));
  parameters.push(t.spreadElement(originalParameters));
  const optionalDocs = t.optionalMemberExpression(
    originalParameters,
    t.identifier('docs'),
    false,
    true
  );
  const extraDocsParameters = [];

  // docs: { source: { originalSource: %%source%% } },
  if (source) {
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
          t.objectProperty(t.identifier('originalSource'), t.stringLiteral(source)),
          t.spreadElement(optionalSource),
        ])
      )
    );
  }

  // docs: { description: { story: %%description%% } },
  if (description) {
    const optionalDescription = t.optionalMemberExpression(
      optionalDocs,
      t.identifier('description'),
      false,
      true
    );
    extraDocsParameters.push(
      t.objectProperty(
        t.identifier('description'),
        t.objectExpression([
          t.objectProperty(t.identifier('story'), t.stringLiteral(description)),
          t.spreadElement(optionalDescription),
        ])
      )
    );
  }

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
    if (metaNode && t.isObjectExpression(metaNode)) {
      addComponentDescription(
        metaNode,
        ['parameters', 'docs', 'description'],
        t.objectProperty(t.identifier('component'), t.stringLiteral(description))
      );
    }
  }
};

export const enrichCsf = (csf: CsfFile, csfSource: CsfFile, options?: EnrichCsfOptions) => {
  enrichCsfMeta(csf, csfSource, options);
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
  if (!node?.leadingComments) return '';
  const comments = node.leadingComments
    .map((comment) => {
      if (comment.type === 'CommentLine' || !comment.value.startsWith('*')) return null;
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
