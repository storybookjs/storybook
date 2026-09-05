import { types as t } from 'storybook/internal/babel';

type ObjectMember = t.ObjectMember | t.SpreadElement;

/**
 * The key of a non-computed identifier or string-literal property.
 *
 * Returns `undefined` for spread elements, computed keys, and every other shape a configuration
 * migration cannot statically reason about. Config migrations must treat `undefined` as "bail out
 * with an actionable error", never as "skip this property".
 */
export const getStaticPropertyName = (property: ObjectMember): string | undefined => {
  if (t.isSpreadElement(property) || property.computed) {
    return undefined;
  }
  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  return undefined;
};

/**
 * The first member of `object` that defeats static analysis: a spread element, or a property whose
 * key {@link getStaticPropertyName} cannot read. The node is returned rather than a boolean so
 * callers can point at its source location in the error they raise.
 */
export const findIndirectProperty = (object: t.ObjectExpression): ObjectMember | undefined =>
  object.properties.find(
    (property) => t.isSpreadElement(property) || getStaticPropertyName(property) === undefined
  );

/** Every member of `object` whose static key is exactly `name`. */
export const getStaticProperties = (object: t.ObjectExpression, name: string): ObjectMember[] =>
  object.properties.filter((property) => getStaticPropertyName(property) === name);
