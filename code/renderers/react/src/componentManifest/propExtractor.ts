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

function getPropSourceFile(prop: ts.Symbol): string | undefined {
  const declarations = prop.getDeclarations();
  if (!declarations?.length) return undefined;
  return declarations[0].getSourceFile().fileName;
}

function getParentType(typescript: typeof ts, prop: ts.Symbol): ParentType | undefined {
  const declarations = prop.getDeclarations();
  if (!declarations?.length) return undefined;

  const { parent } = declarations[0];
  if (!parent) return undefined;

  if (
    typescript.isInterfaceDeclaration(parent) ||
    typescript.isTypeAliasDeclaration(parent)
  ) {
    return {
      name: parent.name.getText(),
      fileName: parent.getSourceFile().fileName,
    };
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
// Single prop extraction
// ---------------------------------------------------------------------------

function extractPropItem(
  typescript: typeof ts,
  checker: ts.TypeChecker,
  prop: ts.Symbol,
  contextNode: ts.Node
): PropItem {
  const isOptional = !!(prop.flags & typescript.SymbolFlags.Optional);
  const isRequired = !isOptional;

  const propType = checker.getTypeOfSymbolAtLocation(prop, contextNode);
  const type = serializeType(typescript, checker, propType, isRequired);

  const description = typescript.displayPartsToString(prop.getDocumentationComment(checker));

  const parent = getParentType(typescript, prop);
  const declarations = getAllDeclarationParents(typescript, prop);

  return {
    name: prop.getName(),
    required: isRequired,
    type,
    description,
    defaultValue: null,
    parent,
    declarations,
  };
}

// ---------------------------------------------------------------------------
// >30 bulk source filter
// ---------------------------------------------------------------------------

/**
 * Identifies properties from node_modules interfaces with more than
 * LARGE_SOURCE_THRESHOLD properties (e.g. HTMLAttributes). These are
 * filtered to keep the manifest focused on user-defined props.
 *
 * Only `node_modules` paths are checked — NOT `.d.ts` in general.
 * The `.d.ts` check was too broad and accidentally excluded project-local
 * ambient declarations and compiled package output (e.g. Mantine's BoxProps).
 */
function getBulkSourceExclusions(properties: ts.Symbol[]): Set<string> {
  const sourceCount = new Map<string, number>();

  for (const prop of properties) {
    const source = getPropSourceFile(prop);
    if (source && source.includes('node_modules')) {
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
    const base = fileName.split('/').pop() ?? fileName;
    return base.replace(/\.(tsx?|jsx?)$/, '');
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
  propsTypes: Map<string, ts.Type>
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

    const props: Record<string, PropItem> = {};
    for (const prop of allProperties) {
      if (excluded.has(prop.getName())) continue;
      props[prop.getName()] = extractPropItem(typescript, checker, prop, contextNode);
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
