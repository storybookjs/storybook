/**
 * Adds a `component` parameter for each storiesOf(...) call.
 *
 * For example:
 *
 * Input { Button } from './Button'; storiesOf('Button', module).add('story', () => <Button
 * label="The Button" />);
 *
 * Becomes:
 *
 * Input { Button } from './Button'; storiesOf('Button', module) .addParameters({ component: Button
 * }) .add('story', () => <Button label="The Button" />);
 *
 * Heuristics:
 *
 * - The storiesOf "kind" name must be Button
 * - Button must be imported in the file
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  //  Create a dictionary whose keys are all the named imports in the file.
  //  For instance:
  //
  //  import foo from 'foo';
  //  import { bar, baz } from 'zoo';
  //
  //  => { foo: true, bar: true, baz: true }
  const importMap = {};
  root.find(j.ImportDeclaration).forEach((imp) =>
    imp.node.specifiers.forEach((spec) => {
      importMap[spec.local.name] = true;
    })
  );

  function getLeafName(string) {
    const parts = string.split(/\/|\.|\|/);
    return parts[parts.length - 1];
  }

  function addComponentParameter(call) {
    const { node } = call;
    const leafName = getLeafName(node.arguments[0].value);
    return j.callExpression(j.memberExpression(node, j.identifier('addParameters')), [
      j.objectExpression([j.property('init', j.identifier('component'), j.identifier(leafName))]),
    ]);
  }

  root
    .find(j.CallExpression)
    .filter((call) => call.node.callee.name === 'storiesOf')
    .filter((call) => call.node.arguments.length > 0 && call.node.arguments[0].type === 'Literal')
    .filter((call) => {
      const leafName = getLeafName(call.node.arguments[0].value);
      return importMap[leafName];
    })
    .replaceWith(addComponentParameter);

  return root.toSource();
}
