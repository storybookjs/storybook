/**
 * Prop extractor — resolves React component props via TypeScript's type checker.
 *
 * Two extraction paths:
 *
 * **Path 1 (primary)**: `resolvePropsFromStoryFile()` — finds JSX elements in an existing story
 * file that match the target component, then calls `checker.getResolvedSignature()` to extract the
 * full props type. Works for ~95% of components (any story with JSX usage).
 *
 * **Path 2 (fallback)**: `resolvePropsFromComponentType()` — for args-only stories with no JSX,
 * inspects the component's type directly via `getCallSignatures()[0].parameters[0]` (similar to
 * Vue's component-meta approach). Does NOT work for polymorphic/generic components (TS #61133).
 *
 * The story path returns the selected component target together with its props type, and the
 * fallback path still resolves the props type directly. `serializeComponentDoc()` uses the selected
 * symbol and component ref from that target so member components keep their own metadata.
 *
 * TypeScript resolves props the same way as autocompletion — by calling
 * `checker.getResolvedSignature()` on the JSX element. For polymorphic components with generic call
 * signatures (e.g. Mantine's polymorphicFactory), TypeScript instantiates the generic with its
 * default type parameter, giving the correct concrete props. This avoids the `ComponentProps<T>` /
 * `infer P` limitation (TS #61133).
 */
import type ts from 'typescript';

import type { ResolvedComponentRef, ResolvedComponentTarget } from './types';
import { groupBy } from './utils';

// ---------------------------------------------------------------------------
// Output types — compatible with react-docgen-typescript's ComponentDoc shape
// ---------------------------------------------------------------------------

export interface PropItemType {
  name: string;
  raw?: string;
  value?: { value: string }[];
}

export interface ParentType {
  name: string;
  fileName: string;
}

export interface PropItem {
  name: string;
  required: boolean;
  type: PropItemType;
  description: string;
  defaultValue: { value: string } | null;
  parent?: ParentType;
  declarations?: ParentType[];
}

export interface ComponentDoc {
  displayName?: string;
  exportName: string;
  filePath: string;
  description: string;
  jsDocTags?: Record<string, string[]>;
  props: Record<string, PropItem>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Props from a single `.d.ts` or `node_modules` declaration file exceeding this count are
 * bulk-excluded from the manifest. This filters out HTML attribute interfaces (100+ props) and
 * generated CSS-in-JS types (e.g. Panda CSS styled-system) while keeping user-defined props.
 *
 * The threshold is per source file — a user's own interface with 31 props in a `.tsx` file is NOT
 * affected (only `.d.ts` and `node_modules` paths are checked).
 */
const LARGE_SOURCE_THRESHOLD = 30;

/** Max recursion depth for unwrapping React.memo/forwardRef/Object.assign chains. */
const MAX_UNWRAP_DEPTH = 5;
const MAX_SERIALIZATION_DEPTH = 5;

function resolveAliasedSymbol(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  symbol: ts.Symbol
): ts.Symbol {
  return symbol.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function getSymbolContextNode(symbol: ts.Symbol): ts.Node | undefined {
  return symbol.valueDeclaration ?? symbol.getDeclarations()?.[0];
}

function resolveComponentSymbolFromNode(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Node | undefined
): ts.Symbol | undefined {
  if (!node) {
    return undefined;
  }

  const symbol = checker.getSymbolAtLocation(node);
  return symbol ? resolveComponentSymbol(typescript, checker, symbol, node) : undefined;
}

/**
 * Normalizes the symbol we get from JSX/member resolution to the declaration symbol that owns the
 * component metadata.
 *
 * For top-level components, TypeScript usually gives us the declaration symbol directly. For member
 * selections it often gives an intermediate symbol instead, for example:
 *
 * - A shorthand/property symbol from `export const Accordion = { Root }`
 * - An attached-member symbol from `ButtonRoot.Aligner = Aligner`
 * - A property signature from `Aligner: typeof Aligner`
 * - An anonymous function symbol (`__function`) for `const Aligner = () => ...`
 *
 * Those symbols do not reliably carry the selected member's JSDoc/defaults, so we follow them back
 * to the actual component declaration before serialization.
 */
function resolveComponentSymbol(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  contextNode: ts.Node,
  depth = 0
): ts.Symbol {
  let resolved = resolveAliasedSymbol(typescript, checker, symbol);
  if (depth > MAX_UNWRAP_DEPTH) {
    return resolved;
  }

  const declarationForPromotion = getSymbolContextNode(resolved);
  if (
    declarationForPromotion &&
    (typescript.isArrowFunction(declarationForPromotion) ||
      typescript.isFunctionExpression(declarationForPromotion)) &&
    declarationForPromotion.parent &&
    typescript.isVariableDeclaration(declarationForPromotion.parent) &&
    typescript.isIdentifier(declarationForPromotion.parent.name)
  ) {
    const variableSymbol = checker.getSymbolAtLocation(declarationForPromotion.parent.name);
    if (variableSymbol) {
      resolved = resolveAliasedSymbol(typescript, checker, variableSymbol);
    }
  }

  const declaration = getSymbolContextNode(resolved);
  if (declaration) {
    if (typescript.isShorthandPropertyAssignment(declaration)) {
      const valueSymbol = checker.getShorthandAssignmentValueSymbol(declaration);
      if (valueSymbol) {
        return resolveComponentSymbol(
          typescript,
          checker,
          valueSymbol,
          declaration.name,
          depth + 1
        );
      }
    }

    if (typescript.isPropertyAssignment(declaration)) {
      const next = resolveComponentSymbolFromNode(typescript, checker, declaration.initializer);
      if (next) {
        return next;
      }
    }

    if (
      typescript.isBinaryExpression(declaration) &&
      declaration.operatorToken.kind === typescript.SyntaxKind.EqualsToken
    ) {
      const next = resolveComponentSymbolFromNode(typescript, checker, declaration.right);
      if (next) {
        return next;
      }
    }
  }

  const shouldUseTypeSymbolFallback =
    Boolean(resolved.flags & typescript.SymbolFlags.Property) ||
    (declaration !== undefined &&
      (typescript.isPropertyAssignment(declaration) ||
        typescript.isShorthandPropertyAssignment(declaration) ||
        typescript.isPropertySignature(declaration) ||
        typescript.isPropertyDeclaration(declaration) ||
        (typescript.isBinaryExpression(declaration) &&
          declaration.operatorToken.kind === typescript.SyntaxKind.EqualsToken)));

  const typeSymbol =
    shouldUseTypeSymbolFallback &&
    checker.getTypeOfSymbolAtLocation(resolved, contextNode).getSymbol?.();
  if (typeSymbol) {
    const resolvedTypeSymbol = resolveAliasedSymbol(typescript, checker, typeSymbol);
    const typeDeclaration = getSymbolContextNode(resolvedTypeSymbol);
    if (resolvedTypeSymbol !== resolved && typeDeclaration) {
      return resolveComponentSymbol(
        typescript,
        checker,
        resolvedTypeSymbol,
        typeDeclaration,
        depth + 1
      );
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Story-based prop extraction (probe-free)
// ---------------------------------------------------------------------------

/**
 * Resolves the selected component symbol and props type by finding JSX usage of the target
 * component in a story file.
 *
 * Story files already contain JSX like `<Button />` that TypeScript has resolved. This function
 * walks the story AST to find a JSX element matching the target component and extracts the props
 * type via `getResolvedSignature()` — the same mechanism as autocomplete and the former probe
 * approach.
 *
 * @param importSpecifier - The import specifier as written in the story file (e.g., './Button',
 *   '@mantine/core')
 * @param importName - The export name of the component (e.g., 'Button', 'default')
 * @param memberAccess - For compound components (e.g., 'Root' in `<Accordion.Root />`)
 */
export function resolvePropsFromStoryFile(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  storySourceFile: ts.SourceFile,
  componentRef: ResolvedComponentRef
): ResolvedComponentTarget | undefined {
  const importSpecifier = componentRef.importId;
  const importName = componentRef.importName;
  const memberAccess = componentRef.member;
  if (!importSpecifier) {
    return undefined;
  }

  // Step 1: Find the import binding symbol in the story file.
  // This is the local symbol that the story uses in JSX (e.g., `Button` from `import { Button } from './Button'`).
  let importSymbol: ts.Symbol | undefined;

  for (const stmt of storySourceFile.statements) {
    if (!typescript.isImportDeclaration(stmt)) {
      continue;
    }
    const moduleSpec = stmt.moduleSpecifier;
    if (!typescript.isStringLiteral(moduleSpec)) {
      continue;
    }
    if (moduleSpec.text !== importSpecifier) {
      continue;
    }

    const clause = stmt.importClause;
    if (!clause) {
      continue;
    }

    if (importName === 'default') {
      // Default import: import Button from '...'
      if (clause.name) {
        importSymbol = checker.getSymbolAtLocation(clause.name);
      }
      // Also check named imports for `{ default as Button }` pattern
      if (
        !importSymbol &&
        clause.namedBindings &&
        typescript.isNamedImports(clause.namedBindings)
      ) {
        for (const spec of clause.namedBindings.elements) {
          const originalName = (spec.propertyName ?? spec.name).text;
          if (originalName === 'default') {
            importSymbol = checker.getSymbolAtLocation(spec.name);
            break;
          }
        }
      }
    } else {
      // Named import: import { Button } from '...' or import { Button as Btn } from '...'
      if (clause.namedBindings && typescript.isNamedImports(clause.namedBindings)) {
        for (const spec of clause.namedBindings.elements) {
          const originalName = (spec.propertyName ?? spec.name).text;
          if (originalName === importName) {
            importSymbol = checker.getSymbolAtLocation(spec.name);
            break;
          }
        }
      }
    }
    // Namespace import: import * as Ns from '...'
    // Only applies when memberAccess is set (compound components accessed as <Ns.Member />).
    // Without this guard, a namespace import from the same module could shadow a named
    // import we're actually looking for (e.g. `import * as X from './m'; import { Y } from './m'`).
    if (
      !importSymbol &&
      memberAccess &&
      clause.namedBindings &&
      typescript.isNamespaceImport(clause.namedBindings)
    ) {
      importSymbol = checker.getSymbolAtLocation(clause.namedBindings.name);
    }

    if (importSymbol) {
      break;
    }
  }

  if (!importSymbol) {
    return undefined;
  }

  // Step 2: Walk story file to find JSX elements using this import
  let result: ResolvedComponentTarget | undefined;

  function extractPropsFromJsx(
    node: ts.JsxSelfClosingElement | ts.JsxOpeningElement
  ): ts.Type | undefined {
    const sig = checker.getResolvedSignature(node);
    if (!sig) {
      return undefined;
    }
    const params = sig.getParameters();
    if (params.length === 0) {
      // Component with no props
      return checker.getTypeFromTypeNode(typescript.factory.createTypeLiteralNode([]));
    }
    return checker.getTypeOfSymbolAtLocation(params[0], node);
  }

  function visit(node: ts.Node) {
    if (result) {
      return;
    }

    if (typescript.isJsxSelfClosingElement(node) || typescript.isJsxOpeningElement(node)) {
      const tagName = node.tagName;

      if (memberAccess) {
        // Handle <Accordion.Root /> pattern
        if (typescript.isPropertyAccessExpression(tagName) && tagName.name.text === memberAccess) {
          const leftSym = checker.getSymbolAtLocation(tagName.expression);
          if (leftSym === importSymbol) {
            const propsType = extractPropsFromJsx(node);
            if (propsType) {
              const memberSymbol =
                checker.getSymbolAtLocation(tagName.name) ??
                checker.getTypeAtLocation(tagName.expression).getProperty(tagName.name.text) ??
                resolveComponentSymbolFromNode(typescript, checker, tagName);
              result = {
                componentRef,
                propsType,
                symbol: memberSymbol
                  ? resolveComponentSymbol(typescript, checker, memberSymbol, tagName.name)
                  : resolveAliasedSymbol(typescript, checker, importSymbol),
              };
              return;
            }
          }
        }
      } else {
        // Handle <Button /> pattern
        if (typescript.isIdentifier(tagName)) {
          const sym = checker.getSymbolAtLocation(tagName);
          if (sym === importSymbol) {
            const propsType = extractPropsFromJsx(node);
            if (propsType) {
              result = {
                componentRef,
                propsType,
                symbol: resolveAliasedSymbol(typescript, checker, sym),
              };
              return;
            }
          }
        }
      }
    }

    typescript.forEachChild(node, visit);
  }

  visit(storySourceFile);
  return result;
}

/**
 * Resolves props type directly from a component's type (Vue component-meta approach).
 *
 * For functional components: `getCallSignatures()[0].parameters[0]` For class components: construct
 * signature → return type → `props` property
 *
 * This is the fallback for args-only stories that have no JSX in the story file. Does NOT work for
 * polymorphic/generic components (TS #61133), which is acceptable since args-only stories for
 * polymorphic components don't exist in practice.
 */
export function resolvePropsFromComponentType(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  componentType: ts.Type
): ts.Type | undefined {
  // Try call signatures first (functional components — the common case)
  const callSigs = componentType.getCallSignatures();
  if (callSigs.length > 0) {
    const sig = callSigs[0];
    if (sig.parameters.length === 0) {
      // No-props component (e.g., () => <div />)
      // Return void as a sentinel — serializeComponentDocs will serialize as empty props {}
      return checker.getVoidType();
    }
    const propsType = checker.getTypeOfSymbol(sig.parameters[0]);
    if (!(propsType.flags & typescript.TypeFlags.Any)) {
      return propsType;
    }
  }

  // Try construct signatures (class components)
  // For `class Button extends React.Component<Props>`, the constructor type has
  // construct signatures whose return type (the instance) has a `props` property.
  const ctorSigs = componentType.getConstructSignatures();
  for (const sig of ctorSigs) {
    const ret = sig.getReturnType();
    const propsSym = ret.getProperty('props');
    if (propsSym) {
      const propsType = checker.getTypeOfSymbol(propsSym);
      if (!(propsType.flags & typescript.TypeFlags.Any)) {
        return propsType;
      }
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Parent / source info per property
// ---------------------------------------------------------------------------

/**
 * Returns the source file for a property symbol, used by getBulkSourceExclusions to decide whether
 * a prop comes from a "bulk" source (node_modules/.d.ts).
 *
 * When a prop has multiple declarations (e.g. user re-declares `aria-label` in their own interface
 * AND it exists in React's HTMLAttributes), we check ALL declarations. If ANY declaration is in
 * user code (not node_modules, not .d.ts), we return that user-code path so the prop is NOT
 * bulk-excluded.
 */
function getPropSourceFile(prop: ts.Symbol): string | undefined {
  const declarations = prop.getDeclarations();
  if (!declarations?.length) {
    return undefined;
  }

  // If any declaration lives in user code (not node_modules, not .d.ts),
  // return that source — the prop should not be bulk-excluded.
  for (const decl of declarations) {
    const fileName = decl.getSourceFile().fileName;
    if (!fileName.includes('node_modules') && !fileName.endsWith('.d.ts')) {
      return fileName;
    }
  }

  // All declarations are in node_modules or .d.ts — return the first one.
  return declarations[0].getSourceFile().fileName;
}

function getParentType(typescript: typeof ts, prop: ts.Symbol): ParentType | undefined {
  const declarations = prop.getDeclarations();
  if (!declarations?.length) {
    return undefined;
  }

  // Walk up the AST from the property's parent to find the enclosing named type.
  // Props declared in type literals inside intersections (e.g. `type T = { prop: X } & Base`)
  // have the chain: PropertySignature → TypeLiteralNode → IntersectionTypeNode → TypeAliasDeclaration
  let node: ts.Node | undefined = declarations[0].parent;
  while (node) {
    if (typescript.isInterfaceDeclaration(node) || typescript.isTypeAliasDeclaration(node)) {
      return {
        name: node.name.getText(),
        fileName: node.getSourceFile().fileName,
      };
    }
    node = node.parent;
  }

  return undefined;
}

function getAllDeclarationParents(
  typescript: typeof ts,
  prop: ts.Symbol
): ParentType[] | undefined {
  const declarations = prop.getDeclarations();
  if (!declarations?.length) {
    return undefined;
  }

  const parents: ParentType[] = [];

  for (const declaration of declarations) {
    const { parent } = declaration;
    if (!parent) {
      continue;
    }

    if (typescript.isInterfaceDeclaration(parent) || typescript.isTypeAliasDeclaration(parent)) {
      parents.push({
        name: parent.name.getText(),
        fileName: parent.getSourceFile().fileName,
      });
    } else if (typescript.isTypeLiteralNode(parent)) {
      parents.push({
        name: 'TypeLiteral',
        fileName: parent.getSourceFile().fileName,
      });
    }
  }

  return parents.length > 0 ? parents : undefined;
}

// ---------------------------------------------------------------------------
// Type serialization
// ---------------------------------------------------------------------------

function serializeType(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  type: ts.Type,
  isRequired: boolean,
  depth = 0
): PropItemType {
  if (depth > MAX_SERIALIZATION_DEPTH) {
    return { name: checker.typeToString(type) };
  }

  if (type.isUnion()) {
    // Filter undefined from union members before any further processing.
    // This replaces the fragile `typeString.replace(' | undefined', '')` pattern
    // which broke for `undefined | string` or multiple `undefined` members.
    const nonUndefinedTypes = type.types.filter(
      (t) => !(t.getFlags() & typescript.TypeFlags.Undefined)
    );

    const literalMembers = nonUndefinedTypes.filter(
      (t) => t.isStringLiteral() || t.isNumberLiteral()
    );

    if (literalMembers.length > 0 && literalMembers.length === nonUndefinedTypes.length) {
      const rawParts = literalMembers.map((m) => checker.typeToString(m));
      return {
        name: 'enum',
        raw: rawParts.join(' | '),
        value: literalMembers.map((m) => ({
          value: JSON.stringify((m as ts.LiteralType).value),
        })),
      };
    }

    // For optional props with a single non-undefined type, serialize that type directly.
    // This strips the implicit `| undefined` added by strictNullChecks without any string
    // manipulation, so nested `| undefined` in generics (e.g. `Record<string, number |
    // undefined>`) is preserved correctly.
    //
    // For multi-member unions we don't strip — reconstructing TypeScript's typeToString
    // behavior (boolean collapsing, parenthesization, ordering) is fragile and error-prone.
    // The `required: false` field already captures optionality; keeping `| undefined` in
    // the type name for these rare cases is the safest choice.
    if (
      !isRequired &&
      nonUndefinedTypes.length === 1 &&
      nonUndefinedTypes.length < type.types.length
    ) {
      return { name: checker.typeToString(nonUndefinedTypes[0]) };
    }
  }

  const constraint = type.getConstraint?.();
  if (constraint && constraint !== type) {
    return serializeType(typescript, checker, constraint, isRequired, depth + 1);
  }

  return { name: checker.typeToString(type) };
}

// ---------------------------------------------------------------------------
// Default value extraction
// ---------------------------------------------------------------------------

/**
 * Unwraps wrapper calls (React.forwardRef, React.memo, etc.) to find the underlying function
 * expression or declaration.
 */
function unwrapToFunction(
  typescript: typeof ts,
  node: ts.Node,
  depth = 0,
  checker?: ts.TypeChecker
): ts.FunctionLikeDeclaration | undefined {
  if (depth > MAX_UNWRAP_DEPTH) {
    return undefined;
  }

  if (
    typescript.isArrowFunction(node) ||
    typescript.isFunctionExpression(node) ||
    typescript.isFunctionDeclaration(node)
  ) {
    return node;
  }

  // Unwrap CallExpression: React.forwardRef(fn), React.memo(fn), etc.
  if (typescript.isCallExpression(node)) {
    for (const arg of node.arguments) {
      const fn = unwrapToFunction(typescript, arg, depth + 1, checker);
      if (fn) {
        return fn;
      }
    }
  }

  // Unwrap parenthesized expressions: (fn)
  if (typescript.isParenthesizedExpression(node)) {
    return unwrapToFunction(typescript, node.expression, depth + 1, checker);
  }

  // Unwrap as-expression: fn as SomeType
  if (typescript.isAsExpression(node)) {
    return unwrapToFunction(typescript, node.expression, depth + 1, checker);
  }

  // Follow identifier references when a checker is available.
  // Handles: Object.assign(StackImpl, ...) where StackImpl = forwardRef(...)
  if (typescript.isIdentifier(node) && checker) {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      const resolved =
        symbol.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const decl = resolved.valueDeclaration;
      if (decl && typescript.isVariableDeclaration(decl) && decl.initializer) {
        return unwrapToFunction(typescript, decl.initializer, depth + 1, checker);
      }
      if (decl && typescript.isFunctionDeclaration(decl)) {
        return decl;
      }
    }
  }

  return undefined;
}

/**
 * Resolves an expression to its literal string representation.
 *
 * For identifiers like `DEFAULT_SIZE` pointing to `const DEFAULT_SIZE = 'md'`, follows the
 * reference chain and returns `'md'` (the literal value). Handles variable declarations, imports,
 * enum members, and property accesses. Falls back to `.getText()` for unresolvable expressions.
 */
function resolveLiteralValue(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Expression,
  depth = 0
): string {
  if (depth > MAX_UNWRAP_DEPTH) {
    return node.getText();
  }

  // Direct literals — return source text as-is
  if (
    typescript.isStringLiteral(node) ||
    typescript.isNumericLiteral(node) ||
    typescript.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === typescript.SyntaxKind.TrueKeyword ||
    node.kind === typescript.SyntaxKind.FalseKeyword ||
    node.kind === typescript.SyntaxKind.NullKeyword
  ) {
    return node.getText();
  }

  // Prefix unary: -1, +2
  if (typescript.isPrefixUnaryExpression(node)) {
    return node.getText();
  }

  // Identifier — follow to declaration
  if (typescript.isIdentifier(node)) {
    if (node.text === 'undefined') {
      return 'undefined';
    }

    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) {
      return node.getText();
    }

    const resolved =
      symbol.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

    const decl = resolved.valueDeclaration;
    if (decl && typescript.isVariableDeclaration(decl) && decl.initializer) {
      return resolveLiteralValue(typescript, checker, decl.initializer, depth + 1);
    }
    if (decl && typescript.isEnumMember(decl) && decl.initializer) {
      return resolveLiteralValue(typescript, checker, decl.initializer, depth + 1);
    }

    // BindingElement — sibling destructured parameter: inputLabel = placeholderText
    // where placeholderText = 'Filter items' is in the same destructuring pattern
    if (decl && typescript.isBindingElement(decl) && decl.initializer) {
      return resolveLiteralValue(typescript, checker, decl.initializer, depth + 1);
    }

    return node.getText();
  }

  // PropertyAccessExpression — Enum.Value, obj.key
  if (typescript.isPropertyAccessExpression(node)) {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      const decl = symbol.valueDeclaration;
      if (decl && typescript.isEnumMember(decl) && decl.initializer) {
        return resolveLiteralValue(typescript, checker, decl.initializer, depth + 1);
      }
      if (decl && typescript.isPropertyAssignment(decl) && decl.initializer) {
        return resolveLiteralValue(typescript, checker, decl.initializer, depth + 1);
      }
      if (decl && typescript.isVariableDeclaration(decl) && decl.initializer) {
        return resolveLiteralValue(typescript, checker, decl.initializer, depth + 1);
      }
    }
    return node.getText();
  }

  // Fallback — return source text
  return node.getText();
}

/**
 * Collects default values from an ObjectBindingPattern into the given map.
 *
 * For `{ size = 'md', icon: Icon = DefaultIcon }`, adds: 'size' → "'md'", 'icon' → 'DefaultIcon'
 *
 * When a checker is provided, identifiers like `DEFAULT_SIZE` are resolved to their literal values
 * (e.g. `'md'`).
 */
function collectBindingDefaults(
  typescript: typeof ts,
  pattern: ts.ObjectBindingPattern,
  defaults: Map<string, string>,
  checker?: ts.TypeChecker
): void {
  for (const element of pattern.elements) {
    if (element.initializer) {
      // Use the property name if renamed (e.g. { icon: Icon = DefaultIcon }),
      // otherwise use the binding name
      const propName = element.propertyName
        ? element.propertyName.getText()
        : element.name.getText();
      defaults.set(
        propName,
        checker
          ? resolveLiteralValue(typescript, checker, element.initializer)
          : element.initializer.getText()
      );
    }
  }
}

function unwrapExpression(typescript: typeof ts, expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    typescript.isParenthesizedExpression(current) ||
    typescript.isAsExpression(current) ||
    typescript.isNonNullExpression(current) ||
    (typescript.isSatisfiesExpression?.(current) ?? false)
  ) {
    current = (current as ts.ParenthesizedExpression).expression;
  }

  return current;
}

function isPropsIdentifier(
  typescript: typeof ts,
  node: ts.Expression,
  paramName: ts.Identifier,
  checker?: ts.TypeChecker
): boolean {
  if (!typescript.isIdentifier(node)) {
    return false;
  }

  if (!checker) {
    return node.text === paramName.text;
  }

  const symbol = checker.getSymbolAtLocation(node);
  const paramSymbol = checker.getSymbolAtLocation(paramName);

  return symbol !== undefined && symbol === paramSymbol;
}

function isPropsDerivedInitializer(
  typescript: typeof ts,
  initializer: ts.Expression,
  paramName: ts.Identifier,
  checker?: ts.TypeChecker
): boolean {
  const expr = unwrapExpression(typescript, initializer);

  if (isPropsIdentifier(typescript, expr, paramName, checker)) {
    return true;
  }

  if (typescript.isAwaitExpression(expr)) {
    return isPropsDerivedInitializer(typescript, expr.expression, paramName, checker);
  }

  if (
    typescript.isBinaryExpression(expr) &&
    [
      typescript.SyntaxKind.BarBarToken,
      typescript.SyntaxKind.QuestionQuestionToken,
      typescript.SyntaxKind.AmpersandAmpersandToken,
    ].includes(expr.operatorToken.kind)
  ) {
    return (
      isPropsDerivedInitializer(typescript, expr.left, paramName, checker) ||
      isPropsDerivedInitializer(typescript, expr.right, paramName, checker)
    );
  }

  if (typescript.isConditionalExpression(expr)) {
    return (
      isPropsDerivedInitializer(typescript, expr.whenTrue, paramName, checker) ||
      isPropsDerivedInitializer(typescript, expr.whenFalse, paramName, checker)
    );
  }

  if (typescript.isCallExpression(expr) || typescript.isNewExpression(expr)) {
    return (
      expr.arguments?.some((arg) =>
        isPropsDerivedInitializer(typescript, arg, paramName, checker)
      ) ?? false
    );
  }

  return false;
}

/**
 * Extracts destructuring default values from the component function.
 *
 * Handles two patterns:
 *
 * 1. **Parameter destructuring**: `({ size = 'md' }: Props) => ...`
 * 2. **Body destructuring**: `(props) => { const { size = 'md' } = props; ... }` Also handles `const {
 *    size = 'md' } = resolveProps(props, ...)` and similar.
 *
 * Returns Map { 'size' => "'md'" }. For class components or non-destructured params, returns an
 * empty map.
 */
function extractDestructuringDefaults(
  typescript: typeof ts,
  resolved: ts.Symbol,
  checker?: ts.TypeChecker
): Map<string, string> {
  const defaults = new Map<string, string>();
  const decl = resolved.valueDeclaration;
  if (!decl) {
    return defaults;
  }

  // Find the function: may be directly a function, or wrapped in forwardRef/memo/etc.
  let fn: ts.FunctionLikeDeclaration | undefined;

  if (typescript.isFunctionDeclaration(decl)) {
    fn = decl;
    // For overloaded functions, valueDeclaration points to the first overload (no body).
    // Find the implementation signature (the one with a body) to get destructuring defaults.
    if (!fn.body) {
      const allDecls = resolved.getDeclarations?.() ?? [];
      for (const d of allDecls) {
        if (typescript.isFunctionDeclaration(d) && d.body) {
          fn = d;
          break;
        }
      }
    }
  } else if (typescript.isVariableDeclaration(decl) && decl.initializer) {
    fn = unwrapToFunction(typescript, decl.initializer, 0, checker);
  } else if (typescript.isExportAssignment(decl) && decl.expression) {
    // export default Object.assign(Component, { Sub }), export default forwardRef(...)
    fn = unwrapToFunction(typescript, decl.expression, 0, checker);
  }

  if (!fn) {
    return defaults;
  }

  // Get the first parameter (props)
  const firstParam = fn.parameters[0];
  if (!firstParam) {
    return defaults;
  }

  // Case 1: Parameter-level destructuring — ({ size = 'md' }: Props) => ...
  if (typescript.isObjectBindingPattern(firstParam.name)) {
    collectBindingDefaults(typescript, firstParam.name, defaults, checker);
    return defaults;
  }

  const propsParamName = typescript.isIdentifier(firstParam.name) ? firstParam.name : undefined;

  // Case 2: Body-level destructuring — (props) => { const { size = 'md' } = props; }
  // Also handles: const { size = 'md' } = resolveProps(props, ...)
  if (fn.body && propsParamName) {
    const body = typescript.isBlock(fn.body) ? fn.body : undefined;
    if (body) {
      for (const stmt of body.statements) {
        if (!typescript.isVariableStatement(stmt)) {
          continue;
        }
        for (const varDecl of stmt.declarationList.declarations) {
          if (
            typescript.isObjectBindingPattern(varDecl.name) &&
            varDecl.initializer &&
            isPropsDerivedInitializer(typescript, varDecl.initializer, propsParamName, checker)
          ) {
            collectBindingDefaults(typescript, varDecl.name, defaults, checker);
          }
        }
      }
    }
  }

  return defaults;
}

/**
 * Collects default values from an object literal expression.
 *
 * Used for `defaultProps = { size: 'md', disabled: false }` patterns. Handles PropertyAssignment
 * and ShorthandPropertyAssignment.
 */
function collectObjectLiteralDefaults(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  obj: ts.ObjectLiteralExpression,
  defaults: Map<string, string>
): void {
  for (const prop of obj.properties) {
    if (typescript.isPropertyAssignment(prop) && prop.name) {
      const name = prop.name.getText();
      defaults.set(name, resolveLiteralValue(typescript, checker, prop.initializer));
    } else if (typescript.isShorthandPropertyAssignment(prop)) {
      const name = prop.name.getText();
      const symbol = checker.getShorthandAssignmentValueSymbol(prop);
      if (
        symbol?.valueDeclaration &&
        typescript.isVariableDeclaration(symbol.valueDeclaration) &&
        symbol.valueDeclaration.initializer
      ) {
        defaults.set(
          name,
          resolveLiteralValue(typescript, checker, symbol.valueDeclaration.initializer)
        );
      } else {
        defaults.set(name, name);
      }
    }
  }
}

/**
 * Extracts default values from `Component.defaultProps = {...}` and `static defaultProps = {...}`
 * patterns.
 *
 * This is a legacy React pattern (deprecated in React 19) but still used in many codebases. Lower
 * priority than destructuring defaults.
 */
function extractStaticDefaultProps(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  resolved: ts.Symbol
): Map<string, string> {
  const defaults = new Map<string, string>();

  const decl = resolved.valueDeclaration ?? resolved.getDeclarations()?.[0];
  if (!decl) {
    return defaults;
  }
  const componentSourceFile = decl.getSourceFile();

  for (const stmt of componentSourceFile.statements) {
    // Pattern 1: Class with static defaultProps = { size: 'md' }
    if (typescript.isClassDeclaration(stmt) && stmt.name) {
      const classSymbol = checker.getSymbolAtLocation(stmt.name);
      if (classSymbol !== resolved) {
        continue;
      }

      for (const member of stmt.members) {
        if (!typescript.isPropertyDeclaration(member)) {
          continue;
        }
        if (!member.name || member.name.getText() !== 'defaultProps') {
          continue;
        }
        if (!member.initializer) {
          continue;
        }

        let initializer: ts.Expression = member.initializer;
        // Follow identifier reference: static defaultProps = myDefaults
        if (typescript.isIdentifier(initializer)) {
          const sym = checker.getSymbolAtLocation(initializer);
          const symDecl = sym?.valueDeclaration;
          if (symDecl && typescript.isVariableDeclaration(symDecl) && symDecl.initializer) {
            initializer = symDecl.initializer;
          }
        }

        if (typescript.isObjectLiteralExpression(initializer)) {
          collectObjectLiteralDefaults(typescript, checker, initializer, defaults);
        }
      }
    }

    // Pattern 2: Component.defaultProps = { size: 'md' }
    if (
      typescript.isExpressionStatement(stmt) &&
      typescript.isBinaryExpression(stmt.expression) &&
      stmt.expression.operatorToken.kind === typescript.SyntaxKind.EqualsToken
    ) {
      const left = stmt.expression.left;
      if (!typescript.isPropertyAccessExpression(left)) {
        continue;
      }
      if (left.name.text !== 'defaultProps') {
        continue;
      }

      // Check if the expression target is our component
      const targetSymbol = checker.getSymbolAtLocation(left.expression);
      if (!targetSymbol) {
        continue;
      }

      const targetResolved =
        targetSymbol.flags & typescript.SymbolFlags.Alias
          ? checker.getAliasedSymbol(targetSymbol)
          : targetSymbol;

      if (targetResolved !== resolved) {
        continue;
      }

      let right: ts.Expression = stmt.expression.right;
      // Follow identifier reference: Button.defaultProps = myDefaults
      if (typescript.isIdentifier(right)) {
        const sym = checker.getSymbolAtLocation(right);
        const symDecl = sym?.valueDeclaration;
        if (symDecl && typescript.isVariableDeclaration(symDecl) && symDecl.initializer) {
          right = symDecl.initializer;
        }
      }

      if (typescript.isObjectLiteralExpression(right)) {
        collectObjectLiteralDefaults(typescript, checker, right, defaults);
      }
    }
  }

  return defaults;
}

/** Extracts a default value from JSDoc @default / @defaultValue tags on a prop's declaration. */
function getJSDocDefault(
  typescript: typeof ts,
  prop: ts.Symbol,
  checker: ts.TypeChecker
): string | undefined {
  const tags = prop.getJsDocTags(checker);
  for (const tag of tags) {
    if (tag.name === 'default' || tag.name === 'defaultValue') {
      return typescript.displayPartsToString(tag.text) || undefined;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Single prop extraction
// ---------------------------------------------------------------------------

function extractPropItem(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  prop: ts.Symbol,
  contextNode: ts.Node,
  defaultsMap?: Map<string, string>
): PropItem {
  const isOptional = !!(prop.flags & typescript.SymbolFlags.Optional);
  const isRequired = !isOptional;

  const propType = checker.getTypeOfSymbolAtLocation(prop, contextNode);
  const type = serializeType(typescript, checker, propType, isRequired);

  const description = typescript.displayPartsToString(prop.getDocumentationComment(checker));

  const parent = getParentType(typescript, prop);
  const declarations = getAllDeclarationParents(typescript, prop);

  // Default value: prefer destructuring default, then JSDoc @default
  const propName = prop.getName();
  const destructuringDefault = defaultsMap?.get(propName);
  const jsDocDefault = getJSDocDefault(typescript, prop, checker);
  const defaultStr = destructuringDefault ?? jsDocDefault;

  return {
    name: propName,
    required: isRequired,
    type,
    description,
    defaultValue: defaultStr !== undefined ? { value: defaultStr } : null,
    parent,
    declarations,
  };
}

// ---------------------------------------------------------------------------
// >30 bulk source filter
// ---------------------------------------------------------------------------

/**
 * Identifies properties from declaration files or node_modules interfaces with more than
 * LARGE_SOURCE_THRESHOLD properties (e.g. HTMLAttributes, Panda CSS styled-system types). These are
 * filtered to keep the manifest focused on user-defined props.
 *
 * Checks both `node_modules` paths AND `.d.ts` files. The `.d.ts` check catches generated type
 * systems like Panda CSS's `styled-system/` that live outside node_modules but still inject
 * hundreds of CSS properties. Project-local `.d.ts` with fewer than 30 props per file are
 * unaffected.
 */
function getBulkSourceExclusions(properties: ts.Symbol[]): Set<string> {
  // Cache getPropSourceFile results — avoids walking declarations twice per prop.
  const propSourceCache = new Map<ts.Symbol, string | undefined>();
  const getSource = (prop: ts.Symbol) => {
    let cached = propSourceCache.get(prop);
    if (cached === undefined && !propSourceCache.has(prop)) {
      cached = getPropSourceFile(prop);
      propSourceCache.set(prop, cached);
    }
    return cached;
  };

  const sourceCount = new Map<string, number>();

  for (const prop of properties) {
    const source = getSource(prop);
    if (source && (source.includes('node_modules') || source.endsWith('.d.ts'))) {
      sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
    }
  }

  const bulkSources = new Set(
    [...sourceCount.entries()]
      .filter(([, count]) => count > LARGE_SOURCE_THRESHOLD)
      .map(([source]) => source)
  );

  const excluded = new Set<string>();
  for (const prop of properties) {
    const source = getSource(prop);
    if (source && bulkSources.has(source)) {
      excluded.add(prop.getName());
    }
  }

  return excluded;
}

// ---------------------------------------------------------------------------
// Display name computation
// ---------------------------------------------------------------------------

function computeDisplayName({
  exportSymbol,
  resolvedSymbol,
}: {
  exportSymbol?: ts.Symbol;
  resolvedSymbol: ts.Symbol;
}): string | undefined {
  const resolvedName = resolvedSymbol.getName();

  if (!exportSymbol) {
    if (resolvedName && resolvedName !== 'default' && resolvedName !== '__function') {
      return resolvedName;
    }
    return undefined;
  }

  const exportName = exportSymbol.getName();

  if (exportName === 'default') {
    if (resolvedName && resolvedName !== 'default' && resolvedName !== '__function') {
      return resolvedName;
    }
    return undefined;
  }

  return exportName;
}

function extractComponentJsDocTags(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  symbol: ts.Symbol
): Record<string, string[]> | undefined {
  const tags = symbol.getJsDocTags(checker);
  if (tags.length === 0) {
    return undefined;
  }

  const groupedTags = groupBy(tags, (tag) => tag.name);
  return Object.fromEntries(
    Object.entries(groupedTags).map(([name, grouped]) => [
      name,
      (grouped ?? []).map((tag) => typescript.displayPartsToString(tag.text ?? []).trim()),
    ])
  );
}

// ---------------------------------------------------------------------------
// Props type → ComponentDoc serialization
// ---------------------------------------------------------------------------

/**
 * Serializes one resolved component target into ComponentDoc format.
 *
 * Used by `ComponentMetaProject` to convert the output of JSX/meta resolution into the final
 * serialized format for a single story/component pair.
 */
export function serializeComponentDoc(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  {
    sourceFile,
    resolvedComponent,
    defaultsSourcePath,
  }: {
    sourceFile: ts.SourceFile;
    resolvedComponent: ResolvedComponentTarget;
    defaultsSourcePath?: string;
  }
): ComponentDoc | undefined {
  const { componentRef, propsType, symbol } = resolvedComponent;
  const exportName = componentRef.importName;
  const displayNameOverride = componentRef.componentName;
  const isMemberSelection = Boolean(componentRef.member);
  const filePath = componentRef.path ?? sourceFile.fileName;
  const resolved = resolveAliasedSymbol(typescript, checker, symbol);

  const contextNode = resolved.valueDeclaration ?? resolved.getDeclarations()?.[0];
  if (!contextNode) {
    return undefined;
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  const exportSymbol = moduleSymbol
    ? checker
        .getExportsOfModule(moduleSymbol)
        .find((candidate) => candidate.getName() === exportName)
    : undefined;

  // getApparentProperties() on a union type only returns common members.
  // For discriminated unions (e.g. Reshaped Slider: ControlledProps | UncontrolledProps),
  // variant-specific props like `value`, `defaultValue` would be lost.
  // Collect all properties across all union members, deduplicating by name.
  // When deduplicating, prefer symbols with real types (e.g. `value: number` over
  // `value?: never` which resolves to `undefined`). Props that are degraded or
  // optional in any variant are force-optional since the caller doesn't always need them.
  let allProperties: ts.Symbol[];
  let unionForceOptional: Set<string> | undefined;
  if (propsType.isUnion()) {
    const seen = new Map<string, ts.Symbol>();
    const forceOptional = new Set<string>();
    const unionMembers = (propsType as ts.UnionType).types;

    const allMemberPropSets: Set<string>[] = [];
    for (const member of unionMembers) {
      const memberPropNames = new Set<string>();
      for (const prop of member.getApparentProperties()) {
        const name = prop.getName();
        memberPropNames.add(name);

        const propType = checker.getTypeOfSymbolAtLocation(prop, contextNode);
        const isOptional = !!(prop.flags & typescript.SymbolFlags.Optional);
        // `value?: never` resolves to type `undefined` (Never + Optional → Undefined).
        // Detect these "degraded" props so we can prefer the real variant.
        const isDegraded =
          !!(propType.getFlags() & typescript.TypeFlags.Never) ||
          !!(propType.getFlags() & typescript.TypeFlags.Undefined);

        // Props with degraded type or optional in any variant → force optional
        if (isOptional || isDegraded) {
          forceOptional.add(name);
        }

        const existing = seen.get(name);
        if (!existing) {
          seen.set(name, prop);
        } else if (!isDegraded) {
          // Replace if existing is degraded but this one isn't
          const existingType = checker.getTypeOfSymbolAtLocation(existing, contextNode);
          const existingIsDegraded =
            !!(existingType.getFlags() & typescript.TypeFlags.Never) ||
            !!(existingType.getFlags() & typescript.TypeFlags.Undefined);
          if (existingIsDegraded) {
            seen.set(name, prop);
          }
        }
      }
      allMemberPropSets.push(memberPropNames);
    }

    // Props not present in ALL union members → force optional.
    // A prop that exists in variant B but not variant A must be optional
    // since the caller may pass variant A which doesn't have it.
    for (const name of seen.keys()) {
      if (!allMemberPropSets.every((s) => s.has(name))) {
        forceOptional.add(name);
      }
    }

    allProperties = Array.from(seen.values());
    unionForceOptional = forceOptional;
  } else {
    allProperties = propsType.getApparentProperties();
  }
  const excluded = getBulkSourceExclusions(allProperties);

  // Collect defaults: destructuring > defaultProps > JSDoc (in extractPropItem)
  const defaultsMap = extractDestructuringDefaults(typescript, resolved, checker);

  // Fallback: when the symbol resolves to a .d.ts file (e.g. package imports in
  // monorepos), .d.ts declarations have no function bodies so extractDestructuringDefaults
  // returns empty. Use the original source file for AST-only defaults extraction.
  if (defaultsMap.size === 0 && defaultsSourcePath) {
    const fallbackDefaults = extractDefaultsFromSourceFile(typescript, defaultsSourcePath, {
      exportName,
      localName: resolved.getName(),
      preferLocalName: isMemberSelection,
    });
    for (const [key, value] of fallbackDefaults) {
      defaultsMap.set(key, value);
    }
  }

  // Also check for defaultProps pattern (legacy, deprecated in React 19)
  const staticDefaults = extractStaticDefaultProps(typescript, checker, resolved);
  for (const [key, value] of staticDefaults) {
    if (!defaultsMap.has(key)) {
      defaultsMap.set(key, value);
    }
  }

  const props: Record<string, PropItem> = {};
  for (const prop of allProperties) {
    if (excluded.has(prop.getName())) {
      continue;
    }
    const item = extractPropItem(typescript, checker, prop, contextNode, defaultsMap);
    if (unionForceOptional?.has(prop.getName())) {
      item.required = false;
    }
    props[prop.getName()] = item;
  }

  const displayName =
    (isMemberSelection ? displayNameOverride : undefined) ??
    computeDisplayName({
      exportSymbol,
      resolvedSymbol: resolved,
    }) ??
    displayNameOverride;

  const description = typescript.displayPartsToString(resolved.getDocumentationComment(checker));
  const selectedJsDocTags = extractComponentJsDocTags(typescript, checker, resolved);
  const exportResolved =
    exportSymbol && exportSymbol !== resolved
      ? resolveAliasedSymbol(typescript, checker, exportSymbol)
      : undefined;
  const exportJsDocTags = exportResolved
    ? extractComponentJsDocTags(typescript, checker, exportResolved)
    : undefined;
  const jsDocTags =
    selectedJsDocTags?.import || !exportJsDocTags?.import
      ? selectedJsDocTags
      : {
          ...(selectedJsDocTags ?? {}),
          import: exportJsDocTags.import,
        };

  return {
    displayName,
    exportName,
    filePath,
    description,
    jsDocTags,
    props,
  };
}

// ---------------------------------------------------------------------------
// AST-only defaults extraction from source files
// ---------------------------------------------------------------------------

/**
 * Extracts destructuring defaults from a source file using pure AST walking.
 *
 * Used as a fallback when the primary file is a `.d.ts` (e.g. package imports in monorepos) where
 * function bodies are stripped. Reads the original source file, finds the exported function
 * matching `exportName`, and collects defaults from its parameter destructuring.
 *
 * Works without a TypeChecker — only string literal, numeric, boolean, null, and undefined defaults
 * are extracted. Identifier references (e.g. `noop`, `DEFAULT_SIZE`) are included as-is.
 */
function extractDefaultsFromSourceFile(
  typescript: typeof ts,
  filePath: string,
  {
    exportName,
    localName,
    preferLocalName = false,
  }: {
    exportName: string;
    localName?: string;
    preferLocalName?: boolean;
  }
): Map<string, string> {
  const defaults = new Map<string, string>();

  const content = typescript.sys.readFile(filePath);
  if (!content) {
    return defaults;
  }

  const sf = typescript.createSourceFile(
    filePath,
    content,
    typescript.ScriptTarget.Latest,
    /* setParentNodes */ true
  );

  // Build a map of top-level variable names → initializer nodes.
  // This lets us follow references like: export const Stack = Object.assign(StackImpl, ...)
  // where StackImpl is defined as: const StackImpl = forwardRef(...)
  const varMap = new Map<string, ts.Expression | ts.FunctionDeclaration>();
  for (const stmt of sf.statements) {
    if (typescript.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (typescript.isIdentifier(decl.name) && decl.initializer) {
          varMap.set(decl.name.text, decl.initializer);
        }
      }
    }
    if (typescript.isFunctionDeclaration(stmt) && stmt.name) {
      varMap.set(stmt.name.text, stmt);
    }
  }

  // Find the target: the function associated with the exported symbol.
  // For "default" export, look at export default ... or export { X as default }.
  // For named exports, look at export const X = ... or export { X }.
  const fn = preferLocalName
    ? (findLocalFunction(typescript, sf, localName, varMap) ??
      findExportedFunction(typescript, sf, exportName, varMap))
    : (findExportedFunction(typescript, sf, exportName, varMap) ??
      findLocalFunction(typescript, sf, localName, varMap));
  if (!fn) {
    return defaults;
  }

  // Extract destructuring defaults from the first parameter
  const firstParam = fn.parameters[0];
  if (!firstParam) {
    return defaults;
  }

  if (typescript.isObjectBindingPattern(firstParam.name)) {
    collectBindingDefaults(typescript, firstParam.name, defaults);
  } else if (fn.body) {
    const propsParamName = typescript.isIdentifier(firstParam.name) ? firstParam.name : undefined;

    // Body destructuring: (props) => { const { x = 1 } = props; }
    const body = typescript.isBlock(fn.body) ? fn.body : undefined;
    if (body && propsParamName) {
      for (const stmt of body.statements) {
        if (!typescript.isVariableStatement(stmt)) {
          continue;
        }
        for (const varDecl of stmt.declarationList.declarations) {
          if (
            typescript.isObjectBindingPattern(varDecl.name) &&
            varDecl.initializer &&
            isPropsDerivedInitializer(typescript, varDecl.initializer, propsParamName)
          ) {
            collectBindingDefaults(typescript, varDecl.name, defaults);
          }
        }
      }
    }
  }

  return defaults;
}

function findLocalFunction(
  typescript: typeof ts,
  sf: ts.SourceFile,
  localName: string | undefined,
  varMap: Map<string, ts.Expression | ts.FunctionDeclaration>
): ts.FunctionLikeDeclaration | undefined {
  if (!localName) {
    return undefined;
  }

  const targetExpr = varMap.get(localName);
  if (!targetExpr) {
    return undefined;
  }

  return unwrapToFunctionAST(typescript, targetExpr, varMap, 0);
}

/**
 * Finds the function-like declaration for a given export name in the source file. Pure AST —
 * follows Object.assign, forwardRef, memo, as-casts, and identifier refs.
 */
function findExportedFunction(
  typescript: typeof ts,
  sf: ts.SourceFile,
  exportName: string,
  varMap: Map<string, ts.Expression | ts.FunctionDeclaration>
): ts.FunctionLikeDeclaration | undefined {
  let targetExpr: ts.Node | undefined;

  for (const stmt of sf.statements) {
    // export default X
    if (exportName === 'default' && typescript.isExportAssignment(stmt) && !stmt.isExportEquals) {
      targetExpr = stmt.expression;
      break;
    }

    // export const X = ... or export function X
    if (typescript.isVariableStatement(stmt) && hasExportModifier(typescript, stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (
          typescript.isIdentifier(decl.name) &&
          decl.name.text === exportName &&
          decl.initializer
        ) {
          targetExpr = decl.initializer;
          break;
        }
      }
      if (targetExpr) {
        break;
      }
    }

    if (
      typescript.isFunctionDeclaration(stmt) &&
      hasExportModifier(typescript, stmt) &&
      stmt.name?.text === exportName
    ) {
      // Find implementation (not overload) for overloaded functions
      return findFunctionImpl(typescript, sf, stmt.name.text) ?? stmt;
    }

    // export { StackImpl as Stack } or export { X }
    if (
      typescript.isExportDeclaration(stmt) &&
      stmt.exportClause &&
      typescript.isNamedExports(stmt.exportClause)
    ) {
      for (const spec of stmt.exportClause.elements) {
        const exported = spec.name.text;
        const local = spec.propertyName ? spec.propertyName.text : spec.name.text;
        if (exported === exportName) {
          targetExpr = varMap.get(local);
          break;
        }
      }
      if (targetExpr) {
        break;
      }
    }
  }

  if (!targetExpr) {
    // Not explicitly exported — might be via barrel: import { X } from './...'
    // Try to find a top-level variable matching the export name
    targetExpr = varMap.get(exportName);
  }

  if (!targetExpr) {
    return undefined;
  }

  return unwrapToFunctionAST(typescript, targetExpr, varMap, 0);
}

/**
 * Pure AST version of unwrapToFunction. Follows forwardRef, memo, Object.assign, as-casts,
 * parenthesized expressions, and identifier references via varMap.
 */
function unwrapToFunctionAST(
  typescript: typeof ts,
  node: ts.Node,
  varMap: Map<string, ts.Expression | ts.FunctionDeclaration>,
  depth: number
): ts.FunctionLikeDeclaration | undefined {
  if (depth > MAX_UNWRAP_DEPTH) {
    return undefined;
  }

  // Already a function
  if (typescript.isFunctionExpression(node) || typescript.isArrowFunction(node)) {
    return node;
  }
  if (typescript.isFunctionDeclaration(node)) {
    return node;
  }

  // Parenthesized: (expr)
  if (typescript.isParenthesizedExpression(node)) {
    return unwrapToFunctionAST(typescript, node.expression, varMap, depth + 1);
  }

  // As-expression: expr as Type
  if (typescript.isAsExpression(node)) {
    return unwrapToFunctionAST(typescript, node.expression, varMap, depth + 1);
  }

  // Type assertion: <Type>expr
  if (typescript.isTypeAssertionExpression && typescript.isTypeAssertionExpression(node)) {
    return unwrapToFunctionAST(typescript, node.expression, varMap, depth + 1);
  }

  // Call expression: forwardRef(...), memo(...), Object.assign(X, ...)
  if (typescript.isCallExpression(node)) {
    const callee = node.expression;
    // Object.assign(Component, { Sub }) — first arg is the component
    if (
      typescript.isPropertyAccessExpression(callee) &&
      typescript.isIdentifier(callee.expression) &&
      callee.expression.text === 'Object' &&
      callee.name.text === 'assign' &&
      node.arguments.length >= 1
    ) {
      return unwrapToFunctionAST(typescript, node.arguments[0], varMap, depth + 1);
    }

    // forwardRef(...), memo(...) — first arg is the function
    if (node.arguments.length >= 1) {
      return unwrapToFunctionAST(typescript, node.arguments[0], varMap, depth + 1);
    }
  }

  // Identifier: follow to its declaration via varMap
  if (typescript.isIdentifier(node)) {
    const init = varMap.get(node.text);
    if (init) {
      return unwrapToFunctionAST(typescript, init, varMap, depth + 1);
    }
  }

  return undefined;
}

/** Finds the implementation body for an overloaded function declaration. */
function findFunctionImpl(
  typescript: typeof ts,
  sf: ts.SourceFile,
  name: string
): ts.FunctionDeclaration | undefined {
  for (const stmt of sf.statements) {
    if (typescript.isFunctionDeclaration(stmt) && stmt.name?.text === name && stmt.body) {
      return stmt;
    }
  }
  return undefined;
}

/** Check if a statement has the `export` modifier. */
function hasExportModifier(typescript: typeof ts, node: ts.Statement): boolean {
  return (
    typescript.canHaveModifiers(node) &&
    typescript.getModifiers(node)?.some((m) => m.kind === typescript.SyntaxKind.ExportKeyword) ===
      true
  );
}
