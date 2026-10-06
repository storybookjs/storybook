import {
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  loadCsf,
  storyShapeError,
  walk,
} from 'storybook/internal/csf-tools';

import type { FileInfo } from 'jscodeshift';

function findImplicitSpies(editor: SourceEditor, node: Node, file: string, keys: string[]) {
  walk(node, (identifier) => {
    if (
      identifier.type === 'Identifier' &&
      !keys.includes(identifier.name) &&
      /^on[A-Z].*/.test(identifier.name)
    ) {
      console.warn(
        storyShapeError(`${file} Possible implicit spy found`, identifier, editor).message
      );
    }
  });
}

const getObjectExpressionKeys = (node: Node | undefined) => {
  return node?.type === 'ObjectExpression'
    ? node.properties.flatMap((value) =>
        value.type === 'Property' && !value.method && value.key.type === 'Identifier'
          ? [value.key.name]
          : []
      )
    : [];
};

const findProperty = (object: E.ObjectExpression, name: string) =>
  object.properties.find(
    (it): it is E.ObjectProperty =>
      it.type === 'Property' && !it.method && it.key.type === 'Identifier' && it.key.name === name
  );

// CSF2 `Story.annotation = value` and CSF3 `const Story = { annotation: value }`
function findAnnotations(program: E.Program, storyName: string, annotationName: string) {
  const values: Node[] = [];
  walk(program, (node) => {
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.object.type === 'Identifier' &&
      node.left.object.name === storyName &&
      node.left.property.type === 'Identifier' &&
      node.left.property.name === annotationName
    ) {
      values.push(node.right);
    }
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      node.id.name === storyName &&
      node.init?.type === 'ObjectExpression'
    ) {
      const property = findProperty(node.init, annotationName);
      if (property) {
        values.push(property.value);
      }
    }
  });
  return values;
}

export default async function transform(info: FileInfo) {
  const csf = loadCsf(info.source, { makeTitle: (title) => title });
  csf.parse();
  const editor = csf._editor;

  const metaKeys = [
    ...getObjectExpressionKeys(csf._metaAnnotations.args),
    ...getObjectExpressionKeys(csf._metaAnnotations.argTypes),
  ];

  Object.values(csf.stories).forEach(({ name }) => {
    if (!name) {
      return;
    }
    const allKeys = [
      ...metaKeys,
      ...findAnnotations(editor.program, name, 'args').flatMap(getObjectExpressionKeys),
      ...findAnnotations(editor.program, name, 'argTypes').flatMap(getObjectExpressionKeys),
    ];

    walk(editor.program, (node) => {
      // CSF2 play function Story.play =
      if (
        node.type === 'AssignmentExpression' &&
        node.left.type === 'MemberExpression' &&
        node.left.object.type === 'Identifier' &&
        node.left.object.name === name &&
        node.left.property.type === 'Identifier' &&
        node.left.property.name === 'play'
      ) {
        findImplicitSpies(editor, node, info.path, allKeys);
      }
      // CSF3 play function: const Story = {play: () => {} };
      if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'Identifier' &&
        node.id.name === name &&
        node.init?.type === 'ObjectExpression'
      ) {
        const play = findProperty(node.init, 'play');
        if (play) {
          findImplicitSpies(editor, play, info.path, allKeys);
        }
      }
    });
  });
}

export const parser = 'tsx';
