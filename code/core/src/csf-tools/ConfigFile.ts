/* eslint-disable no-underscore-dangle */
import { readFile, writeFile } from 'node:fs/promises';

import bg from '@babel/generator';
import bt from '@babel/traverse';
import * as t from '@babel/types';
import type { Options } from 'recast';
import * as recast from 'recast';
import { dedent } from 'ts-dedent';

import type { PrintResultType } from './PrintResultType';
import { babelParse } from './babelParse';

// @ts-expect-error (needed due to it's use of `exports.default`)
const traverse = (bt.default || bt) as typeof bt;
// @ts-expect-error (needed due to it's use of `exports.default`)
const generate = (bg.default || bg) as typeof bg;

const logger = console;

const getCsfParsingErrorMessage = ({
  expectedType,
  foundType,
  node,
}: {
  expectedType: string;
  foundType: string | undefined;
  node: any | undefined;
}) => {
  let nodeInfo = '';
  if (node) {
    try {
      nodeInfo = JSON.stringify(node);
    } catch (e) {
      //
    }
  }

  return dedent`
      CSF Parsing error: Expected '${expectedType}' but found '${foundType}' instead in '${node?.type}'.
      ${nodeInfo}
    `;
};

const propKey = (p: t.ObjectProperty) => {
  if (t.isIdentifier(p.key)) {
    return p.key.name;
  }

  if (t.isStringLiteral(p.key)) {
    return p.key.value;
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const _getPath = (path: string[], node: t.Node): t.Node | undefined => {
  if (path.length === 0) {
    return node;
  }
  if (t.isObjectExpression(node)) {
    const [first, ...rest] = path;
    const field = (node.properties as t.ObjectProperty[]).find((p) => propKey(p) === first);
    if (field) {
      return _getPath(rest, (field as t.ObjectProperty).value);
    }
  }
  return undefined;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const _getPathProperties = (path: string[], node: t.Node): t.ObjectProperty[] | undefined => {
  if (path.length === 0) {
    if (t.isObjectExpression(node)) {
      return node.properties as t.ObjectProperty[];
    }
    throw new Error('Expected object expression');
  }
  if (t.isObjectExpression(node)) {
    const [first, ...rest] = path;
    const field = (node.properties as t.ObjectProperty[]).find((p) => propKey(p) === first);
    if (field) {
      // FXIME handle spread etc.
      if (rest.length === 0) {
        return node.properties as t.ObjectProperty[];
      }

      return _getPathProperties(rest, (field as t.ObjectProperty).value);
    }
  }
  return undefined;
};
// eslint-disable-next-line @typescript-eslint/naming-convention
const _findVarDeclarator = (
  identifier: string,
  program: t.Program
): t.VariableDeclarator | null | undefined => {
  let declarator: t.VariableDeclarator | null | undefined = null;
  let declarations: t.VariableDeclarator[] | null = null;
  program.body.find((node: t.Node) => {
    if (t.isVariableDeclaration(node)) {
      declarations = node.declarations;
    } else if (t.isExportNamedDeclaration(node) && t.isVariableDeclaration(node.declaration)) {
      declarations = node.declaration.declarations;
    }

    return (
      declarations &&
      declarations.find((decl: t.VariableDeclarator) => {
        if (
          t.isVariableDeclarator(decl) &&
          t.isIdentifier(decl.id) &&
          decl.id.name === identifier
        ) {
          declarator = decl;
          return true; // stop looking
        }
        return false;
      })
    );
  });
  return declarator;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const _findVarInitialization = (identifier: string, program: t.Program) => {
  const declarator = _findVarDeclarator(identifier, program);
  return declarator?.init;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const _makeObjectExpression = (path: string[], value: t.Expression): t.Expression => {
  if (path.length === 0) {
    return value;
  }
  const [first, ...rest] = path;
  const innerExpression = _makeObjectExpression(rest, value);
  return t.objectExpression([t.objectProperty(t.identifier(first), innerExpression)]);
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const _updateExportNode = (path: string[], expr: t.Expression, existing: t.ObjectExpression) => {
  const [first, ...rest] = path;
  const existingField = (existing.properties as t.ObjectProperty[]).find(
    (p) => propKey(p) === first
  ) as t.ObjectProperty;
  if (!existingField) {
    existing.properties.push(
      t.objectProperty(t.identifier(first), _makeObjectExpression(rest, expr))
    );
  } else if (t.isObjectExpression(existingField.value) && rest.length > 0) {
    _updateExportNode(rest, expr, existingField.value);
  } else {
    existingField.value = _makeObjectExpression(rest, expr);
  }
};

export class ConfigFile {
  _ast: t.File;

  _code: string;

  _exports: Record<string, t.Expression> = {};

  // FIXME: this is a hack. this is only used in the case where the user is
  // modifying a named export that's a scalar. The _exports map is not suitable
  // for that. But rather than refactor the whole thing, we just use this as a stopgap.
  _exportDecls: Record<string, t.VariableDeclarator> = {};

  _exportsObject: t.ObjectExpression | undefined;

  _quotes: 'single' | 'double' | undefined;

  fileName?: string;

  hasDefaultExport = false;

  constructor(ast: t.File, code: string, fileName?: string) {
    this._ast = ast;
    this._code = code;
    this.fileName = fileName;
  }

  parse() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    traverse(this._ast, {
      ExportDefaultDeclaration: {
        enter({ node, parent }) {
          self.hasDefaultExport = true;
          let decl =
            t.isIdentifier(node.declaration) && t.isProgram(parent)
              ? _findVarInitialization(node.declaration.name, parent)
              : node.declaration;

          if (t.isTSAsExpression(decl) || t.isTSSatisfiesExpression(decl)) {
            decl = decl.expression;
          }

          if (t.isObjectExpression(decl)) {
            self._exportsObject = decl;
            (decl.properties as t.ObjectProperty[]).forEach((p) => {
              const exportName = propKey(p);
              if (exportName) {
                let exportVal = p.value;
                if (t.isIdentifier(exportVal)) {
                  exportVal = _findVarInitialization(exportVal.name, parent as t.Program) as any;
                }
                self._exports[exportName] = exportVal as t.Expression;
              }
            });
          } else {
            logger.warn(
              getCsfParsingErrorMessage({
                expectedType: 'ObjectExpression',
                foundType: decl?.type,
                node: decl || node.declaration,
              })
            );
          }
        },
      },
      ExportNamedDeclaration: {
        enter({ node, parent }) {
          if (t.isVariableDeclaration(node.declaration)) {
            // export const X = ...;
            node.declaration.declarations.forEach((decl) => {
              if (t.isVariableDeclarator(decl) && t.isIdentifier(decl.id)) {
                const { name: exportName } = decl.id;
                let exportVal = decl.init as t.Expression;
                if (t.isIdentifier(exportVal)) {
                  exportVal = _findVarInitialization(exportVal.name, parent as t.Program) as any;
                }
                self._exports[exportName] = exportVal;
                self._exportDecls[exportName] = decl;
              }
            });
          } else if (node.specifiers) {
            // export { X };
            node.specifiers.forEach((spec) => {
              if (
                t.isExportSpecifier(spec) &&
                t.isIdentifier(spec.local) &&
                t.isIdentifier(spec.exported)
              ) {
                const { name: localName } = spec.local;
                const { name: exportName } = spec.exported;
                const decl = _findVarDeclarator(localName, parent as t.Program) as any;
                self._exports[exportName] = decl.init;
                self._exportDecls[exportName] = decl;
              }
            });
          } else {
            logger.warn(
              getCsfParsingErrorMessage({
                expectedType: 'VariableDeclaration',
                foundType: node.declaration?.type,
                node: node.declaration,
              })
            );
          }
        },
      },
      ExpressionStatement: {
        enter({ node, parent }) {
          if (t.isAssignmentExpression(node.expression) && node.expression.operator === '=') {
            const { left, right } = node.expression;
            if (
              t.isMemberExpression(left) &&
              t.isIdentifier(left.object) &&
              left.object.name === 'module' &&
              t.isIdentifier(left.property) &&
              left.property.name === 'exports'
            ) {
              let exportObject = right;
              if (t.isIdentifier(right)) {
                exportObject = _findVarInitialization(right.name, parent as t.Program) as any;
              }

              if (t.isTSAsExpression(exportObject) || t.isTSSatisfiesExpression(exportObject)) {
                exportObject = exportObject.expression;
              }

              if (t.isObjectExpression(exportObject)) {
                self._exportsObject = exportObject;
                (exportObject.properties as t.ObjectProperty[]).forEach((p) => {
                  const exportName = propKey(p);
                  if (exportName) {
                    let exportVal = p.value as t.Expression;
                    if (t.isIdentifier(exportVal)) {
                      exportVal = _findVarInitialization(
                        exportVal.name,
                        parent as t.Program
                      ) as any;
                    }
                    self._exports[exportName] = exportVal as t.Expression;
                  }
                });
              } else {
                logger.warn(
                  getCsfParsingErrorMessage({
                    expectedType: 'ObjectExpression',
                    foundType: exportObject?.type,
                    node: exportObject,
                  })
                );
              }
            }
          }
        },
      },
    });
    return self;
  }

  getFieldNode(path: string[]) {
    const [root, ...rest] = path;
    const exported = this._exports[root];

    if (!exported) {
      return undefined;
    }
    return _getPath(rest, exported);
  }

  getFieldProperties(path: string[]) {
    const [root, ...rest] = path;
    const exported = this._exports[root];

    if (!exported) {
      return undefined;
    }
    return _getPathProperties(rest, exported);
  }

  getFieldValue<T = any>(path: string[]): T | undefined {
    const node = this.getFieldNode(path);
    if (node) {
      const { code } = generate(node, {});

      const value = (0, eval)(`(() => (${code}))()`);
      return value;
    }
    return undefined;
  }

  getSafeFieldValue(path: string[]) {
    try {
      return this.getFieldValue(path);
    } catch (e) {
      //
    }
    return undefined;
  }

  setFieldNode(path: string[], expr: t.Expression) {
    const [first, ...rest] = path;
    const exportNode = this._exports[first];
    if (this._exportsObject) {
      _updateExportNode(path, expr, this._exportsObject);
      this._exports[path[0]] = expr;
    } else if (exportNode && t.isObjectExpression(exportNode) && rest.length > 0) {
      _updateExportNode(rest, expr, exportNode);
    } else if (exportNode && rest.length === 0 && this._exportDecls[path[0]]) {
      const decl = this._exportDecls[path[0]];
      decl.init = _makeObjectExpression([], expr);
    } else if (this.hasDefaultExport) {
      // This means the main.js of the user has a default export that is not an object expression, therefore we can't change the AST.
      throw new Error(
        `Could not set the "${path.join(
          '.'
        )}" field as the default export is not an object in this file.`
      );
    } else {
      // create a new named export and add it to the top level
      const exportObj = _makeObjectExpression(rest, expr);
      const newExport = t.exportNamedDeclaration(
        t.variableDeclaration('const', [t.variableDeclarator(t.identifier(first), exportObj)])
      );
      this._exports[first] = exportObj;
      this._ast.program.body.push(newExport);
    }
  }

  /**
   * @example
   *
   * ```ts
   * // 1. { framework: 'framework-name' }
   * // 2. { framework: { name: 'framework-name', options: {} }
   * getNameFromPath(['framework']); // => 'framework-name'
   * ```
   *
   * @returns The name of a node in a given path, supporting the following formats:
   */

  getNameFromPath(path: string[]): string | undefined {
    const node = this.getFieldNode(path);
    if (!node) {
      return undefined;
    }

    return this._getPresetValue(node, 'name');
  }

  /**
   * Returns an array of names of a node in a given path, supporting the following formats:
   *
   * @example
   *
   * ```ts
   * const config = {
   *   addons: ['first-addon', { name: 'second-addon', options: {} }],
   * };
   * // => ['first-addon', 'second-addon']
   * getNamesFromPath(['addons']);
   * ```
   */
  getNamesFromPath(path: string[]): string[] | undefined {
    const node = this.getFieldNode(path);
    if (!node) {
      return undefined;
    }

    const pathNames: string[] = [];
    if (t.isArrayExpression(node)) {
      (node.elements as t.Expression[]).forEach((element) => {
        pathNames.push(this._getPresetValue(element, 'name'));
      });
    }

    return pathNames;
  }

  _getPnpWrappedValue(node: t.Node) {
    if (t.isCallExpression(node)) {
      const arg = node.arguments[0];
      if (t.isStringLiteral(arg)) {
        return arg.value;
      }
    }
    return undefined;
  }

  /**
   * Given a node and a fallback property, returns a **non-evaluated** string value of the node.
   *
   * 1. `{ node: 'value' }`
   * 2. `{ node: { fallbackProperty: 'value' } }`
   */
  _getPresetValue(node: t.Node, fallbackProperty: string) {
    let value;
    if (t.isStringLiteral(node)) {
      value = node.value;
    } else if (t.isObjectExpression(node)) {
      node.properties.forEach((prop) => {
        // { framework: { name: 'value' } }
        if (
          t.isObjectProperty(prop) &&
          t.isIdentifier(prop.key) &&
          prop.key.name === fallbackProperty
        ) {
          if (t.isStringLiteral(prop.value)) {
            value = prop.value.value;
          } else {
            value = this._getPnpWrappedValue(prop.value);
          }
        }

        // { "framework": { "name": "value" } }
        if (
          t.isObjectProperty(prop) &&
          t.isStringLiteral(prop.key) &&
          prop.key.value === 'name' &&
          t.isStringLiteral(prop.value)
        ) {
          value = prop.value.value;
        }
      });
    }

    if (!value) {
      throw new Error(
        `The given node must be a string literal or an object expression with a "${fallbackProperty}" property that is a string literal.`
      );
    }

    return value;
  }

  removeField(path: string[]) {
    const removeProperty = (properties: t.ObjectProperty[], prop: string) => {
      const index = properties.findIndex(
        (p) =>
          (t.isIdentifier(p.key) && p.key.name === prop) ||
          (t.isStringLiteral(p.key) && p.key.value === prop)
      );
      if (index >= 0) {
        properties.splice(index, 1);
      }
    };
    // the structure of this._exports doesn't work for this use case
    // so we have to manually bypass it here
    if (path.length === 1) {
      let removedRootProperty = false;
      // removing the root export
      this._ast.program.body.forEach((node) => {
        // named export
        if (t.isExportNamedDeclaration(node) && t.isVariableDeclaration(node.declaration)) {
          const decl = node.declaration.declarations[0];
          if (t.isIdentifier(decl.id) && decl.id.name === path[0]) {
            this._ast.program.body.splice(this._ast.program.body.indexOf(node), 1);
            removedRootProperty = true;
          }
        }
        // default export
        if (t.isExportDefaultDeclaration(node)) {
          let decl: t.Expression | undefined | null = node.declaration as t.Expression;
          if (t.isIdentifier(decl)) {
            decl = _findVarInitialization(decl.name, this._ast.program);
          }
          if (t.isTSAsExpression(decl) || t.isTSSatisfiesExpression(decl)) {
            decl = decl.expression;
          }
          if (t.isObjectExpression(decl)) {
            const properties = decl.properties as t.ObjectProperty[];
            removeProperty(properties, path[0]);
            removedRootProperty = true;
          }
        }
        // module.exports
        if (
          t.isExpressionStatement(node) &&
          t.isAssignmentExpression(node.expression) &&
          t.isMemberExpression(node.expression.left) &&
          t.isIdentifier(node.expression.left.object) &&
          node.expression.left.object.name === 'module' &&
          t.isIdentifier(node.expression.left.property) &&
          node.expression.left.property.name === 'exports' &&
          t.isObjectExpression(node.expression.right)
        ) {
          const properties = node.expression.right.properties as t.ObjectProperty[];
          removeProperty(properties, path[0]);
          removedRootProperty = true;
        }
      });

      if (removedRootProperty) {
        return;
      }
    }

    const properties = this.getFieldProperties(path) as t.ObjectProperty[];
    if (properties) {
      const lastPath = path.at(-1) as string;
      removeProperty(properties, lastPath);
    }
  }

  appendValueToArray(path: string[], value: any) {
    const node = this.valueToNode(value);

    if (node) {
      this.appendNodeToArray(path, node);
    }
  }

  appendNodeToArray(path: string[], node: t.Expression) {
    const current = this.getFieldNode(path);
    if (!current) {
      this.setFieldNode(path, t.arrayExpression([node]));
    } else if (t.isArrayExpression(current)) {
      current.elements.push(node);
    } else {
      throw new Error(`Expected array at '${path.join('.')}', got '${current.type}'`);
    }
  }

  /**
   * Specialized helper to remove addons or other array entries that can either be strings or
   * objects with a name property.
   */
  removeEntryFromArray(path: string[], value: string) {
    const current = this.getFieldNode(path);

    if (!current) {
      return;
    }
    if (t.isArrayExpression(current)) {
      const index = current.elements.findIndex((element) => {
        if (t.isStringLiteral(element)) {
          return element.value === value;
        }
        if (t.isObjectExpression(element)) {
          const name = this._getPresetValue(element, 'name');
          return name === value;
        }
        return this._getPnpWrappedValue(element as t.Node) === value;
      });
      if (index >= 0) {
        current.elements.splice(index, 1);
      } else {
        throw new Error(`Could not find '${value}' in array at '${path.join('.')}'`);
      }
    } else {
      throw new Error(`Expected array at '${path.join('.')}', got '${current.type}'`);
    }
  }

  _inferQuotes() {
    if (!this._quotes) {
      // first 500 tokens for efficiency
      const occurrences = (this._ast.tokens || []).slice(0, 500).reduce(
        (acc, token) => {
          if (token.type.label === 'string') {
            acc[this._code[token.start]] += 1;
          }
          return acc;
        },
        { "'": 0, '"': 0 }
      );
      this._quotes = occurrences["'"] > occurrences['"'] ? 'single' : 'double';
    }
    return this._quotes;
  }

  valueToNode(value: any) {
    const quotes = this._inferQuotes();
    let valueNode;
    // we do this rather than t.valueToNode because apparently
    // babel only preserves quotes if they are parsed from the original code.
    if (quotes === 'single') {
      const { code } = generate(t.valueToNode(value), { jsescOption: { quotes } });
      const program = babelParse(`const __x = ${code}`);
      traverse(program, {
        VariableDeclaration: {
          enter({ node }) {
            if (
              node.declarations.length === 1 &&
              t.isVariableDeclarator(node.declarations[0]) &&
              t.isIdentifier(node.declarations[0].id) &&
              node.declarations[0].id.name === '__x'
            ) {
              valueNode = node.declarations[0].init;
            }
          },
        },
      });
    } else {
      // double quotes is the default so we can skip all that
      valueNode = t.valueToNode(value);
    }
    return valueNode;
  }

  setFieldValue(path: string[], value: any) {
    const valueNode = this.valueToNode(value);
    if (!valueNode) {
      throw new Error(`Unexpected value ${JSON.stringify(value)}`);
    }
    this.setFieldNode(path, valueNode);
  }

  getBodyDeclarations() {
    return this._ast.program.body;
  }

  setBodyDeclaration(declaration: t.Declaration) {
    this._ast.program.body.push(declaration);
  }

  /**
   * Import specifiers for a specific require import
   *
   * @example
   *
   * ```ts
   * // const { foo } = require('bar');
   * setRequireImport(['foo'], 'bar');
   *
   * // const foo = require('bar');
   * setRequireImport('foo', 'bar');
   * ```
   *
   * @param importSpecifiers - The import specifiers to set. If a string is passed in, a default
   *   import will be set. Otherwise, an array of named imports will be set
   * @param fromImport - The module to import from
   */
  setRequireImport(importSpecifier: string[] | string, fromImport: string) {
    const requireDeclaration = this._ast.program.body.find(
      (node) =>
        t.isVariableDeclaration(node) &&
        node.declarations.length === 1 &&
        t.isVariableDeclarator(node.declarations[0]) &&
        t.isCallExpression(node.declarations[0].init) &&
        t.isIdentifier(node.declarations[0].init.callee) &&
        node.declarations[0].init.callee.name === 'require' &&
        t.isStringLiteral(node.declarations[0].init.arguments[0]) &&
        node.declarations[0].init.arguments[0].value === fromImport
    ) as t.VariableDeclaration | undefined;

    /**
     * Returns true, when the given import declaration has the given import specifier
     *
     * @example
     *
     * ```ts
     * // const { foo } = require('bar');
     * hasImportSpecifier(declaration, 'foo');
     * ```
     */
    const hasRequireSpecifier = (name: string) =>
      t.isObjectPattern(requireDeclaration?.declarations[0].id) &&
      requireDeclaration?.declarations[0].id.properties.find(
        (specifier) =>
          t.isObjectProperty(specifier) &&
          t.isIdentifier(specifier.key) &&
          specifier.key.name === name
      );

    /**
     * Returns true, when the given import declaration has the given default import specifier
     *
     * @example
     *
     * ```ts
     * // import foo from 'bar';
     * hasImportSpecifier(declaration, 'foo');
     * ```
     */
    const hasDefaultRequireSpecifier = (declaration: t.VariableDeclaration, name: string) =>
      declaration.declarations.length === 1 &&
      t.isVariableDeclarator(declaration.declarations[0]) &&
      t.isIdentifier(declaration.declarations[0].id) &&
      declaration.declarations[0].id.name === name;

    // if the import specifier is a string, we're dealing with default imports
    if (typeof importSpecifier === 'string') {
      // If the import declaration with the given source exists
      const addDefaultRequireSpecifier = () => {
        this._ast.program.body.unshift(
          t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier(importSpecifier),
              t.callExpression(t.identifier('require'), [t.stringLiteral(fromImport)])
            ),
          ])
        );
      };

      if (requireDeclaration) {
        if (!hasDefaultRequireSpecifier(requireDeclaration, importSpecifier)) {
          // If the import declaration hasn't the specified default identifier, we add a new variable declaration
          addDefaultRequireSpecifier();
        }
        // If the import declaration with the given source doesn't exist
      } else {
        // Add the import declaration to the top of the file
        addDefaultRequireSpecifier();
      }
      // if the import specifier is an array, we're dealing with named imports
    } else if (requireDeclaration) {
      importSpecifier.forEach((specifier) => {
        if (!hasRequireSpecifier(specifier)) {
          (requireDeclaration.declarations[0].id as t.ObjectPattern).properties.push(
            t.objectProperty(t.identifier(specifier), t.identifier(specifier), undefined, true)
          );
        }
      });
    } else {
      this._ast.program.body.unshift(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.objectPattern(
              importSpecifier.map((specifier) =>
                t.objectProperty(t.identifier(specifier), t.identifier(specifier), undefined, true)
              )
            ),
            t.callExpression(t.identifier('require'), [t.stringLiteral(fromImport)])
          ),
        ])
      );
    }
  }

  /**
   * Set import specifiers for a given import statement.
   *
   * Does not support setting type imports (yet)
   *
   * @example
   *
   * ```ts
   * // import { foo } from 'bar';
   * setImport(['foo'], 'bar');
   *
   * // import foo from 'bar';
   * setImport('foo', 'bar');
   * ```
   *
   * @param importSpecifiers - The import specifiers to set. If a string is passed in, a default
   *   import will be set. Otherwise, an array of named imports will be set
   * @param fromImport - The module to import from
   */
  setImport(importSpecifier: string[] | string, fromImport: string) {
    const getNewImportSpecifier = (specifier: string) =>
      t.importSpecifier(t.identifier(specifier), t.identifier(specifier));

    /**
     * Returns true, when the given import declaration has the given import specifier
     *
     * @example
     *
     * ```ts
     * // import { foo } from 'bar';
     * hasImportSpecifier(declaration, 'foo');
     * ```
     */
    const hasImportSpecifier = (declaration: t.ImportDeclaration, name: string) =>
      declaration.specifiers.find(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported) &&
          specifier.imported.name === name
      );

    /**
     * Returns true, when the given import declaration has the given default import specifier
     *
     * @example
     *
     * ```ts
     * // import foo from 'bar';
     * hasImportSpecifier(declaration, 'foo');
     * ```
     */
    const hasDefaultImportSpecifier = (declaration: t.ImportDeclaration, name: string) =>
      declaration.specifiers.find((specifier) => t.isImportDefaultSpecifier(specifier));

    const importDeclaration = this._ast.program.body.find(
      (node) => t.isImportDeclaration(node) && node.source.value === fromImport
    ) as t.ImportDeclaration | undefined;

    // if the import specifier is a string, we're dealing with default imports
    if (typeof importSpecifier === 'string') {
      // If the import declaration with the given source exists
      if (importDeclaration) {
        if (!hasDefaultImportSpecifier(importDeclaration, importSpecifier)) {
          // If the import declaration hasn't a default specifier, we add it
          importDeclaration.specifiers.push(
            t.importDefaultSpecifier(t.identifier(importSpecifier))
          );
        }
        // If the import declaration with the given source doesn't exist
      } else {
        // Add the import declaration to the top of the file
        this._ast.program.body.unshift(
          t.importDeclaration(
            [t.importDefaultSpecifier(t.identifier(importSpecifier))],
            t.stringLiteral(fromImport)
          )
        );
      }
      // if the import specifier is an array, we're dealing with named imports
    } else if (importDeclaration) {
      importSpecifier.forEach((specifier) => {
        if (!hasImportSpecifier(importDeclaration, specifier)) {
          importDeclaration.specifiers.push(getNewImportSpecifier(specifier));
        }
      });
    } else {
      this._ast.program.body.unshift(
        t.importDeclaration(
          importSpecifier.map((specifier) =>
            t.importSpecifier(t.identifier(specifier), t.identifier(specifier))
          ),
          t.stringLiteral(fromImport)
        )
      );
    }
  }
}

export const loadConfig = (code: string, fileName?: string) => {
  const ast = babelParse(code);
  return new ConfigFile(ast, code, fileName);
};

export const formatConfig = (config: ConfigFile): string => {
  return printConfig(config).code;
};

export const printConfig = (config: ConfigFile, options: Options = {}): PrintResultType => {
  return recast.print(config._ast, options);
};

export const readConfig = async (fileName: string) => {
  const code = (await readFile(fileName, 'utf-8')).toString();
  return loadConfig(code, fileName).parse();
};

export const writeConfig = async (config: ConfigFile, fileName?: string) => {
  const fname = fileName || config.fileName;

  if (!fname) {
    throw new Error('Please specify a fileName for writeConfig');
  }
  await writeFile(fname, formatConfig(config));
};
