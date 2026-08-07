import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';

const collapseWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * Syntactic TypeNode-to-string rendering, matching the legacy Compodoc spellings the argTypes
 * extractor depends on: string literals double-quoted (`"a" | "b"` feeds the enum fallback's
 * `JSON.parse`), unions joined with ` | `. Function types are the one deliberate divergence -
 * compodoc writes a bare `function`, which loses the signature the props table should show.
 *
 * Rendering a type reference also feeds its target to the misc collector, so enums and type
 * aliases referenced from other files land in `miscellaneous` for the extractor's lookups.
 */
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
    // Rendered as a real signature rather than the bare `function` compodoc emits: the summary is
    // the only place a reader learns the parameter and return types. The `function` sbType survives
    // because `isFunctionTypeString` matches an arrow signature too.
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
    const symbol = ctx.checker.getSymbolAtLocation(typeNode.typeName);
    if (symbol) {
      ctx.misc.addFromSymbol(ctx, symbol);
    }
    const name = typeNode.typeName.getText();
    const args = typeNode.typeArguments?.length
      ? `<${typeNode.typeArguments.map((arg) => renderTypeNode(ctx, arg)).join(', ')}>`
      : '';
    return `${name}${args}`;
  }
  // Keyword types, type queries, type literals, template literal types, …: the source text is
  // already the right spelling, modulo formatting whitespace.
  return collapseWhitespace(typeNode.getText());
}

/**
 * Checker-based type string for a named declaration without a type annotation. Literal types are
 * widened (`'v1'` → `string`, `false` → `boolean`) to match what the legacy pipeline inferred.
 */
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
  // The stringified name may be an alias or enum; register it so by-name lookups resolve.
  ctx.misc.addFromType(ctx, type);
  return stripImportQualifiers(checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation));
}

/**
 * The checker qualifies out-of-scope symbols as `import("@angular/core").Signal<...>`; the props
 * table wants the bare name. Applies to every checker-printed type text, including method return
 * types nested inside signatures.
 */
export const stripImportQualifiers = (text: string): string =>
  text.replace(/import\("[^"]*"\)\./g, '');
