import { types as t } from 'storybook/internal/babel';

type ObjectMember = t.ObjectMember | t.SpreadElement;

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

export const findIndirectProperty = (object: t.ObjectExpression): ObjectMember | undefined =>
  object.properties.find((property) => getStaticPropertyName(property) === undefined);

export const getStaticProperties = (object: t.ObjectExpression, name: string): t.ObjectMember[] =>
  object.properties.filter(
    (property): property is t.ObjectMember => getStaticPropertyName(property) === name
  );
