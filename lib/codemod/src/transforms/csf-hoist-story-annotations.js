const getContainingStatement = (n) => {
  if (n.node.type.endsWith('Statement')) {
    return n;
  }
  return getContainingStatement(n.parent);
};

/**
 * Hoist CSF .story annotations
 *
 * @example
 *
 * ```jsx
 * export const Basic = () => <Button />
 * Basic.story = {
 *   name: 'foo',
 *   parameters: {  },
 *   decorators = [  ],
 * };
 * ```
 *
 * Becomes:
 *
 * ```
 * export const Basic = () => <Button />;
 * Basic.storyName = 'foo';
 * Basic.parameters = {};
 * Basic.decorators = [];
 * ```
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const renameKey = (exp) =>
    exp.type === 'Identifier' && exp.name === 'name' ? j.identifier('storyName') : exp;

  // 1. If the program does not have `export default { title: '....' }, skip it
  const defaultExportWithTitle = root
    .find(j.ExportDefaultDeclaration)
    .filter(
      (def) =>
        def.node.declaration.type === 'ObjectExpression' &&
        def.node.declaration.properties.map((p) => p.key.name).includes('title')
    );
  if (defaultExportWithTitle.size() === 0) {
    return root.toSource();
  }

  // 2. Replace each Foo.story = { x: xVal } with Foo.x = xVal;
  const storyAssignments = root.find(j.AssignmentExpression).filter((exp) => {
    const { left, right } = exp.node;
    return (
      left.type === 'MemberExpression' &&
      left.object.type === 'Identifier' &&
      left.property.type === 'Identifier' &&
      left.property.name === 'story' &&
      right.type === 'ObjectExpression'
    );
  });
  storyAssignments.forEach((exp) => {
    const { left, right } = exp.node;
    right.properties.forEach((prop) => {
      const stmt = getContainingStatement(exp);
      stmt.insertBefore(
        j.assignmentStatement('=', j.memberExpression(left.object, renameKey(prop.key)), prop.value)
      );
    });
  });

  // 3. Remove the .story annotations
  storyAssignments.remove();

  // 4. Replace each Foo.story.x with Foo.x;
  const storyOverrides = root.find(j.AssignmentExpression).filter((exp) => {
    const { left } = exp.node;
    return (
      left.type === 'MemberExpression' &&
      left.object.type === 'MemberExpression' &&
      left.object.property.type === 'Identifier' &&
      left.object.property.name === 'story' &&
      left.property.type === 'Identifier'
      // ?? ANNOTATION_FIELDS.includes(right.property.name)
    );
  });
  storyOverrides.replaceWith((exp) => {
    const { left, right } = exp.node;
    return j.assignmentExpression(
      '=',
      j.memberExpression(left.object.object, renameKey(left.property)),
      right
    );
  });

  // 4. Render the updated tree
  return root.toSource({ quote: 'single' });
}
