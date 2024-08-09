import { types } from '@babel/core';
import * as babelParser from '@babel/parser';

import type { Parser, ParserResult } from './types';

/**
 * A generic parser that can parse both ES and CJS modules.
 */
export class GenericParser implements Parser {
  /**
   * Parse the content of a file and return the exports
   * @param content The content of the file
   * @returns The exports of the file
   */
  async parse(content: string): Promise<ParserResult> {
    const ast = babelParser.parse(content, {
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowNewTargetOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowUndeclaredExports: true,
      plugins: [
        // Language features
        'typescript',
        'jsx',
        // Latest ECMAScript features
        'asyncGenerators',
        'bigInt',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'classStaticBlock',
        'dynamicImport',
        'exportNamespaceFrom',
        'logicalAssignment',
        'moduleStringNames',
        'nullishCoalescingOperator',
        'numericSeparator',
        'objectRestSpread',
        'optionalCatchBinding',
        'optionalChaining',
        'privateIn',
        'regexpUnicodeSets',
        'topLevelAwait',
        // ECMAScript proposals
        'asyncDoExpressions',
        'decimal',
        'decorators',
        'decoratorAutoAccessors',
        'deferredImportEvaluation',
        'destructuringPrivate',
        'doExpressions',
        'explicitResourceManagement',
        'exportDefaultFrom',
        'functionBind',
        'functionSent',
        'importAttributes',
        'importReflection',
        'moduleBlocks',
        'partialApplication',
        'recordAndTuple',
        'sourcePhaseImports',
        'throwExpressions',
      ],
    });

    const exports: ParserResult['exports'] = [];

    ast.program.body.forEach(function traverse(node) {
      if (types.isExportNamedDeclaration(node)) {
        // Handles function declarations: `export function a() {}`
        if (
          types.isFunctionDeclaration(node.declaration) &&
          types.isIdentifier(node.declaration.id)
        ) {
          exports.push({
            name: node.declaration.id.name,
            default: false,
          });
        }
        // Handles class declarations: `export class A {}`
        if (types.isClassDeclaration(node.declaration) && types.isIdentifier(node.declaration.id)) {
          exports.push({
            name: node.declaration.id.name,
            default: false,
          });
        }
        // Handles export specifiers: `export { a }`
        if (node.declaration === null && node.specifiers.length > 0) {
          node.specifiers.forEach((specifier) => {
            if (types.isExportSpecifier(specifier) && types.isIdentifier(specifier.exported)) {
              exports.push({
                name: specifier.exported.name,
                default: false,
              });
            }
          });
        }
        if (types.isVariableDeclaration(node.declaration)) {
          node.declaration.declarations.forEach((declaration) => {
            // Handle variable declarators: `export const a = 1;`
            if (types.isVariableDeclarator(declaration) && types.isIdentifier(declaration.id)) {
              exports.push({
                name: declaration.id.name,
                default: false,
              });
            }
          });
        }
      } else if (types.isExportDefaultDeclaration(node)) {
        exports.push({
          name: 'default',
          default: true,
        });
      }
    });

    return { exports };
  }
}
