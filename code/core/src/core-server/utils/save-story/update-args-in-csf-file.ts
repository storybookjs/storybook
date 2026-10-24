import type { CsfFile, CsfValue, ESTree } from 'storybook/internal/csf-tools';
import {
  appendToList,
  itemText,
  objectList,
  removeFromList,
  staticKey,
  textOf,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import { isValidIdentifier } from '../../../csf-tools/estree/ast.ts';
import { printObject, replaceValue } from '../../../csf-tools/estree/editor.ts';
import { isCopySafeSpread } from '../../../csf-tools/estree/values.ts';
import { SaveStoryError, assertApplied, findStory } from './utils.ts';

// Edits accumulate on `csf`; print them with `printCsf`.
export const updateArgsInCsfFile = (
  csf: CsfFile,
  exportName: string,
  args: Record<string, CsfValue<ESTree.Expression>>
) => {
  for (const key of Object.keys(args)) {
    if (!isValidIdentifier(key, false)) {
      throw new SaveStoryError(`Invalid arg name: ${JSON.stringify(key)}`);
    }
  }
  const story = findStory(csf, exportName);
  csf.transaction(() => {
    const object = story.node;
    if (object && Object.keys(args).length > 0) {
      const { properties } = object;
      const lastSpreadIndex = properties.findLastIndex(
        (property) => property.type === 'SpreadElement'
      );
      const argsProperties = properties.filter(
        (property): property is ESTree.ObjectProperty =>
          property.type === 'Property' && staticKey(property) === 'args'
      );
      const argsProperty = argsProperties[0];
      const argsIndex = argsProperty ? properties.indexOf(argsProperty) : -1;
      const argsObject = argsProperty && unwrapExpression(argsProperty.value);

      if (
        argsIndex < lastSpreadIndex &&
        argsProperties.length <= 1 &&
        properties
          .slice(argsIndex + 1)
          .every(
            (property) => property.type === 'SpreadElement' || staticKey(property) !== undefined
          ) &&
        (!argsProperty || (argsProperty.kind === 'init' && argsObject?.type === 'ObjectExpression'))
      ) {
        const spreads = properties
          .slice(argsIndex + 1)
          .filter((property) => property.type === 'SpreadElement');
        const unsafeSpread = spreads.find((spread) => !isCopySafeSpread(spread.argument));
        if (unsafeSpread) {
          throw new SaveStoryError(
            `Cannot save args: the spread \`${textOf(unsafeSpread)}\` cannot be copied safely. Add an \`args\` property after it, or edit args manually.`
          );
        }
        const { editor } = csf;
        const inherited = spreads.map(({ argument }) => {
          const source = textOf(argument);
          const reference = ['Identifier', 'MemberExpression', 'ChainExpression'].includes(
            argument.type
          )
            ? source
            : `(${source})`;
          return `...${reference}?.args`;
        });
        if (argsProperty && argsObject?.type === 'ObjectExpression') {
          const list = objectList(editor, argsObject);
          const existing = argsObject.properties
            .filter((property) => {
              const key = staticKey(property);
              return key === undefined || !Object.hasOwn(args, key);
            })
            .map((property) => itemText(editor, list, property));
          replaceValue(
            editor,
            argsProperty,
            printObject([...existing, ...inherited], editor.indent)
          );
          editor.commit();

          const updated = story.node!;
          const property = updated.properties.find((member) => staticKey(member) === 'args')!;
          const updatedList = objectList(editor, updated);
          const moved = itemText(editor, updatedList, property);
          removeFromList(editor, updatedList, [property]);
          appendToList(editor, updatedList, [moved]);
        } else {
          appendToList(editor, objectList(editor, object), [
            `args: ${printObject(inherited, editor.indent)}`,
          ]);
        }
        editor.commit();
      }
    }
    for (const [key, value] of Object.entries(args)) {
      assertApplied(exportName, story.set(['args', key], value));
    }
  });
};
