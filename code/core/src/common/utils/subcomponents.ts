import type { CsfFile } from 'storybook/internal/csf-tools';

import { type E, type Node, isStringLiteral } from '../../csf-tools/estree/ast.ts';

export type DeclaredSubcomponent = {
  componentName: string;
  name: string;
};

export function extractDeclaredSubcomponents(csf: CsfFile): DeclaredSubcomponent[] {
  const rawSubcomponents = unwrapSubcomponentNode(csf._metaAnnotations.subcomponents, csf._program);

  if (rawSubcomponents?.type !== 'ObjectExpression') {
    return [];
  }

  return rawSubcomponents.properties.flatMap((property) => {
    if (property.type !== 'Property' || property.method || property.kind !== 'init') {
      return [];
    }

    const name = getObjectKeyName(property.key);
    const directComponentName = getComponentExpressionName(property.value);
    const componentExpression = unwrapSubcomponentNode(property.value, csf._program);
    const componentName = getComponentExpressionName(componentExpression) ?? directComponentName;

    return name && componentName ? [{ name, componentName }] : [];
  });
}

function findVariableInitialization(identifier: string, program: E.Program) {
  for (const node of program.body) {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }
    const declarator = declaration.declarations.find(
      (decl) => decl.id.type === 'Identifier' && decl.id.name === identifier
    );
    if (declarator?.init) {
      return declarator.init;
    }
  }

  return undefined;
}

function unwrapSubcomponentNode(
  node: Node | undefined,
  program: E.Program,
  visitedIdentifiers = new Set<string>()
): Node | undefined {
  let current = node;

  while (current) {
    if (current.type === 'Identifier') {
      if (visitedIdentifiers.has(current.name)) {
        return undefined;
      }

      visitedIdentifiers.add(current.name);
      current = findVariableInitialization(current.name, program);
      continue;
    }

    if (
      current.type === 'ParenthesizedExpression' ||
      current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSNonNullExpression'
    ) {
      current = current.expression;
      continue;
    }

    return current;
  }

  return undefined;
}

function getObjectKeyName(key: Node) {
  if (key.type === 'Identifier') {
    return key.name;
  }

  if (isStringLiteral(key)) {
    return key.value;
  }

  return undefined;
}

function getComponentExpressionName(node: Node | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'MemberExpression' && !node.computed) {
    const objectName = getComponentExpressionName(node.object);
    const propertyName = getComponentExpressionName(node.property);

    return objectName && propertyName ? `${objectName}.${propertyName}` : undefined;
  }

  return undefined;
}
