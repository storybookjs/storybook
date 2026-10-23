/**
 * The part of TypeScript that React's component-meta extraction uses, as a structural contract.
 *
 * The extractor is written against the compiler API's shapes (`ts.Node`, `ts.Type`, `ts.Symbol`,
 * `ts.Signature`), but it only touches the members listed here. The compiler backend passes the
 * `typescript` module itself; the native backend (TypeScript 7.1 and newer) passes a facade over
 * `typescript/sync` and `typescript/ast` whose objects have the same members. Adding a member here
 * is the only way to use more of TypeScript in the extractor, so both backends stay complete.
 */
import type ts from 'typescript';

/**
 * The `ts.TypeChecker` methods the extractor calls. `ts.Symbol`'s own methods take a `ts.TypeChecker`,
 * so the extractor casts the checker where it passes it to a symbol; both backends' symbols accept
 * their own checker there.
 */
export type DocgenTypeChecker = Pick<
  ts.TypeChecker,
  | 'getAliasedSymbol'
  | 'getExportsOfModule'
  | 'getMergedSymbol'
  | 'getPropertyOfType'
  | 'getResolvedSignature'
  | 'getShorthandAssignmentValueSymbol'
  | 'getSymbolAtLocation'
  | 'getTypeAtLocation'
  | 'getTypeOfSymbol'
  | 'getTypeOfSymbolAtLocation'
  | 'getVoidType'
  | 'typeToString'
>;

/** The `ts.System` members the extractor and the project use. */
export type DocgenSystem = Pick<
  ts.System,
  'directoryExists' | 'fileExists' | 'readFile' | 'useCaseSensitiveFileNames'
>;

/** The node type guards the extractor calls. */
export const DOCGEN_NODE_GUARDS = [
  'isArrowFunction',
  'isAsExpression',
  'isAwaitExpression',
  'isBinaryExpression',
  'isBindingElement',
  'isBlock',
  'isCallExpression',
  'isClassDeclaration',
  'isConditionalExpression',
  'isEnumMember',
  'isExportAssignment',
  'isExportDeclaration',
  'isExpressionStatement',
  'isFunctionDeclaration',
  'isFunctionExpression',
  'isIdentifier',
  'isImportDeclaration',
  'isInterfaceDeclaration',
  'isJsxOpeningElement',
  'isJsxSelfClosingElement',
  'isNamedExports',
  'isNamedImports',
  'isNamespaceImport',
  'isNewExpression',
  'isNonNullExpression',
  'isNoSubstitutionTemplateLiteral',
  'isNumericLiteral',
  'isObjectBindingPattern',
  'isObjectLiteralExpression',
  'isParenthesizedExpression',
  'isPropertyAccessExpression',
  'isPropertyAssignment',
  'isPropertyDeclaration',
  'isPropertySignature',
  'isSatisfiesExpression',
  'isShorthandPropertyAssignment',
  'isStringLiteral',
  'isTypeAliasDeclaration',
  'isTypeAssertionExpression',
  'isTypeLiteralNode',
  'isVariableDeclaration',
  'isVariableStatement',
] as const;

export type DocgenNodeGuards = Pick<typeof ts, (typeof DOCGEN_NODE_GUARDS)[number]>;

/** The `typescript` module members the extractor and the project use. */
export interface DocgenTypeScript extends DocgenNodeGuards {
  readonly JsxEmit: Pick<typeof ts.JsxEmit, 'ReactJSX'>;
  readonly ModuleKind: Pick<typeof ts.ModuleKind, 'ESNext'>;
  readonly ModuleResolutionKind: Pick<typeof ts.ModuleResolutionKind, 'Bundler'>;
  readonly ScriptTarget: Pick<typeof ts.ScriptTarget, 'Latest'>;
  readonly SymbolFlags: Pick<typeof ts.SymbolFlags, 'Alias' | 'Optional' | 'Property'>;
  readonly SyntaxKind: Pick<
    typeof ts.SyntaxKind,
    | 'AmpersandAmpersandToken'
    | 'BarBarToken'
    | 'EqualsToken'
    | 'ExportKeyword'
    | 'FalseKeyword'
    | 'NullKeyword'
    | 'QuestionQuestionToken'
    | 'TrueKeyword'
  >;
  readonly TypeFlags: Pick<typeof ts.TypeFlags, 'Any' | 'BooleanLiteral' | 'Never' | 'Undefined'>;
  readonly sys: DocgenSystem;
  canHaveModifiers: typeof ts.canHaveModifiers;
  /** Parse a file outside the program, to read default values from the component source. */
  createSourceFile(fileName: string, text: string): ts.SourceFile;
  displayPartsToString: typeof ts.displayPartsToString;
  forEachChild: typeof ts.forEachChild;
  /** The type of `{}`, for a component whose call signature takes no props. */
  getEmptyObjectType(checker: DocgenTypeChecker): ts.Type;
  getModifiers: typeof ts.getModifiers;
}

/**
 * Wrap the `typescript` module (TypeScript 5.9 and 6) as the extractor's contract.
 *
 * The module is the prototype, so every member resolves to the real implementation; only the
 * members the compiler API has no direct equivalent for are added.
 */
export function createCompilerDocgenTypeScript(typescript: typeof ts): DocgenTypeScript {
  // The module's members are getters, so the extra members are defined, not assigned.
  const members: Pick<DocgenTypeScript, 'createSourceFile' | 'getEmptyObjectType'> = {
    createSourceFile: (fileName, text) =>
      typescript.createSourceFile(
        fileName,
        text,
        typescript.ScriptTarget.Latest,
        /* setParentNodes */ true
      ),
    getEmptyObjectType: (checker) =>
      (checker as ts.TypeChecker).getTypeFromTypeNode(typescript.factory.createTypeLiteralNode([])),
  };
  return Object.create(
    typescript,
    Object.fromEntries(Object.entries(members).map(([name, value]) => [name, { value }]))
  );
}
