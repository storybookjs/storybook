import { types as t } from 'storybook/internal/babel';
import type { CsfFile } from 'storybook/internal/csf-tools';

import type { ComponentRef } from './getComponentImports.ts';

export type DeclaredSubcomponent = {
  componentName: string;
  name: string;
};

export function findExactComponentMatch(
  components: ComponentRef[],
  componentName: string | undefined
) {
  if (!componentName) {
    return undefined;
  }

  return components.find((component) => component.componentName === componentName);
}

export function extractDeclaredSubcomponents(csf: CsfFile): DeclaredSubcomponent[] {
  const rawSubcomponents = unwrapSubcomponentNode(
    csf._metaAnnotations.subcomponents,
    csf._ast.program
  );

  if (!rawSubcomponents || !t.isObjectExpression(rawSubcomponents)) {
    return [];
  }

  return rawSubcomponents.properties.flatMap((property) => {
    if (!t.isObjectProperty(property)) {
      return [];
    }

    const name = getObjectKeyName(property.key);
    const directComponentName = getComponentExpressionName(property.value);
    const componentExpression = unwrapSubcomponentNode(property.value, csf._ast.program);
    const componentName = getComponentExpressionName(componentExpression) ?? directComponentName;

    return name && componentName ? [{ name, componentName }] : [];
  });
}

function findVariableInitialization(identifier: string, program: t.Program) {
  for (const node of program.body) {
    const declarations = t.isVariableDeclaration(node)
      ? node.declarations
      : t.isExportNamedDeclaration(node) && t.isVariableDeclaration(node.declaration)
        ? node.declaration.declarations
        : undefined;

    const declaration = declarations?.find(
      (decl): decl is t.VariableDeclarator =>
        t.isVariableDeclarator(decl) && t.isIdentifier(decl.id) && decl.id.name === identifier
    );

    if (declaration?.init && t.isExpression(declaration.init)) {
      return declaration.init;
    }
  }

  return undefined;
}

function unwrapSubcomponentNode(
  node: t.Node | undefined,
  program: t.Program,
  visitedIdentifiers = new Set<string>()
): t.Node | undefined {
  let current = node;

  while (current) {
    if (t.isIdentifier(current)) {
      if (visitedIdentifiers.has(current.name)) {
        return undefined;
      }

      visitedIdentifiers.add(current.name);
      current = findVariableInitialization(current.name, program);
      continue;
    }

    if (
      t.isParenthesizedExpression(current) ||
      t.isTSAsExpression(current) ||
      t.isTSSatisfiesExpression(current) ||
      t.isTSNonNullExpression(current)
    ) {
      current = current.expression;
      continue;
    }

    return current;
  }

  return undefined;
}

function getObjectKeyName(key: t.Expression | t.Identifier | t.PrivateName) {
  if (t.isIdentifier(key)) {
    return key.name;
  }

  if (t.isStringLiteral(key)) {
    return key.value;
  }

  return undefined;
}

function getComponentExpressionName(node: t.Node | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (t.isIdentifier(node)) {
    return node.name;
  }

  if (t.isMemberExpression(node) && !node.computed) {
    const objectName = getComponentExpressionName(node.object);
    const propertyName = getComponentExpressionName(node.property);

    return objectName && propertyName ? `${objectName}.${propertyName}` : undefined;
  }

  return undefined;
}
