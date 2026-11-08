import type { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/types';
import type { TSESLint } from '@typescript-eslint/utils';

export const findVariable = (scope: TSESLint.Scope.Scope, name: string) => {
  for (let current: TSESLint.Scope.Scope | null = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) {
      return variable;
    }
  }
  return null;
};

const isNodeOfType =
  <NodeType extends AST_NODE_TYPES>(nodeType: NodeType) =>
  (node: TSESTree.Node | null | undefined): node is TSESTree.Node & { type: NodeType } =>
    node?.type === nodeType;

export const isAwaitExpression = isNodeOfType('AwaitExpression' as AST_NODE_TYPES.AwaitExpression);
export const isIdentifier = isNodeOfType('Identifier' as AST_NODE_TYPES.Identifier);
export const isVariableDeclarator = isNodeOfType(
  'VariableDeclarator' as AST_NODE_TYPES.VariableDeclarator
);

export const isArrayExpression = isNodeOfType('ArrayExpression' as AST_NODE_TYPES.ArrayExpression);
export const isArrowFunctionExpression = isNodeOfType(
  'ArrowFunctionExpression' as AST_NODE_TYPES.ArrowFunctionExpression
);
export const isBlockStatement = isNodeOfType('BlockStatement' as AST_NODE_TYPES.BlockStatement);
export const isCallExpression = isNodeOfType('CallExpression' as AST_NODE_TYPES.CallExpression);
export const isExpressionStatement = isNodeOfType(
  'ExpressionStatement' as AST_NODE_TYPES.ExpressionStatement
);
export const isVariableDeclaration = isNodeOfType(
  'VariableDeclaration' as AST_NODE_TYPES.VariableDeclaration
);
export const isAssignmentExpression = isNodeOfType(
  'AssignmentExpression' as AST_NODE_TYPES.AssignmentExpression
);
export const isSequenceExpression = isNodeOfType(
  'SequenceExpression' as AST_NODE_TYPES.SequenceExpression
);
export const isImportDeclaration = isNodeOfType(
  'ImportDeclaration' as AST_NODE_TYPES.ImportDeclaration
);
export const isImportDefaultSpecifier = isNodeOfType(
  'ImportDefaultSpecifier' as AST_NODE_TYPES.ImportDefaultSpecifier
);
export const isImportNamespaceSpecifier = isNodeOfType(
  'ImportNamespaceSpecifier' as AST_NODE_TYPES.ImportNamespaceSpecifier
);
export const isImportSpecifier = isNodeOfType('ImportSpecifier' as AST_NODE_TYPES.ImportSpecifier);
export const isJSXAttribute = isNodeOfType('JSXAttribute' as AST_NODE_TYPES.JSXAttribute);
export const isLiteral = isNodeOfType('Literal' as AST_NODE_TYPES.Literal);
export const isMemberExpression = isNodeOfType(
  'MemberExpression' as AST_NODE_TYPES.MemberExpression
);
export const isNewExpression = isNodeOfType('NewExpression' as AST_NODE_TYPES.NewExpression);
export const isObjectExpression = isNodeOfType(
  'ObjectExpression' as AST_NODE_TYPES.ObjectExpression
);
export const isObjectPattern = isNodeOfType('ObjectPattern' as AST_NODE_TYPES.ObjectPattern);
export const isProperty = isNodeOfType('Property' as AST_NODE_TYPES.Property);
export const isSpreadElement = isNodeOfType('SpreadElement' as AST_NODE_TYPES.SpreadElement);
export const isRestElement = isNodeOfType('RestElement' as AST_NODE_TYPES.RestElement);
export const isReturnStatement = isNodeOfType('ReturnStatement' as AST_NODE_TYPES.ReturnStatement);
export const isFunctionDeclaration = isNodeOfType(
  'FunctionDeclaration' as AST_NODE_TYPES.FunctionDeclaration
);
export const isFunctionExpression = isNodeOfType(
  'FunctionExpression' as AST_NODE_TYPES.FunctionExpression
);
export const isProgram = isNodeOfType('Program' as AST_NODE_TYPES.Program);
export const isTSTypeAliasDeclaration = isNodeOfType(
  'TSTypeAliasDeclaration' as AST_NODE_TYPES.TSTypeAliasDeclaration
);
export const isTSInterfaceDeclaration = isNodeOfType(
  'TSInterfaceDeclaration' as AST_NODE_TYPES.TSInterfaceDeclaration
);
export const isTSAsExpression = isNodeOfType('TSAsExpression' as AST_NODE_TYPES.TSAsExpression);
export const isTSSatisfiesExpression = isNodeOfType(
  'TSSatisfiesExpression' as AST_NODE_TYPES.TSSatisfiesExpression
);
export const isTSNonNullExpression = isNodeOfType(
  'TSNonNullExpression' as AST_NODE_TYPES.TSNonNullExpression
);
export const isTSTypeAssertion = isNodeOfType('TSTypeAssertion' as AST_NODE_TYPES.TSTypeAssertion);
export const isMetaProperty = isNodeOfType('MetaProperty' as AST_NODE_TYPES.MetaProperty);
