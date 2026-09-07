import { types as t } from 'storybook/internal/babel';

type ObjectMember = t.ObjectMember | t.SpreadElement;

export const getStaticPropertyName = (property: ObjectMember): string | undefined => {
  if (t.isSpreadElement(property)) {
    return undefined;
  }
  if (property.computed) {
    if (t.isStringLiteral(property.key)) {
      return property.key.value;
    }
    if (t.isTemplateLiteral(property.key) && property.key.expressions.length === 0) {
      return property.key.quasis[0]?.value.cooked;
    }
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

export const getDirectPropertyName = (property: ObjectMember): string | undefined =>
  !t.isSpreadElement(property) && !property.computed ? getStaticPropertyName(property) : undefined;

export const getObjectPropertyValue = (property: ObjectMember): t.Expression | undefined =>
  t.isObjectProperty(property) && t.isExpression(property.value) ? property.value : undefined;

export const findSpreadProperty = (object: t.ObjectExpression): t.SpreadElement | undefined =>
  object.properties.find((property): property is t.SpreadElement => t.isSpreadElement(property));

export const findUnresolvedComputedProperty = (
  object: t.ObjectExpression
): t.ObjectMember | undefined =>
  object.properties.find(
    (property): property is t.ObjectMember =>
      !t.isSpreadElement(property) &&
      property.computed &&
      getStaticPropertyName(property) === undefined
  );

export const findIndirectProperty = (object: t.ObjectExpression): ObjectMember | undefined =>
  object.properties.find((property) => getDirectPropertyName(property) === undefined);

export const getStaticProperties = (object: t.ObjectExpression, name: string): t.ObjectMember[] =>
  object.properties.filter(
    (property): property is t.ObjectMember => getStaticPropertyName(property) === name
  );

export const getDirectProperties = (object: t.ObjectExpression, name: string): t.ObjectMember[] =>
  object.properties.filter(
    (property): property is t.ObjectMember => getDirectPropertyName(property) === name
  );
