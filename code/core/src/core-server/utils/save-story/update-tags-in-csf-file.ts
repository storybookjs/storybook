import { types as t, traverse } from 'storybook/internal/babel';

import { SaveStoryError } from './utils.ts';

const findTagsProperty = (object: t.ObjectExpression) => {
  return object.properties.find((property) => {
    if (!t.isObjectProperty(property)) {
      return false;
    }

    const key = property.key;

    return (
      (t.isIdentifier(key) && key.name === 'tags') ||
      (t.isStringLiteral(key) && key.value === 'tags')
    );
  });
};

const addTagsToObjectExpression = (object: t.ObjectExpression, tags: string[]) => {
  const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean);

  if (normalizedTags.length === 0) {
    return;
  }

  const tagsProperty = findTagsProperty(object);

  if (!tagsProperty) {
    object.properties.unshift(
      t.objectProperty(
        t.identifier('tags'),
        t.arrayExpression(normalizedTags.map((tag) => t.stringLiteral(tag)))
      )
    );

    return;
  }

  if (!t.isObjectProperty(tagsProperty)) {
    throw new SaveStoryError(`Story tags could not be updated`);
  }

  if (!t.isArrayExpression(tagsProperty.value)) {
    throw new SaveStoryError(`Updating non-array tags is not supported`);
  }

  const existingTags = new Set(
    tagsProperty.value.elements
      .filter((element): element is t.StringLiteral => t.isStringLiteral(element))
      .map((element) => element.value)
  );

  for (const tag of normalizedTags) {
    if (existingTags.has(tag)) {
      continue;
    }

    tagsProperty.value.elements.push(t.stringLiteral(tag));
    existingTags.add(tag);
  }
};

const findFirstObjectExpression = (node: t.Node): t.ObjectExpression | undefined => {
  if (t.isObjectExpression(node)) {
    return node;
  }

  let found: t.ObjectExpression | undefined;

  traverse(node, {
    ObjectExpression(path) {
      if (found) {
        return;
      }

      found = path.node;
      path.stop();
    },

    noScope: true,
  });

  return found;
};

const getStoryObjectExpression = (node: t.Node): t.ObjectExpression => {
  // CSF3:
  //
  // export const Primary = {
  //   args: {},
  // };
  if (t.isObjectExpression(node)) {
    return node;
  }

  // CSF4:
  //
  // export const Primary = meta.story({
  //   args: {},
  // });
  if (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.property) &&
    node.callee.property.name === 'story'
  ) {
    const argument = node.arguments[0];

    if (argument && t.isObjectExpression(argument)) {
      return argument;
    }

    throw new SaveStoryError(`Story configuration could not be updated`);
  }

  // CSF2 render functions / unsupported call expressions
  if (t.isArrowFunctionExpression(node) || t.isCallExpression(node)) {
    throw new SaveStoryError(`Updating tags in a CSF2 story is not supported`);
  }

  const objectExpression = findFirstObjectExpression(node);

  if (!objectExpression) {
    throw new SaveStoryError(`Story configuration could not be found`);
  }

  return objectExpression;
};

const getComponentObjectExpression = (node: t.Node): t.ObjectExpression => {
  // CSF3:
  //
  // const meta = {
  //   component: Button,
  // };
  if (t.isObjectExpression(node)) {
    return node;
  }

  // CSF4:
  //
  // const meta = preview.meta({
  //   component: Button,
  // });
  if (
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.property) &&
    node.callee.property.name === 'meta'
  ) {
    const argument = node.arguments[0];

    if (argument && t.isObjectExpression(argument)) {
      return argument;
    }

    throw new SaveStoryError(`Component configuration could not be updated`);
  }

  const objectExpression = findFirstObjectExpression(node);

  if (!objectExpression) {
    throw new SaveStoryError(`Component configuration could not be found`);
  }

  return objectExpression;
};

export const updateStoryTagsInCsfFile = async (node: t.Node, tags: string[]) => {
  const objectExpression = getStoryObjectExpression(node);

  addTagsToObjectExpression(objectExpression, tags);
};

export const updateComponentTagsInCsfFile = async (node: t.Node, tags: string[]) => {
  const objectExpression = getComponentObjectExpression(node);

  addTagsToObjectExpression(objectExpression, tags);
};
