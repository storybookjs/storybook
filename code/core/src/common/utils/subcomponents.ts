import type { CsfFile } from 'storybook/internal/csf-tools';

import { type E, type Node } from '../../csf-tools/estree/ast.ts';
import { staticKey } from '../../csf-tools/estree/nodes.ts';

export type DeclaredSubcomponent = {
  componentName: string;
  name: string;
  /**
   * The component expression the name was read from — the deepest node found after following
   * in-file variable aliases, or the raw property value when none was. Feeding it to the
   * meta-component resolver resolves the declared subcomponent to its file.
   */
  node: Node;
};

export function extractDeclaredSubcomponents(csf: CsfFile): DeclaredSubcomponent[] {
  return extractSubcomponents(csf._metaAnnotations.subcomponents, csf.program);
}

/**
 * The subcomponents a meta's `subcomponents` value declares, following variable aliases in
 * `program`, the module that holds the meta. For a meta outside a CSF file, such as a Svelte CSF
 * `defineMeta` object.
 */
export function extractSubcomponents(
  subcomponents: Node | undefined,
  program: E.Program
): DeclaredSubcomponent[] {
  const rawSubcomponents = unwrapSubcomponentNode(subcomponents, program);

  if (rawSubcomponents?.type !== 'ObjectExpression') {
    return [];
  }

  return rawSubcomponents.properties.flatMap((property) => {
    if (property.type !== 'Property' || property.method || property.kind !== 'init') {
      return [];
    }

    // A computed key, as in `{ [label]: Icon }`, has no name that is known before the story runs.
    const name = staticKey(property);
    const directComponentName = getComponentExpressionName(property.value);
    const componentExpression = unwrapSubcomponentNode(property.value, program);
    const componentName = getComponentExpressionName(componentExpression) ?? directComponentName;

    return name && componentName
      ? [{ componentName, name, node: componentExpression ?? property.value }]
      : [];
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
