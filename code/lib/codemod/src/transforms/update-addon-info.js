/**
 * Takes the deprecated addon-info API, addWithInfo, and converts to the new withInfo API.
 *
 * @example Of deprecated addWithInfo API:
 *
 * ```jsx
 * storiesOf('Button').addWithInfo('story name', 'Story description.', () => (
 *   <Button label="The Button" />
 * ));
 * ```
 *
 * Converts to the new withInfo API:
 *
 * ```jsx
 * storiesOf('Button').add(
 *   'story name',
 *   withInfo('Story description.')(() => <Button label="The Button" />)
 * );
 * ```
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  /**
   * Returns a list of parameters for the withInfo function. The contents of this list is either the
   * second argument from the original addWithInfo function, if no additional options were used, or
   * a combined object of all the options from the original function.
   *
   * @param {list} args - Original addWithInfo function parameters
   * @returns {list} The modified list of parameters for the new function
   */
  const getOptions = (args) => {
    if (args[3] === undefined) {
      if (args[2] === undefined) {
        // when the optional description string is not supplied for addWithInfo, use story name
        return [args[0]];
      }
      return [args[1]];
    }
    return [
      j.objectExpression([
        j.property('init', j.identifier('text'), args[1]),
        ...args[3].properties,
      ]),
    ];
  };

  /**
   * Constructs the new withInfo function from the parameters of the original addWithInfo function.
   *
   * @param {CallExpression} addWithInfoExpression - Original function
   * @returns {CallExpression} The new withInfo function
   */
  const withInfo = (addWithInfoExpression) => {
    const { node } = addWithInfoExpression;
    const args = node.arguments;

    // if optional description string is not supplied, the story component becomes second arg
    const storyComponent = args[2] ? args[2] : args[1];

    node.callee.property.name = 'add';
    node.arguments = [
      args[0],
      j.callExpression(j.callExpression(j.identifier('withInfo'), getOptions(args)), [
        storyComponent,
      ]),
    ];

    return node;
  };

  /** Checks for - import { withInfo } from "@storybook/addon-info"; Adds the import if necessary. */
  const checkWithInfoImport = () => {
    const importExists = root
      .find(j.ImportDeclaration)
      .filter((imp) => imp.node.source.value === '@storybook/addon-info')
      .size();

    if (importExists) {
      return;
    }

    root
      .find(j.ImportDeclaration)
      .at(-1)
      .insertAfter(
        j.importDeclaration(
          [j.importSpecifier(j.identifier('withInfo'))],
          j.literal('@storybook/addon-info')
        )
      );
  };

  const addWithInfoExpressions = root.find(j.CallExpression, {
    callee: {
      property: {
        name: 'addWithInfo',
      },
    },
  });

  if (addWithInfoExpressions.size()) {
    checkWithInfoImport();
    addWithInfoExpressions.replaceWith(withInfo);
  }

  return root.toSource();
}
