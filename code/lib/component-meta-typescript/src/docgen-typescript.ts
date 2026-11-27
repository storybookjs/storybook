import type ts from 'typescript';

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

export type DocgenSystem = Pick<
  ts.System,
  'directoryExists' | 'fileExists' | 'readFile' | 'useCaseSensitiveFileNames'
>;

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

export type DocgenNodeRewriter = (
  node: ts.Node,
  visitChildren: (node: ts.Node) => ts.Node
) => ts.Node;

export type DocgenNodeGuards = Pick<typeof ts, (typeof DOCGEN_NODE_GUARDS)[number]>;

export interface DocgenTypeScript extends DocgenNodeGuards {
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
  createSourceFile(fileName: string, text: string): ts.SourceFile;
  displayPartsToString: typeof ts.displayPartsToString;
  forEachChild: typeof ts.forEachChild;
  getDecorators: typeof ts.getDecorators;
  getEmptyObjectType(checker: DocgenTypeChecker): ts.Type;
  getJSDocCommentsAndTags(node: ts.Node): readonly (ts.JSDoc | ts.JSDocTag)[];
  getJSDocTags: typeof ts.getJSDocTags;
  getLineAndCharacterOfPosition: typeof ts.getLineAndCharacterOfPosition;
  getModifiers: typeof ts.getModifiers;
  printNode(node: ts.Node, visit: DocgenNodeRewriter): string;

  getTypeParameterDefault(node: ts.TypeParameterDeclaration): ts.TypeNode | undefined;
  hasQuestionToken(member: ts.ClassElement | ts.TypeElement): boolean;
  getSeeTagReference(tag: ts.JSDocSeeTag): ts.Node | undefined;
  getJSDocStart(jsDoc: ts.JSDoc): number;
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

export function createCompilerDocgenTypeScript(typescript: typeof ts): DocgenTypeScript {
  // The module's members are getters, so the extra members are defined, not assigned.
  const members: Pick<DocgenTypeScript, 'createSourceFile' | 'getEmptyObjectType' | 'printNode'> &
    DocgenNodeAccessors = {
    ...compilerNodeAccessors,
    printNode: (node, visit) => {
      const result = typescript.transform(node, [
        (context) => (root) => {
          const visitChildren = (child: ts.Node): ts.Node =>
            typescript.visitEachChild(
              child,
              (grandchild) => visit(grandchild, visitChildren),
              context
            );
          return visit(root, visitChildren);
        },
      ]);
      try {
        return typescript
          .createPrinter({ removeComments: true })
          .printNode(typescript.EmitHint.Unspecified, result.transformed[0], node.getSourceFile());
      } finally {
        result.dispose();
      }
    },
    createSourceFile: (fileName, text) =>
      typescript.createSourceFile(fileName, text, typescript.ScriptTarget.Latest, true),
    getEmptyObjectType: (checker) =>
      (checker as ts.TypeChecker).getTypeFromTypeNode(typescript.factory.createTypeLiteralNode([])),
  };
  return Object.create(
    typescript,
    Object.fromEntries(Object.entries(members).map(([name, value]) => [name, { value }]))
  );
}
