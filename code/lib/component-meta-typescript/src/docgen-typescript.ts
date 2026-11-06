// The part of TypeScript that component-meta docgen uses, as a structural contract.
//
// React's extractor and Angular's analyzer are written against the compiler API's shapes
// (`ts.Node`, `ts.Type`, `ts.Symbol`, `ts.Signature`), but they only touch the members listed here.
// The compiler backend passes the `typescript` module itself; the native backend (TypeScript 7.1
// and newer) passes a facade over `typescript/sync` and `typescript/ast` whose checker, symbols,
// types and signatures have the same members. AST nodes are each backend's own: the fields that
// differ between them are read through the node accessors below, never directly, so each
// TypeScript's code path stays in its backend. Adding a member here is the only way to use more of
// TypeScript in docgen, so both backends stay complete.
import type ts from 'typescript';

// The `ts.TypeChecker` methods docgen calls. `ts.Symbol`'s own methods take a `ts.TypeChecker`, so
// docgen casts the checker where it passes it to a symbol; both backends' symbols accept their own
// checker there.
export type DocgenTypeChecker = Pick<
  ts.TypeChecker,
  | 'getAliasedSymbol'
  | 'getBaseTypeOfLiteralType'
  | 'getBaseTypes'
  | 'getDeclaredTypeOfSymbol'
  | 'getExportsOfModule'
  | 'getMergedSymbol'
  | 'getPropertyOfType'
  | 'getResolvedSignature'
  | 'getShorthandAssignmentValueSymbol'
  | 'getSignatureFromDeclaration'
  | 'getSymbolAtLocation'
  | 'getTypeArguments'
  | 'getTypeAtLocation'
  | 'getTypeOfSymbol'
  | 'getTypeOfSymbolAtLocation'
  | 'getVoidType'
  | 'resolveName'
  | 'typeToString'
>;

// The `ts.System` members docgen and the projects use.
export type DocgenSystem = Pick<
  ts.System,
  'directoryExists' | 'fileExists' | 'readFile' | 'useCaseSensitiveFileNames'
>;

// The node type guards docgen calls.
export const DOCGEN_NODE_GUARDS = [
  'isArrayLiteralExpression',
  'isArrayTypeNode',
  'isArrowFunction',
  'isAsExpression',
  'isAwaitExpression',
  'isBigIntLiteral',
  'isBinaryExpression',
  'isBindingElement',
  'isBlock',
  'isCallExpression',
  'isClassDeclaration',
  'isClassLike',
  'isComputedPropertyName',
  'isConditionalExpression',
  'isConstructorDeclaration',
  'isConstructorTypeNode',
  'isEnumDeclaration',
  'isEnumMember',
  'isExportAssignment',
  'isExportDeclaration',
  'isExpressionStatement',
  'isExpressionWithTypeArguments',
  'isFunctionDeclaration',
  'isFunctionExpression',
  'isFunctionTypeNode',
  'isGetAccessor',
  'isGetAccessorDeclaration',
  'isIdentifier',
  'isImportDeclaration',
  'isImportSpecifier',
  'isIndexedAccessTypeNode',
  'isInterfaceDeclaration',
  'isIntersectionTypeNode',
  'isJSDoc',
  'isJSDocSeeTag',
  'isJsxOpeningElement',
  'isJsxSelfClosingElement',
  'isLiteralTypeNode',
  'isMethodDeclaration',
  'isNamedExports',
  'isNamedImports',
  'isNamespaceImport',
  'isNewExpression',
  'isNoSubstitutionTemplateLiteral',
  'isNonNullExpression',
  'isNumericLiteral',
  'isObjectBindingPattern',
  'isObjectLiteralExpression',
  'isOmittedExpression',
  'isParameter',
  'isParenthesizedExpression',
  'isParenthesizedTypeNode',
  'isPrefixUnaryExpression',
  'isPropertyAccessExpression',
  'isPropertyAssignment',
  'isPropertyDeclaration',
  'isPropertySignature',
  'isQualifiedName',
  'isSatisfiesExpression',
  'isSetAccessor',
  'isSetAccessorDeclaration',
  'isShorthandPropertyAssignment',
  'isSourceFile',
  'isSpreadAssignment',
  'isSpreadElement',
  'isStringLiteral',
  'isStringLiteralLike',
  'isTupleTypeNode',
  'isTypeAliasDeclaration',
  'isTypeAssertionExpression',
  'isTypeLiteralNode',
  'isTypeOperatorNode',
  'isTypeParameterDeclaration',
  'isTypeReferenceNode',
  'isUnionTypeNode',
  'isVariableDeclaration',
  'isVariableStatement',
] as const;

export type DocgenNodeGuards = Pick<typeof ts, (typeof DOCGEN_NODE_GUARDS)[number]>;

// The `typescript` module members docgen and the projects use.
export interface DocgenTypeScript extends DocgenNodeGuards {
  readonly EmitHint: Pick<typeof ts.EmitHint, 'Unspecified'>;
  readonly JsxEmit: Pick<typeof ts.JsxEmit, 'ReactJSX'>;
  readonly ModuleKind: Pick<typeof ts.ModuleKind, 'ESNext'>;
  readonly ModuleResolutionKind: Pick<typeof ts.ModuleResolutionKind, 'Bundler'>;
  readonly ObjectFlags: Pick<typeof ts.ObjectFlags, 'Reference'>;
  readonly ScriptTarget: Pick<typeof ts.ScriptTarget, 'Latest'>;
  readonly SymbolFlags: Pick<
    typeof ts.SymbolFlags,
    'Alias' | 'All' | 'EnumMember' | 'Optional' | 'Property'
  >;
  readonly SyntaxKind: Pick<
    typeof ts.SyntaxKind,
    | 'AmpersandAmpersandToken'
    | 'AnyKeyword'
    | 'BarBarToken'
    | 'DeclareKeyword'
    | 'DefaultKeyword'
    | 'EqualsToken'
    | 'ExportKeyword'
    | 'ExtendsKeyword'
    | 'FalseKeyword'
    | 'KeyOfKeyword'
    | 'MinusToken'
    | 'NullKeyword'
    | 'PlusToken'
    | 'PrivateKeyword'
    | 'ProtectedKeyword'
    | 'PublicKeyword'
    | 'QuestionQuestionToken'
    | 'QuestionToken'
    | 'ReadonlyKeyword'
    | 'StaticKeyword'
    | 'TrueKeyword'
    | 'UndefinedKeyword'
    | 'UnknownKeyword'
  >;
  readonly TypeFlags: Pick<
    typeof ts.TypeFlags,
    | 'Any'
    | 'BooleanLiteral'
    | 'EnumLiteral'
    | 'Never'
    | 'Null'
    | 'NumberLiteral'
    | 'Object'
    | 'StringLiteral'
    | 'TypeParameter'
    | 'Undefined'
    | 'Unknown'
  >;
  readonly TypeFormatFlags: Pick<typeof ts.TypeFormatFlags, 'InTypeAlias' | 'NoTruncation'>;
  readonly factory: Pick<ts.NodeFactory, 'createLiteralTypeNode' | 'createStringLiteral'>;
  readonly sys: DocgenSystem;
  canHaveDecorators: typeof ts.canHaveDecorators;
  canHaveModifiers: typeof ts.canHaveModifiers;
  createPrinter(options: Pick<ts.PrinterOptions, 'removeComments'>): Pick<ts.Printer, 'printNode'>;
  // Parse a file outside the program, to read default values from the component source.
  createSourceFile(fileName: string, text: string): ts.SourceFile;
  displayPartsToString: typeof ts.displayPartsToString;
  forEachChild: typeof ts.forEachChild;
  getDecorators: typeof ts.getDecorators;
  // The type of `{}`, for a component whose call signature takes no props.
  getEmptyObjectType(checker: DocgenTypeChecker): ts.Type;
  getJSDocCommentsAndTags(node: ts.Node): readonly (ts.JSDoc | ts.JSDocTag)[];
  getJSDocTags: typeof ts.getJSDocTags;
  getLineAndCharacterOfPosition: typeof ts.getLineAndCharacterOfPosition;
  getModifiers: typeof ts.getModifiers;
  transform: typeof ts.transform;
  visitEachChild: typeof ts.visitEachChild;
  visitNode: typeof ts.visitNode;

  // Node accessors, for the fields TypeScript 7.1 renamed or positions it reports differently.
  // The default of a type parameter, such as `T = string`.
  getTypeParameterDefault(node: ts.TypeParameterDeclaration): ts.TypeNode | undefined;
  // Whether a class or type member is optional (`name?: T`).
  hasQuestionToken(member: ts.ClassElement | ts.TypeElement): boolean;
  // What a `@see` tag refers to, such as `Button` in `@see Button`.
  getSeeTagReference(tag: ts.JSDocSeeTag): ts.Node | undefined;
  // The position of a JSDoc comment's opening `/**`.
  getJSDocStart(jsDoc: ts.JSDoc): number;
  // The position where the comment text of a JSDoc tag that has one starts, after the tag's own
  // parts.
  getJSDocTagCommentStart(tag: ts.JSDocTag): number;
}

export type DocgenNodeAccessors = Pick<
  DocgenTypeScript,
  | 'getJSDocStart'
  | 'getJSDocTagCommentStart'
  | 'getSeeTagReference'
  | 'getTypeParameterDefault'
  | 'hasQuestionToken'
>;

const compilerNodeAccessors: DocgenNodeAccessors = {
  getTypeParameterDefault: (node) => node.default,
  hasQuestionToken: (member) => 'questionToken' in member && member.questionToken !== undefined,
  getSeeTagReference: (tag) => tag.name,
  getJSDocStart: (jsDoc) => jsDoc.pos,
  getJSDocTagCommentStart: (tag) =>
    (typeof tag.comment === 'string' ? tag.getChildren().at(-1)?.end : tag.comment?.pos) ??
    tag.tagName.end,
};

// Wrap the `typescript` module (TypeScript 5.9 and 6) as the extractor's contract.
//
// The module is the prototype, so every member resolves to the real implementation; only the
// members the compiler API has no direct equivalent for are added.
export function createCompilerDocgenTypeScript(typescript: typeof ts): DocgenTypeScript {
  // The module's members are getters, so the extra members are defined, not assigned.
  const members: Pick<DocgenTypeScript, 'createSourceFile' | 'getEmptyObjectType'> &
    DocgenNodeAccessors = {
    ...compilerNodeAccessors,
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
