import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';

const collapseWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

// Rendering is syntactic to match the legacy Compodoc spellings the argTypes extractor depends on:
// string literals double-quoted, unions joined with ` | `.
export function renderTypeNode(ctx: AnalyzerContext, typeNode: ts.TypeNode): string {
  const { ts } = ctx;
  if (ts.isLiteralTypeNode(typeNode)) {
    const { literal } = typeNode;
    if (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) {
      // JSON.stringify keeps embedded quotes/backslashes parseable for the enum fallback.
      return JSON.stringify(literal.text);
    }
    return literal.getText();
  }
  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.map((type) => renderTypeNode(ctx, type)).join(' | ');
  }
  if (ts.isIntersectionTypeNode(typeNode)) {
    return typeNode.types.map((type) => renderTypeNode(ctx, type)).join(' & ');
  }
  if (ts.isArrayTypeNode(typeNode)) {
    return `${renderTypeNode(ctx, typeNode.elementType)}[]`;
  }
  if (ts.isTupleTypeNode(typeNode)) {
    return `[${typeNode.elements.map((element) => renderTypeNode(ctx, element)).join(', ')}]`;
  }
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return `(${renderTypeNode(ctx, typeNode.type)})`;
  }
  if (ts.isFunctionTypeNode(typeNode) || ts.isConstructorTypeNode(typeNode)) {
    // A real signature rather than the bare `function` compodoc emits; `isFunctionTypeString` still
    // matches an arrow signature, so the function control survives.
    const parameters = typeNode.parameters
      .map((parameter) => {
        const name = parameter.name.getText();
        const rest = parameter.dotDotDotToken ? '...' : '';
        const optional = parameter.questionToken ? '?' : '';
        const type = parameter.type ? renderTypeNode(ctx, parameter.type) : 'any';
        return `${rest}${name}${optional}: ${type}`;
      })
      .join(', ');
    const prefix = ts.isConstructorTypeNode(typeNode) ? 'new ' : '';
    return `${prefix}(${parameters}) => ${renderTypeNode(ctx, typeNode.type)}`;
  }
  if (ts.isTypeOperatorNode(typeNode)) {
    const operator =
      typeNode.operator === ts.SyntaxKind.KeyOfKeyword
        ? 'keyof'
        : typeNode.operator === ts.SyntaxKind.ReadonlyKeyword
          ? 'readonly'
          : 'unique';
    return `${operator} ${renderTypeNode(ctx, typeNode.type)}`;
  }
  if (ts.isIndexedAccessTypeNode(typeNode)) {
    return `${renderTypeNode(ctx, typeNode.objectType)}[${renderTypeNode(ctx, typeNode.indexType)}]`;
  }
  if (ts.isTypeReferenceNode(typeNode)) {
    const name = typeNode.typeName.getText();
    const symbol = ctx.checker.getSymbolAtLocation(typeNode.typeName);
    if (symbol) {
      ctx.misc.addFromSymbol(ctx, symbol, name);
    }
    const args = typeNode.typeArguments?.length
      ? `<${typeNode.typeArguments.map((arg) => renderTypeNode(ctx, arg)).join(', ')}>`
      : '';
    return `${name}${args}`;
  }
  return collapseWhitespace(typeNode.getText());
}

// Literal types are widened (`'v1'` to `string`) to match what the legacy pipeline inferred.
export function inferTypeString(
  ctx: AnalyzerContext,
  node: ts.NamedDeclaration
): string | undefined {
  const { checker, ts } = ctx;
  if (!node.name) {
    return undefined;
  }
  const symbol = checker.getSymbolAtLocation(node.name);
  if (!symbol) {
    return undefined;
  }
  const type = checker.getBaseTypeOfLiteralType(checker.getTypeOfSymbolAtLocation(symbol, node));
  ctx.misc.addFromType(ctx, type);
  return stripImportQualifiers(checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation));
}

// The checker qualifies out-of-scope symbols as `import("@angular/core").Signal<...>`; the props
// table wants the bare name.
export const stripImportQualifiers = (text: string): string =>
  text.replace(/import\("[^"]*"\)\./g, '');
