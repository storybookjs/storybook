/* eslint-disable no-underscore-dangle */
import { loadCsf } from '@storybook/core/csf-tools';

import type { BabelFile } from '@babel/core';
import * as babel from '@babel/core';
import { isIdentifier, isObjectExpression, isObjectProperty } from '@babel/types';
import type { FileInfo } from 'jscodeshift';

function findImplicitSpies(path: babel.NodePath, file: string, keys: string[]) {
  path.traverse({
    Identifier: (identifier) => {
      if (!keys.includes(identifier.node.name) && /^on[A-Z].*/.test(identifier.node.name)) {
        console.warn(identifier.buildCodeFrameError(`${file} Possible implicit spy found`).message);
      }
    },
  });
}

function getAnnotationKeys(file: BabelFile, storyName: string, annotationName: string) {
  const argKeys: string[] = [];

  file.path.traverse({
    // CSF2 play function Story.args =
    AssignmentExpression: (path) => {
      const left = path.get('left');

      if (!left.isMemberExpression()) {
        return;
      }
      const object = left.get('object');

      if (!(object.isIdentifier() && object.node.name === storyName)) {
        return;
      }

      const property = left.get('property');
      const right = path.get('right');
      if (
        property.isIdentifier() &&
        property.node.name === annotationName &&
        right.isObjectExpression()
      ) {
        argKeys.push(
          ...right.node.properties.flatMap((value) =>
            isObjectProperty(value) && isIdentifier(value.key) ? [value.key.name] : []
          )
        );
      }
    },
    // CSF3 const Story = {args: () => {} };
    VariableDeclarator: (path) => {
      const id = path.get('id');
      const init = path.get('init');

      if (!(id.isIdentifier() && id.node.name === storyName) || !init.isObjectExpression()) {
        return;
      }

      const args = init
        .get('properties')
        .flatMap((it) => (it.isObjectProperty() ? [it] : []))
        .find((it) => {
          const argKey = it.get('key');
          return argKey.isIdentifier() && argKey.node.name === annotationName;
        });

      if (!args) {
        return;
      }
      const argsValue = args.get('value');

      if (!argsValue || !argsValue.isObjectExpression()) {
        return;
      }
      argKeys.push(
        ...argsValue.node.properties.flatMap((value) =>
          isObjectProperty(value) && isIdentifier(value.key) ? [value.key.name] : []
        )
      );
    },
  });

  return argKeys;
}

const getObjectExpressionKeys = (node: babel.Node | undefined) => {
  return isObjectExpression(node)
    ? node.properties.flatMap((value) =>
        isObjectProperty(value) && isIdentifier(value.key) ? [value.key.name] : []
      )
    : [];
};

export default async function transform(info: FileInfo) {
  const csf = loadCsf(info.source, { makeTitle: (title) => title });
  const fileNode = csf._ast;
  // @ts-expect-error File is not yet exposed, see https://github.com/babel/babel/issues/11350#issuecomment-644118606
  const file: BabelFile = new babel.File(
    { filename: info.path },
    { code: info.source, ast: fileNode }
  );

  csf.parse();

  const metaKeys = [
    ...getObjectExpressionKeys(csf._metaAnnotations.args),
    ...getObjectExpressionKeys(csf._metaAnnotations.argTypes),
  ];

  Object.entries(csf.stories).forEach(([key, { name }]) => {
    if (!name) {
      return;
    }
    const allKeys = [
      ...metaKeys,
      ...getAnnotationKeys(file, name, 'args'),
      ...getAnnotationKeys(file, name, 'argTypes'),
    ];

    file.path.traverse({
      // CSF2 play function Story.play =
      AssignmentExpression: (path) => {
        const left = path.get('left');

        if (!left.isMemberExpression()) {
          return;
        }
        const object = left.get('object');

        if (!(object.isIdentifier() && object.node.name === name)) {
          return;
        }

        const property = left.get('property');
        if (property.isIdentifier() && property.node.name === 'play') {
          findImplicitSpies(path, info.path, allKeys);
        }
      },

      // CSF3 play function: const Story = {play: () => {} };
      VariableDeclarator: (path) => {
        const id = path.get('id');
        const init = path.get('init');

        if (!(id.isIdentifier() && id.node.name === name) || !init.isObjectExpression()) {
          return;
        }

        const play = init
          .get('properties')
          .flatMap((it) => (it.isObjectProperty() ? [it] : []))
          .find((it) => {
            const argKey = it.get('key');
            return argKey.isIdentifier() && argKey.node.name === 'play';
          });

        if (play) {
          findImplicitSpies(play, info.path, allKeys);
        }
      },
    });
  });

  return;
}

export const parser = 'tsx';
