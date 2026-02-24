/**
 * Prop extractor using React's own JSX type system for component detection.
 *
 * Component detection uses JSX elements in a virtual probe file:
 *
 *   export const __el_Button__ = <Button />;
 *
 * TypeScript resolves props the same way as autocompletion — by calling
 * `checker.getResolvedSignature()` on the JSX element. For polymorphic
 * components with generic call signatures (e.g. Mantine's polymorphicFactory),
 * TypeScript instantiates the generic with its default type parameter,
 * giving the correct concrete props.
 *
 * This avoids the `ComponentProps<T>` / `infer P` limitation where
 * TypeScript cannot infer P from a generic call signature (TS #61133).
 *
 * React is the sole authority on what constitutes a component.
 * No manual heuristics are layered on top. Uppercase filtering mirrors
 * how JSX itself distinguishes intrinsic elements (`<div>`) from
 * components (`<Button>`).
 */
import type ts from 'typescript';

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
  defaultValue: { value: any } | null;
  parent?: ParentType;
  declarations?: ParentType[];
}

export interface ComponentDoc {
  displayName: string;
  exportName: string;
  filePath: string;
  description: string;
  props: Record<string, PropItem>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LARGE_SOURCE_THRESHOLD = 30;
const MAX_SERIALIZATION_DEPTH = 5;

// ---------------------------------------------------------------------------
// Candidate extraction
// ---------------------------------------------------------------------------

/**
 * Extracts candidate component exports from a source file.
 *
 * Candidates are uppercase-named value exports (or `default`).
 * Type-only exports (interfaces, type aliases) are excluded.
 */
export function getCandidates(
  typescript: typeof ts,
  program: ts.Program,
  filePath: string
): Array<{ exportName: string; isDefault: boolean }> {
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) return [];

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return [];

  const exports = checker.getExportsOfModule(moduleSymbol);

  return exports
    .filter((exp) => {
      const name = exp.getName();
      if (name !== 'default' && !/^[A-Z]/.test(name)) return false;
      const resolved =
        exp.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
      return !!resolved.valueDeclaration;
    })
    .map((exp) => ({
      exportName: exp.getName(),
      isDefault: exp.getName() === 'default',
    }));
}

// ---------------------------------------------------------------------------
// Probe source generation
// ---------------------------------------------------------------------------

/**
 * Generates a virtual TSX source with two mechanisms per candidate:
 *
 * 1. **Conditional type alias** — detects whether the export is a valid JSX
 *    component (`typeof X extends JSXElementConstructor<any> ? true : never`).
 *    Non-components resolve to `never` → filtered out.
 *
 * 2. **JSX self-closing element** — extracts concrete props via
 *    `checker.getResolvedSignature()`. For polymorphic components with generic
 *    call signatures (e.g. Mantine's polymorphicFactory), TypeScript
 *    instantiates the generic with its default type parameter automatically.
 *    This avoids the `ComponentProps<T>` / `infer P` limitation (TS #61133).
 *
 * The conditional type handles detection, JSX handles props — best of both.
 *
 * For a file with `export const Button` and `export default Header`:
 * ```tsx
 * import { ComponentProps, JSXElementConstructor } from 'react';
 * import __Default__, { Button } from './Component';
 * export type __det_default__ = typeof __Default__ extends JSXElementConstructor<any> ? true : never;
 * export type __det_Button__ = typeof Button extends JSXElementConstructor<any> ? true : never;
 * export const __el_default__ = <__Default__ />;
 * export const __el_Button__ = <Button />;
 * ```
 */
export function generateProbeSource(
  importPath: string,
  candidates: Array<{ exportName: string; isDefault: boolean }>
): { source: string; varNameMap: Map<string, string>; detTypeMap: Map<string, string> } {
  const lines: string[] = [];
  const varNameMap = new Map<string, string>();
  const detTypeMap = new Map<string, string>();

  lines.push(`import { JSXElementConstructor } from 'react';`);

  const hasDefault = candidates.some((c) => c.isDefault);
  const named = candidates.filter((c) => !c.isDefault);

  // Build import statement
  const parts: string[] = [];
  if (hasDefault) parts.push('__Default__');
  if (named.length > 0) parts.push(`{ ${named.map((c) => c.exportName).join(', ')} }`);

  if (parts.length > 0) {
    lines.push(`import ${parts.join(', ')} from '${importPath}';`);
  }

  // Build detection types + JSX elements
  if (hasDefault) {
    const detName = '__det_default__';
    const varName = '__el_default__';
    lines.push(
      `export type ${detName} = typeof __Default__ extends JSXElementConstructor<any> ? true : never;`
    );
    lines.push(`export const ${varName} = <__Default__ />;`);
    detTypeMap.set('default', detName);
    varNameMap.set('default', varName);
  }
  for (const c of named) {
    const detName = `__det_${c.exportName}__`;
    const varName = `__el_${c.exportName}__`;
    lines.push(
      `export type ${detName} = typeof ${c.exportName} extends JSXElementConstructor<any> ? true : never;`
    );
    lines.push(`export const ${varName} = <${c.exportName} />;`);
    detTypeMap.set(c.exportName, detName);
    varNameMap.set(c.exportName, varName);
  }

  return { source: lines.join('\n'), varNameMap, detTypeMap };
}

// ---------------------------------------------------------------------------
// Probe type resolution
// ---------------------------------------------------------------------------

/**
 * Resolves props types from a probe source file using a hybrid approach:
 *
 * 1. **Detection via conditional types** — checks `__det_X__` type aliases.
 *    If the alias resolves to `never`, X is not a JSXElementConstructor → skip.
 *
 * 2. **Props via JSX elements** — for detected components, walks
 *    JsxSelfClosingElement nodes and uses `checker.getResolvedSignature()` to
 *    get concrete props. For polymorphic components with generic call signatures,
 *    TypeScript instantiates the generic with its default type parameter
 *    automatically — avoiding the `ComponentProps<T>` / `infer P` limitation.
 *
 * This is the core logic shared between the standalone `detectComponents`
 * and the LanguageService-based `PropExtractionProject`.
 */
export function resolveProbeTypes(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  probeSourceFile: ts.SourceFile | undefined,
  varNameMap: Map<string, string>,
  detTypeMap?: Map<string, string>
): Map<string, ts.Type> {
  const propsTypes = new Map<string, ts.Type>();
  if (!probeSourceFile) return propsTypes;

  // Step 1: Detection — check conditional type aliases to find real components
  const detectedComponents = new Set<string>();
  if (detTypeMap) {
    const probeModSym = checker.getSymbolAtLocation(probeSourceFile);
    if (probeModSym) {
      const probeExports = checker.getExportsOfModule(probeModSym);
      for (const [exportName, detTypeName] of detTypeMap) {
        const sym = probeExports.find((e) => e.getName() === detTypeName);
        if (!sym) continue;
        const decls = sym.getDeclarations();
        if (!decls?.length) continue;
        const decl = decls[0];
        if (!typescript.isTypeAliasDeclaration(decl)) continue;
        const resolvedType = checker.getTypeFromTypeNode(decl.type);
        // never → React says this is not a JSXElementConstructor. Skip.
        if (resolvedType.flags & typescript.TypeFlags.Never) continue;
        detectedComponents.add(exportName);
      }
    }
  }

  // Step 2: Props extraction — walk JSX elements for detected components
  const reverseMap = new Map<string, string>();
  for (const [exportName, varName] of varNameMap) {
    reverseMap.set(varName, exportName);
  }

  function visit(node: ts.Node) {
    if (typescript.isJsxSelfClosingElement(node)) {
      // Find the parent variable declaration to get the var name
      let varName: string | undefined;
      let parent = node.parent;
      while (parent) {
        if (typescript.isVariableDeclaration(parent) && typescript.isIdentifier(parent.name)) {
          varName = parent.name.text;
          break;
        }
        parent = parent.parent;
      }

      if (!varName) return;
      const exportName = reverseMap.get(varName);
      if (exportName === undefined) return;

      // If we have detection info, only process detected components
      if (detTypeMap && !detectedComponents.has(exportName)) return;

      // Get the resolved signature — same mechanism as autocomplete
      const sig = checker.getResolvedSignature(node);
      if (!sig) return;

      const params = sig.getParameters();
      if (params.length === 0) {
        // Component with no props (e.g. `() => <svg />`)
        propsTypes.set(exportName, checker.getTypeFromTypeNode(
          typescript.factory.createTypeLiteralNode([])
        ));
        return;
      }

      // First param = props
      propsTypes.set(exportName, checker.getTypeOfSymbolAtLocation(params[0], node));
    }

    typescript.forEachChild(node, visit);
  }

  visit(probeSourceFile);
  return propsTypes;
}

// ---------------------------------------------------------------------------
// Probe program creation
// ---------------------------------------------------------------------------

/**
 * Creates a compiler host that serves the probe file from memory while
 * reusing source files from the original program for all other files.
 */
function createProbeHost(
  typescript: typeof ts,
  probeFilePath: string,
  probeSource: string,
  originalProgram: ts.Program,
  options: ts.CompilerOptions
): ts.CompilerHost {
  const host = typescript.createCompilerHost(options);
  const origGetSourceFile = host.getSourceFile.bind(host);
  const origFileExists = host.fileExists.bind(host);
  const origReadFile = host.readFile.bind(host);
  const origDirectoryExists = host.directoryExists?.bind(host);

  const originalFiles = new Map<string, ts.SourceFile>();
  for (const sf of originalProgram.getSourceFiles()) {
    originalFiles.set(sf.fileName, sf);
  }

  host.getSourceFile = (fileName, languageVersionOrOptions) => {
    if (fileName === probeFilePath) {
      const version =
        typeof languageVersionOrOptions === 'number'
          ? languageVersionOrOptions
          : languageVersionOrOptions.languageVersion;
      return typescript.createSourceFile(fileName, probeSource, version);
    }
    const orig = originalFiles.get(fileName);
    if (orig) return orig;
    return origGetSourceFile(fileName, languageVersionOrOptions);
  };

  host.fileExists = (fileName) => {
    if (fileName === probeFilePath) return true;
    if (originalFiles.has(fileName)) return true;
    return origFileExists(fileName);
  };

  host.readFile = (fileName) => {
    if (fileName === probeFilePath) return probeSource;
    const orig = originalFiles.get(fileName);
    if (orig) return orig.text;
    return origReadFile(fileName);
  };

  host.directoryExists = (dir) => {
    const dirWithSlash = dir.endsWith('/') ? dir : dir + '/';
    if (probeFilePath.startsWith(dirWithSlash)) return true;
    for (const key of originalFiles.keys()) {
      if (key.startsWith(dirWithSlash)) return true;
    }
    return origDirectoryExists ? origDirectoryExists(dir) : true;
  };

  return host;
}

/**
 * Detects which exports are React components using a hybrid approach:
 *
 * 1. **Detection** via conditional types: `typeof X extends JSXElementConstructor<any>`
 *    rejects non-components (plain objects, strings, utility functions).
 *
 * 2. **Props extraction** via JSX elements: `<X />` with `getResolvedSignature()`
 *    correctly handles polymorphic components with generic call signatures
 *    (e.g. Mantine's polymorphicFactory), avoiding the `ComponentProps<T>` /
 *    `infer P` limitation (TS #61133).
 *
 * This delegates all component detection logic to React — no manual heuristics.
 */
export function detectComponents(
  typescript: typeof ts,
  filePath: string,
  candidates: Array<{ exportName: string; isDefault: boolean }>,
  originalProgram: ts.Program
): {
  propsTypes: Map<string, ts.Type>;
  probeChecker: ts.TypeChecker;
  probeProgram: ts.Program;
} | undefined {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  const baseName = filePath.split('/').pop()!.replace(/\.(tsx?|jsx?)$/, '');
  // .tsx extension required for JSX elements in the probe
  const probeFilePath = `${dir}/__probe_${baseName}__.tsx`;

  const { source, varNameMap, detTypeMap } = generateProbeSource(`./${baseName}`, candidates);

  const options = originalProgram.getCompilerOptions();
  const host = createProbeHost(typescript, probeFilePath, source, originalProgram, options);

  const probeProgram = typescript.createProgram(
    [probeFilePath, filePath],
    options,
    host,
    originalProgram
  );

  const probeChecker = probeProgram.getTypeChecker();
  const probeSF = probeProgram.getSourceFile(probeFilePath);
  if (!probeSF) return undefined;

  const propsTypes = resolveProbeTypes(typescript, probeChecker, probeSF, varNameMap, detTypeMap);

  return { propsTypes, probeChecker, probeProgram };
}

// ---------------------------------------------------------------------------
// Parent / source info per property
// ---------------------------------------------------------------------------

/**
 * Returns the source file for a property symbol, used by getBulkSourceExclusions
 * to decide whether a prop comes from a "bulk" source (node_modules/.d.ts).
 *
 * When a prop has multiple declarations (e.g. user re-declares `aria-label` in
 * their own interface AND it exists in React's HTMLAttributes), we check ALL
 * declarations. If ANY declaration is in user code (not node_modules, not .d.ts),
 * we return that user-code path so the prop is NOT bulk-excluded.
 */
function getPropSourceFile(prop: ts.Symbol): string | undefined {
  const declarations = prop.getDeclarations();
  if (!declarations?.length) return undefined;

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
  if (!declarations?.length) return undefined;

  // Walk up the AST from the property's parent to find the enclosing named type.
  // Props declared in type literals inside intersections (e.g. `type T = { prop: X } & Base`)
  // have the chain: PropertySignature → TypeLiteralNode → IntersectionTypeNode → TypeAliasDeclaration
  let node: ts.Node | undefined = declarations[0].parent;
  while (node) {
    if (
      typescript.isInterfaceDeclaration(node) ||
      typescript.isTypeAliasDeclaration(node)
    ) {
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
  if (!declarations?.length) return undefined;

  const parents: ParentType[] = [];

  for (const declaration of declarations) {
    const { parent } = declaration;
    if (!parent) continue;

    if (
      typescript.isInterfaceDeclaration(parent) ||
      typescript.isTypeAliasDeclaration(parent)
    ) {
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

    // For optional props, strip `undefined` from the serialized type.
    // We use checker.typeToString on the FULL union (not individual members) to
    // preserve TS's own simplifications — e.g. TS represents `boolean` internally
    // as `false | true`, but typeToString correctly prints "boolean".
    // We only enter this branch when we confirmed undefined members exist.
    if (!isRequired && nonUndefinedTypes.length < type.types.length) {
      const fullString = checker.typeToString(type);
      const stripped = fullString
        .replace(/\s*\|\s*undefined\b/g, '')
        .replace(/^undefined\b\s*\|\s*/, '')
        .trim();
      return { name: stripped || 'undefined' };
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
 * Unwraps wrapper calls (React.forwardRef, React.memo, etc.) to find
 * the underlying function expression or declaration.
 */
function unwrapToFunction(
  typescript: typeof ts,
  node: ts.Node,
  depth = 0,
  checker?: ts.TypeChecker
): ts.FunctionLikeDeclaration | undefined {
  if (depth > 5) return undefined;

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
      if (fn) return fn;
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
        symbol.flags & typescript.SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol;
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
 * For identifiers like `DEFAULT_SIZE` pointing to `const DEFAULT_SIZE = 'md'`,
 * follows the reference chain and returns `'md'` (the literal value).
 * Handles variable declarations, imports, enum members, and property accesses.
 * Falls back to `.getText()` for unresolvable expressions.
 */
function resolveLiteralValue(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  node: ts.Expression,
  depth = 0
): string {
  if (depth > 5) return node.getText();

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
    if (node.text === 'undefined') return 'undefined';

    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) return node.getText();

    const resolved =
      symbol.flags & typescript.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;

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
 * For `{ size = 'md', icon: Icon = DefaultIcon }`, adds:
 *   'size' → "'md'", 'icon' → 'DefaultIcon'
 *
 * When a checker is provided, identifiers like `DEFAULT_SIZE` are resolved
 * to their literal values (e.g. `'md'`).
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

/**
 * Extracts destructuring default values from the component function.
 *
 * Handles two patterns:
 *
 * 1. **Parameter destructuring**: `({ size = 'md' }: Props) => ...`
 * 2. **Body destructuring**: `(props) => { const { size = 'md' } = props; ... }`
 *    Also handles `const { size = 'md' } = resolveProps(props, ...)` and similar.
 *
 * Returns Map { 'size' => "'md'" }.
 * For class components or non-destructured params, returns an empty map.
 */
function extractDestructuringDefaults(
  typescript: typeof ts,
  resolved: ts.Symbol,
  checker?: ts.TypeChecker
): Map<string, string> {
  const defaults = new Map<string, string>();
  const decl = resolved.valueDeclaration;
  if (!decl) return defaults;

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

  if (!fn) return defaults;

  // Get the first parameter (props)
  const firstParam = fn.parameters[0];
  if (!firstParam) return defaults;

  // Case 1: Parameter-level destructuring — ({ size = 'md' }: Props) => ...
  if (typescript.isObjectBindingPattern(firstParam.name)) {
    collectBindingDefaults(typescript, firstParam.name, defaults, checker);
    return defaults;
  }

  // Case 2: Body-level destructuring — (props) => { const { size = 'md' } = props; }
  // Also handles: const { size = 'md' } = resolveProps(props, ...)
  if (fn.body) {
    const body = typescript.isBlock(fn.body) ? fn.body : undefined;
    if (body) {
      for (const stmt of body.statements) {
        if (!typescript.isVariableStatement(stmt)) continue;
        for (const varDecl of stmt.declarationList.declarations) {
          if (typescript.isObjectBindingPattern(varDecl.name) && varDecl.initializer) {
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
 * Used for `defaultProps = { size: 'md', disabled: false }` patterns.
 * Handles PropertyAssignment and ShorthandPropertyAssignment.
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
 * Extracts default values from `Component.defaultProps = {...}` and
 * `static defaultProps = {...}` patterns.
 *
 * This is a legacy React pattern (deprecated in React 19) but still used
 * in many codebases. Lower priority than destructuring defaults.
 */
function extractStaticDefaultProps(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  resolved: ts.Symbol
): Map<string, string> {
  const defaults = new Map<string, string>();

  const decl = resolved.valueDeclaration ?? resolved.getDeclarations()?.[0];
  if (!decl) return defaults;
  const componentSourceFile = decl.getSourceFile();

  for (const stmt of componentSourceFile.statements) {
    // Pattern 1: Class with static defaultProps = { size: 'md' }
    if (typescript.isClassDeclaration(stmt) && stmt.name) {
      const classSymbol = checker.getSymbolAtLocation(stmt.name);
      if (classSymbol !== resolved) continue;

      for (const member of stmt.members) {
        if (!typescript.isPropertyDeclaration(member)) continue;
        if (!member.name || member.name.getText() !== 'defaultProps') continue;
        if (!member.initializer) continue;

        let initializer: ts.Expression = member.initializer;
        // Follow identifier reference: static defaultProps = myDefaults
        if (typescript.isIdentifier(initializer)) {
          const sym = checker.getSymbolAtLocation(initializer);
          const symDecl = sym?.valueDeclaration;
          if (
            symDecl &&
            typescript.isVariableDeclaration(symDecl) &&
            symDecl.initializer
          ) {
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
      if (!typescript.isPropertyAccessExpression(left)) continue;
      if (left.name.text !== 'defaultProps') continue;

      // Check if the expression target is our component
      const targetSymbol = checker.getSymbolAtLocation(left.expression);
      if (!targetSymbol) continue;

      const targetResolved =
        targetSymbol.flags & typescript.SymbolFlags.Alias
          ? checker.getAliasedSymbol(targetSymbol)
          : targetSymbol;

      if (targetResolved !== resolved) continue;

      let right: ts.Expression = stmt.expression.right;
      // Follow identifier reference: Button.defaultProps = myDefaults
      if (typescript.isIdentifier(right)) {
        const sym = checker.getSymbolAtLocation(right);
        const symDecl = sym?.valueDeclaration;
        if (
          symDecl &&
          typescript.isVariableDeclaration(symDecl) &&
          symDecl.initializer
        ) {
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

/**
 * Extracts a default value from JSDoc @default / @defaultValue tags on a prop's declaration.
 */
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
 * Identifies properties from declaration files or node_modules interfaces
 * with more than LARGE_SOURCE_THRESHOLD properties (e.g. HTMLAttributes,
 * Panda CSS styled-system types). These are filtered to keep the manifest
 * focused on user-defined props.
 *
 * Checks both `node_modules` paths AND `.d.ts` files. The `.d.ts` check
 * catches generated type systems like Panda CSS's `styled-system/` that
 * live outside node_modules but still inject hundreds of CSS properties.
 * Project-local `.d.ts` with fewer than 30 props per file are unaffected.
 */
function getBulkSourceExclusions(properties: ts.Symbol[]): Set<string> {
  const sourceCount = new Map<string, number>();

  for (const prop of properties) {
    const source = getPropSourceFile(prop);
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
    const source = getPropSourceFile(prop);
    if (source && bulkSources.has(source)) {
      excluded.add(prop.getName());
    }
  }

  return excluded;
}

// ---------------------------------------------------------------------------
// Display name computation
// ---------------------------------------------------------------------------

function computeDisplayName(
  exportSymbol: ts.Symbol,
  resolvedSymbol: ts.Symbol,
  sourceFile: ts.SourceFile
): string {
  const exportName = exportSymbol.getName();

  if (exportName === 'default') {
    const resolvedName = resolvedSymbol.getName();
    if (resolvedName && resolvedName !== 'default' && resolvedName !== '__function') {
      return resolvedName;
    }
    const fileName = sourceFile.fileName;
    const parts = fileName.split('/');
    let base = (parts.pop() ?? fileName).replace(/\.(tsx?|jsx?)$/, '');
    // For barrel files (index.ts), use the parent directory name instead
    if (base === 'index') {
      base = parts.pop() ?? base;
    }
    return base;
  }

  return exportName;
}

// ---------------------------------------------------------------------------
// Extract docs from probe results (shared between standalone + LS)
// ---------------------------------------------------------------------------

/**
 * Builds ComponentDoc array from resolved probe types.
 *
 * Given a checker that has both the original file and probe types resolved,
 * this iterates the original file's exports, matches them against the
 * `propsTypes` map, and serializes each component's props.
 *
 * Used by both the standalone `extractComponentDocs` (with a one-shot probe
 * program) and the LanguageService-based `PropExtractionProject` (with a
 * persistent LS program).
 */
export function extractFromProbe(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  filePath: string,
  sourceFile: ts.SourceFile,
  propsTypes: Map<string, ts.Type>,
  /** When the sourceFile is a .d.ts, provide the original .tsx path for defaults extraction. */
  defaultsSourcePath?: string
): ComponentDoc[] {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return [];

  const fileExports = checker.getExportsOfModule(moduleSymbol);
  const results: ComponentDoc[] = [];

  for (const exp of fileExports) {
    const exportName = exp.getName();
    const propsType = propsTypes.get(exportName);
    if (!propsType) continue;

    const resolved =
      exp.flags & typescript.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exp)
        : exp;

    const allProperties = propsType.getApparentProperties();
    const excluded = getBulkSourceExclusions(allProperties);

    const contextNode = resolved.valueDeclaration ?? resolved.getDeclarations()?.[0];
    if (!contextNode) continue;

    // Collect defaults: destructuring > defaultProps > JSDoc (in extractPropItem)
    const defaultsMap = extractDestructuringDefaults(typescript, resolved, checker);

    // Fallback: when the symbol resolves to a .d.ts file (e.g. package imports in
    // monorepos), .d.ts declarations have no function bodies so extractDestructuringDefaults
    // returns empty. Use the original source file for AST-only defaults extraction.
    if (defaultsMap.size === 0 && defaultsSourcePath) {
      const fallbackDefaults = extractDefaultsFromSourceFile(
        typescript,
        defaultsSourcePath,
        exportName
      );
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
      if (excluded.has(prop.getName())) continue;
      props[prop.getName()] = extractPropItem(typescript, checker, prop, contextNode, defaultsMap);
    }

    const displayName = computeDisplayName(exp, resolved, sourceFile);

    const description = typescript.displayPartsToString(
      resolved.getDocumentationComment(checker)
    );

    results.push({
      displayName,
      exportName,
      filePath,
      description,
      props,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// AST-only defaults extraction from source files
// ---------------------------------------------------------------------------

/**
 * Extracts destructuring defaults from a source file using pure AST walking.
 *
 * Used as a fallback when the primary file is a `.d.ts` (e.g. package imports
 * in monorepos) where function bodies are stripped. Reads the original source
 * file, finds the exported function matching `exportName`, and collects
 * defaults from its parameter destructuring.
 *
 * Works without a TypeChecker — only string literal, numeric, boolean, null,
 * and undefined defaults are extracted. Identifier references (e.g. `noop`,
 * `DEFAULT_SIZE`) are included as-is.
 */
function extractDefaultsFromSourceFile(
  typescript: typeof ts,
  filePath: string,
  exportName: string
): Map<string, string> {
  const defaults = new Map<string, string>();

  const content = typescript.sys.readFile(filePath);
  if (!content) return defaults;

  const sf = typescript.createSourceFile(
    filePath,
    content,
    typescript.ScriptTarget.Latest,
    /* setParentNodes */ true
  );

  // Build a map of top-level variable names → initializer nodes.
  // This lets us follow references like: export const Stack = Object.assign(StackImpl, ...)
  // where StackImpl is defined as: const StackImpl = forwardRef(...)
  const varMap = new Map<string, ts.Expression>();
  for (const stmt of sf.statements) {
    if (typescript.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (typescript.isIdentifier(decl.name) && decl.initializer) {
          varMap.set(decl.name.text, decl.initializer);
        }
      }
    }
    if (typescript.isFunctionDeclaration(stmt) && stmt.name) {
      varMap.set(stmt.name.text, stmt as unknown as ts.Expression);
    }
  }

  // Find the target: the function associated with the exported symbol.
  // For "default" export, look at export default ... or export { X as default }.
  // For named exports, look at export const X = ... or export { X }.
  const fn = findExportedFunction(typescript, sf, exportName, varMap);
  if (!fn) return defaults;

  // Extract destructuring defaults from the first parameter
  const firstParam = fn.parameters[0];
  if (!firstParam) return defaults;

  if (typescript.isObjectBindingPattern(firstParam.name)) {
    collectBindingDefaults(typescript, firstParam.name, defaults);
  } else if (fn.body) {
    // Body destructuring: (props) => { const { x = 1 } = props; }
    const body = typescript.isBlock(fn.body) ? fn.body : undefined;
    if (body) {
      for (const stmt of body.statements) {
        if (!typescript.isVariableStatement(stmt)) continue;
        for (const varDecl of stmt.declarationList.declarations) {
          if (typescript.isObjectBindingPattern(varDecl.name) && varDecl.initializer) {
            collectBindingDefaults(typescript, varDecl.name, defaults);
          }
        }
      }
    }
  }

  return defaults;
}

/**
 * Finds the function-like declaration for a given export name in the source file.
 * Pure AST — follows Object.assign, forwardRef, memo, as-casts, and identifier refs.
 */
function findExportedFunction(
  typescript: typeof ts,
  sf: ts.SourceFile,
  exportName: string,
  varMap: Map<string, ts.Expression>
): ts.FunctionLikeDeclaration | undefined {
  let targetExpr: ts.Expression | undefined;

  for (const stmt of sf.statements) {
    // export default X
    if (
      exportName === 'default' &&
      typescript.isExportAssignment(stmt) &&
      !stmt.isExportEquals
    ) {
      targetExpr = stmt.expression;
      break;
    }

    // export const X = ... or export function X
    if (typescript.isVariableStatement(stmt) && hasExportModifier(typescript, stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (typescript.isIdentifier(decl.name) && decl.name.text === exportName && decl.initializer) {
          targetExpr = decl.initializer;
          break;
        }
      }
      if (targetExpr) break;
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
    if (typescript.isExportDeclaration(stmt) && stmt.exportClause && typescript.isNamedExports(stmt.exportClause)) {
      for (const spec of stmt.exportClause.elements) {
        const exported = spec.name.text;
        const local = spec.propertyName ? spec.propertyName.text : spec.name.text;
        if (exported === exportName) {
          targetExpr = varMap.get(local) as ts.Expression | undefined;
          break;
        }
      }
      if (targetExpr) break;
    }
  }

  if (!targetExpr) {
    // Not explicitly exported — might be via barrel: import { X } from './...'
    // Try to find a top-level variable matching the export name
    targetExpr = varMap.get(exportName) as ts.Expression | undefined;
  }

  if (!targetExpr) return undefined;

  return unwrapToFunctionAST(typescript, targetExpr, varMap, 0);
}

/**
 * Pure AST version of unwrapToFunction. Follows forwardRef, memo, Object.assign,
 * as-casts, parenthesized expressions, and identifier references via varMap.
 */
function unwrapToFunctionAST(
  typescript: typeof ts,
  node: ts.Node,
  varMap: Map<string, ts.Expression>,
  depth: number
): ts.FunctionLikeDeclaration | undefined {
  if (depth > 10) return undefined;

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
  if (typescript.isTypeAssertionExpression?.(node)) {
    return unwrapToFunctionAST(typescript, (node as any).expression, varMap, depth + 1);
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

/**
 * Finds the implementation body for an overloaded function declaration.
 */
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
    typescript.getModifiers(node)?.some((m) => m.kind === typescript.SyntaxKind.ExportKeyword) === true
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Extracts component documentation from a TypeScript source file.
 *
 * Uses React's own JSX type system: an export is a component if and only if
 * `typeof X extends JSXElementConstructor<any>`. Props are extracted via
 * `ComponentProps<typeof X>`. Both checks happen in a single virtual probe
 * file that TypeScript's checker evaluates.
 *
 * @param typescript - The TypeScript module (passed to avoid top-level import)
 * @param filePath - Absolute path to the source file
 * @param program - The TypeScript program containing the file
 * @returns Array of ComponentDoc for each detected component export
 */
export function extractComponentDocs(
  typescript: typeof ts,
  filePath: string,
  program: ts.Program
): ComponentDoc[] {
  const candidates = getCandidates(typescript, program, filePath);
  if (candidates.length === 0) return [];

  // Let React's type system decide which exports are components
  const probe = detectComponents(typescript, filePath, candidates, program);
  if (!probe) return [];

  const { propsTypes, probeChecker, probeProgram } = probe;

  const probeSourceFile = probeProgram.getSourceFile(filePath);
  if (!probeSourceFile) return [];

  return extractFromProbe(typescript, probeChecker, filePath, probeSourceFile, propsTypes);
}
