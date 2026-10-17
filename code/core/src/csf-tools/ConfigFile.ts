import { readFile, writeFile } from 'node:fs/promises';

import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';
import invariant from 'tiny-invariant';

import type { PrintResultType } from './PrintResultType.ts';
import { createConfigObject } from './ConfigObject.ts';
import {
  type CsfExpression,
  type CsfMutationDiagnostic,
  type CsfMutationResult,
  type CsfObject,
  type CsfObjectHost,
  type CsfValue,
  createCsfObject,
  literalRoot,
  parseExpression,
} from './CsfObject.ts';
import {
  type E,
  type Node,
  isIdentifier,
  isStringLiteral,
  locationOf,
  placeableTextOf,
  staticKey,
  unwrapExpression,
  walk,
} from './estree/ast.ts';
import {
  SourceEditor,
  appendStatement,
  appendToList,
  arrayList,
  insertAfterImports,
  insertStatementAfter,
  objectList,
  prependStatement,
  printString,
  printValue,
  removeFromList,
  removeStatement,
  setImportSpecifiers,
} from './estree/editor.ts';
import { findVarInitialization } from './findVarInitialization.ts';

export interface CallArgumentsOptions {
  importedName: string;
  methodName: string;
  moduleNames: Iterable<string>;
}

// Only logged: a mutation of such an export fails with a diagnostic of its own.
const getCsfParsingErrorMessage = ({
  fileName,
  expectedType,
  foundType,
  node,
}: {
  fileName: string | undefined;
  expectedType: string;
  foundType: string | undefined;
  node: any | undefined;
}) => {
  return dedent`
      CSF Parsing error in ${fileName ?? 'a config file'}: Expected '${expectedType}' but found '${foundType}' instead in '${node?.type}'.
    `;
};

const _getPath = (path: string[], node: Node | null | undefined): Node | undefined => {
  if (path.length === 0) {
    return node ?? undefined;
  }
  if (node?.type === 'ObjectExpression') {
    const [first, ...rest] = path;
    const field = node.properties.find((p) => staticKey(p) === first) as
      | E.ObjectProperty
      | undefined;
    if (field) {
      return _getPath(rest, field.value);
    }
  }
  return undefined;
};

const _getPathProperties = (path: string[], node: Node): E.ObjectProperty[] | undefined => {
  if (path.length === 0) {
    if (node.type === 'ObjectExpression') {
      return node.properties as E.ObjectProperty[];
    }
    throw new Error('Expected object expression');
  }
  if (node.type === 'ObjectExpression') {
    const [first, ...rest] = path;
    const field = node.properties.find((p) => staticKey(p) === first) as
      | E.ObjectProperty
      | undefined;
    if (field) {
      // FXIME handle spread etc.
      if (rest.length === 0) {
        return node.properties as E.ObjectProperty[];
      }

      return _getPathProperties(rest, field.value);
    }
  }
  return undefined;
};

const _findVarDeclarator = (
  identifier: string,
  program: E.Program
): E.VariableDeclarator | undefined => {
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }
    const declarator = declaration.declarations.find((decl) => isIdentifier(decl.id, identifier));
    if (declarator) {
      return declarator;
    }
  }
  return undefined;
};

const namesToAdd = (names: readonly string[], has: (name: string) => boolean) =>
  [...new Set(names)].filter((name) => !has(name));

const isRequireOf = (node: Node | null | undefined, fromImport: string) =>
  node?.type === 'CallExpression' &&
  isIdentifier(node.callee, 'require') &&
  isStringLiteral(node.arguments[0]) &&
  (node.arguments[0].value === fromImport ||
    node.arguments[0].value === fromImport.split('node:')[1]);

export class ConfigFile implements CsfObject {
  /**
   * Identify the config, meta, story, annotation, or call argument this editor represents.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default {};').parse();
   * object.target; // { kind: 'config' }
   * ```
   */
  readonly target = { kind: 'config' } as const;
  // No member may be private: core resolves this class from both src and dist, and any private
  // member makes the emitted class type nominal, so the two identities stop being assignable.
  _changed = false;
  _mutationDiagnostics: CsfMutationDiagnostic[] = [];

  /**
   * Report whether this editor has applied a mutation. Reads and no-op edits leave it unchanged.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default {};').parse();
   * object.changed; // false
   * object.set(['tags'], ['autodocs']);
   * object.changed; // true
   * ```
   */
  get changed() {
    return this._changed;
  }

  /**
   * Read diagnostics from unsupported discovery, reads, or mutations. `writeConfig` refuses to
   * write a config with diagnostics, even if another edit succeeded.
   *
   * @example
   * ```ts
   * const config = loadConfig('export default { old: 1, current: 2 };').parse();
   * config.rename(['old'], 'current');
   * config.mutationDiagnostics.map(({ code }) => code); // ['occupied-destination']
   * config.changed; // false
   * ```
   */
  get mutationDiagnostics(): readonly CsfMutationDiagnostic[] {
    return [...this._mutationDiagnostics];
  }

  /**
   * Read a detached copy of the expression at a property path. Missing fields return `undefined`.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'] };").parse();
   * object.get(['tags'])?.type; // 'ArrayExpression'
   * object.get(['missing']); // undefined
   * ```
   */
  get(path: readonly string[]): CsfExpression | undefined {
    const editor = this._objectEditor('read');
    return editor.ok ? editor.object.get(path) : undefined;
  }

  /**
   * Read plain values without executing code. Missing fields return `undefined`; unresolved
   * expressions also return `undefined` and add a mutation diagnostic.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'], enabled: true };").parse();
   * object.getValue(['tags']); // ['docs']
   * object.getValue(['enabled']); // true
   * object.getValue(['missing']); // undefined
   * ```
   */
  getValue(path: readonly string[]): CsfValue {
    const editor = this._objectEditor('read');
    return editor.ok ? editor.object.getValue(path) : undefined;
  }

  /**
   * Set a plain value or an expression from `get` / `parseExpression`, creating missing parents.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default {};').parse();
   * object.set(['parameters', 'a11y'], { test: 'todo', enabled: true });
   * // { ok: true, changed: true }
   * object.getValue(['parameters']); // { a11y: { test: 'todo', enabled: true } }
   * ```
   */
  set(path: readonly string[], value: CsfValue | CsfExpression): CsfMutationResult {
    return this._mutate((object) => object.set(path, value));
  }

  /**
   * Replace a value derived from its current expression. Return a new expression, or `undefined`
   * (or the input) to leave the value unchanged.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'] };").parse();
   * object.transform(['tags'], (value) =>
   *   parseExpression(`[...${placeableTextOf(value)}, 'autodocs']`)
   * ); // { ok: true, changed: true }
   * object.getValue(['tags']); // ['docs', 'autodocs']
   * ```
   */
  transform(
    path: readonly string[],
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult {
    return this._mutate((object) => object.transform(path, derive));
  }

  /**
   * Remove a property and recursively clean up empty parents. Missing fields are a no-op.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default { parameters: { a11y: { disable: true } } };').parse();
   * object.remove(['parameters', 'a11y', 'disable']); // { ok: true, changed: true }
   * object.getValue(['parameters']); // undefined
   * object.remove(['parameters']); // { ok: true, changed: false }
   * ```
   */
  remove(path: readonly string[]): CsfMutationResult {
    return this._mutate((object) => object.remove(path));
  }

  /**
   * Rename a property within its parent. An occupied destination produces a diagnostic
   * and leaves the source unchanged.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { a11y: { element: '#root' } };").parse();
   * object.rename(['a11y', 'element'], 'context'); // { ok: true, changed: true }
   * object.getValue(['a11y']); // { context: '#root' }
   * ```
   */
  rename(path: readonly string[], name: string): CsfMutationResult {
    return this._mutate((object) => object.rename(path, name));
  }

  /**
   * Move a property to another path, creating missing destination parents and cleaning up
   * empty source parents. Rejects occupied destinations. Use `group` when nesting siblings must
   * preserve expression evaluation order.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { globals: { theme: 'dark' } };").parse();
   * object.move(['globals'], ['initialGlobals']); // { ok: true, changed: true }
   * object.getValue(['initialGlobals']); // { theme: 'dark' }
   * object.getValue(['globals']); // undefined
   * ```
   */
  move(from: readonly string[], to: readonly string[]): CsfMutationResult {
    return this._mutate((object) => object.move(from, to));
  }

  /**
   * Nest named sibling properties under a destination, retaining their source order. Rejects
   * conflicts and relocations that could change evaluation order. Missing source fields are ignored.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default { showNav: false, showPanel: true };').parse();
   * object.group(['layout'], ['showNav', 'showPanel']); // { ok: true, changed: true }
   * object.getValue(['layout']); // { showNav: false, showPanel: true }
   * object.getValue(['showNav']); // undefined
   * ```
   */
  group(path: readonly string[], names: readonly string[]): CsfMutationResult {
    return this._mutate((object) => object.group(path, names));
  }

  _mutate(operation: (object: CsfObject) => CsfMutationResult): CsfMutationResult {
    const editor = this._objectEditor('mutate');
    return editor.ok === true
      ? operation(editor.object)
      : { ok: false, changed: false, diagnostic: editor.diagnostic };
  }

  _objectEditor(mode: 'read' | 'mutate') {
    const editor = createConfigObject(
      this,
      mode,
      (diagnostic) => this._mutationDiagnostics.push(diagnostic),
      () => {
        this._changed = true;
      }
    );
    if (editor.ok === false) {
      this._mutationDiagnostics.push(editor.diagnostic);
    }
    return editor;
  }

  _editor: SourceEditor;

  _exports: Record<string, Node> = {};

  // FIXME: this is a hack. this is only used in the case where the user is
  // modifying a named export that's a scalar. The _exports map is not suitable
  // for that. But rather than refactor the whole thing, we just use this as a stopgap.
  _exportDecls: Record<string, E.VariableDeclarator | E.Function> = {};

  _exportsObject: E.ObjectExpression | undefined;

  fileName?: string;

  hasDefaultExport = false;

  constructor(code: string, fileName?: string) {
    this._editor = new SourceEditor(code, fileName, () => {
      this._exports = {};
      this._exportDecls = {};
      this._exportsObject = undefined;
      this.hasDefaultExport = false;
      this.parse();
    });
    this.fileName = fileName;
  }

  get _program(): E.Program {
    return this._editor.program;
  }

  get _code(): string {
    return this._editor.code;
  }

  _parseExportsObject(exportsObject: E.ObjectExpression) {
    this._exportsObject = exportsObject;
    for (const p of exportsObject.properties) {
      const exportName = staticKey(p);
      if (exportName) {
        this._exports[exportName] = this._resolveDeclaration((p as E.ObjectProperty).value);
      }
    }
  }

  /**
   * Resolve a declaration node by unwrapping TS assertions/satisfies and following identifiers to
   * resolve the correct node in case it's an identifier.
   */
  _resolveDeclaration = (node: Node, isTopLevel = true) => {
    const decl = unwrapExpression(node);
    if (decl?.type === 'Identifier' && isTopLevel) {
      const initialization = findVarInitialization(decl.name, this._program);
      return initialization ? unwrapExpression(initialization) : decl;
    }
    return decl;
  };

  parse() {
    walk(this._program, (node, parent) => {
      const isTopLevel = parent?.type === 'Program';
      if (node.type === 'ExportDefaultDeclaration') {
        this.hasDefaultExport = true;
        let decl = this._resolveDeclaration(node.declaration as Node, isTopLevel);

        // csf factory - unwrap call expressions like definePreview({...}) or definePreview({...}).type<T>()
        while (decl?.type === 'CallExpression') {
          if (decl.arguments[0]?.type === 'ObjectExpression') {
            decl = decl.arguments[0];
            break;
          } else if (
            decl.callee.type === 'MemberExpression' &&
            decl.callee.object.type === 'CallExpression'
          ) {
            decl = decl.callee.object;
          } else {
            break;
          }
        }

        if (decl?.type === 'ObjectExpression') {
          this._parseExportsObject(decl);
        } else {
          logger.debug(
            getCsfParsingErrorMessage({
              fileName: this.fileName,
              expectedType: 'ObjectExpression',
              foundType: decl?.type,
              node: decl || node.declaration,
            })
          );
        }
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration?.type === 'VariableDeclaration') {
          // export const X = ...;
          for (const decl of node.declaration.declarations) {
            if (decl.id.type === 'Identifier') {
              const exportName = decl.id.name;
              this._exports[exportName] = this._resolveDeclaration(decl.init as Node, isTopLevel);
              this._exportDecls[exportName] = decl;
            }
          }
        } else if (node.declaration?.type === 'FunctionDeclaration') {
          // export function X() {...};
          const decl = node.declaration;
          if (decl.id) {
            this._exportDecls[decl.id.name] = decl;
            this._exports[decl.id.name] = decl;
          }
        } else if (node.specifiers.length > 0) {
          // export { X };
          for (const spec of node.specifiers) {
            if (spec.local.type !== 'Identifier') {
              continue;
            }
            const localName = spec.local.name;
            const exportName =
              spec.exported.type === 'Identifier'
                ? spec.exported.name
                : (spec.exported as E.StringLiteral).value;

            const decl =
              _findVarDeclarator(localName, this._program) ??
              this._program.body.find(
                (statement): statement is E.Function =>
                  statement.type === 'FunctionDeclaration' && statement.id?.name === localName
              );
            // decl can be empty in case X from `import { X } from ....` because it is not handled in _findVarDeclarator
            if (decl) {
              const value =
                decl.type !== 'VariableDeclarator'
                  ? decl
                  : decl.init
                    ? this._resolveDeclaration(decl.init, isTopLevel)
                    : undefined;
              if (exportName === 'default' && value?.type === 'ObjectExpression') {
                this.hasDefaultExport = true;
                this._parseExportsObject(value);
                continue;
              }
              if (value) {
                this._exports[exportName] = value;
              }
              this._exportDecls[exportName] = decl;
            }
          }
        } else {
          logger.debug(
            getCsfParsingErrorMessage({
              fileName: this.fileName,
              expectedType: 'VariableDeclaration',
              foundType: node.declaration?.type,
              node: node.declaration,
            })
          );
        }
      } else if (
        node.type === 'ExpressionStatement' &&
        node.expression.type === 'AssignmentExpression' &&
        node.expression.operator === '='
      ) {
        const { left, right } = node.expression;
        if (
          left.type === 'MemberExpression' &&
          isIdentifier(left.object, 'module') &&
          isIdentifier(left.property, 'exports')
        ) {
          const exportObject = this._resolveDeclaration(right, isTopLevel);

          if (exportObject?.type === 'ObjectExpression') {
            this._exportsObject = exportObject;
            for (const p of exportObject.properties as Node[]) {
              const exportName = staticKey(p);
              if (exportName) {
                this._exports[exportName] = this._resolveDeclaration(
                  (p as E.ObjectProperty).value,
                  isTopLevel
                );
              }
            }
          } else {
            logger.debug(
              getCsfParsingErrorMessage({
                fileName: this.fileName,
                expectedType: 'ObjectExpression',
                foundType: exportObject?.type,
                node: exportObject,
              })
            );
          }
        }
      } else if (
        node.type === 'CallExpression' &&
        isIdentifier(node.callee, 'definePreview') &&
        node.arguments.length === 1 &&
        node.arguments[0].type === 'ObjectExpression'
      ) {
        this._parseExportsObject(node.arguments[0]);
      }
    });
    return this;
  }

  getFieldNode(path: string[]) {
    const [root, ...rest] = path;
    const exported = this._exports[root];

    if (!exported) {
      return undefined;
    }
    return _getPath(rest, exported);
  }

  getFieldProperties(path: string[]): ReturnType<typeof _getPathProperties> {
    const [root, ...rest] = path;
    const exported = this._exports[root];

    if (!exported) {
      return undefined;
    }
    return _getPathProperties(rest, exported);
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
    if (node.type === 'ArrayExpression') {
      for (const element of node.elements) {
        pathNames.push(this._getPresetValue(element as Node, 'name'));
      }
    }

    return pathNames;
  }

  _getWrappedValue(node: Node) {
    if (node.type === 'CallExpression') {
      const arg = node.arguments[0];
      if (isStringLiteral(arg)) {
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
  _getPresetValue(node: Node, fallbackProperty: string) {
    let value;
    if (isStringLiteral(node)) {
      value = node.value;
    } else if (node.type === 'ObjectExpression') {
      for (const prop of node.properties) {
        if (prop.type !== 'Property') {
          continue;
        }
        // { framework: { name: 'value' } }
        if (isIdentifier(prop.key, fallbackProperty)) {
          if (isStringLiteral(prop.value)) {
            value = prop.value.value;
          } else {
            value = this._getWrappedValue(prop.value);
          }
        }

        // { "framework": { "name": "value" } }
        if (isStringLiteral(prop.key) && prop.key.value === 'name' && isStringLiteral(prop.value)) {
          value = prop.value.value;
        }
      }
    } else if (node.type === 'CallExpression') {
      value = this._getWrappedValue(node);
    }

    if (!value) {
      throw new Error(
        `The given node must be a string literal or an object expression with a "${fallbackProperty}" property that is a string literal.`
      );
    }

    return value;
  }

  removeField(path: string[]) {
    const editor = this._editor;
    const removeProperty = (object: E.ObjectExpression, prop: string) => {
      const member = object.properties.find((p) => staticKey(p) === prop);
      if (member) {
        removeFromList(editor, objectList(editor, object), [member]);
      }
    };
    // the structure of this._exports doesn't work for this use case
    // so we have to manually bypass it here
    if (path.length === 1) {
      let removedRootProperty = false;
      // removing the root export
      for (const node of this._program.body) {
        // named export
        if (
          node.type === 'ExportNamedDeclaration' &&
          node.declaration?.type === 'VariableDeclaration'
        ) {
          const decl = node.declaration.declarations[0];
          if (isIdentifier(decl.id, path[0])) {
            removeStatement(editor, node);
            removedRootProperty = true;
          }
        }
      }
      // The config object `parse` found, unwrapped from factory calls like `defineMain({})`.
      if (this._exportsObject) {
        removeProperty(this._exportsObject, path[0]);
        removedRootProperty = true;
      }

      if (removedRootProperty) {
        this._editor.commit();
        return;
      }
    }

    const [root, ...rest] = path;
    const parentNode = _getPath(rest.slice(0, -1), this._exports[root]);
    if (this._exports[root] && parentNode?.type === 'ObjectExpression') {
      removeProperty(parentNode, path.at(-1)!);
      this._editor.commit();
    }
  }

  appendValueToArray(path: string[], value: any) {
    const node = this.valueToNode(value);

    if (node) {
      this.appendNodeToArray(path, node);
    }
  }

  appendNodeToArray(path: string[], node: CsfExpression) {
    const current = this.getFieldNode(path);
    const source = placeableTextOf(node);
    if (!current) {
      this.set(path, parseExpression(`[${source}]`));
    } else if (current.type === 'ArrayExpression') {
      appendToList(this._editor, arrayList(this._editor, current), [source]);
      this._editor.commit();
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
    if (current.type === 'ArrayExpression') {
      const element = current.elements.find((element) => {
        if (isStringLiteral(element)) {
          return element.value === value;
        }
        if (element?.type === 'ObjectExpression') {
          const name = this._getPresetValue(element, 'name');
          return name === value;
        }
        return element ? this._getWrappedValue(element) === value : false;
      });
      if (element) {
        removeFromList(this._editor, arrayList(this._editor, current), [element]);
        this._editor.commit();
      } else {
        throw new Error(`Could not find '${value}' in array at '${path.join('.')}'`);
      }
    } else {
      throw new Error(`Expected array at '${path.join('.')}', got '${current.type}'`);
    }
  }

  valueToNode(value: any): CsfExpression | undefined {
    return parseExpression(printValue(value, this._editor.quote));
  }

  getBodyDeclarations(): Node[] {
    return this._program.body;
  }

  /**
   * Edit the first object argument of method calls on a named import, including CommonJS aliases.
   * Unsupported arguments add mutation diagnostics; calls without arguments are ignored.
   *
   * @example
   * ```ts
   * const manager = loadConfig(`
   *   import { addons } from 'storybook/manager-api';
   *   addons.setConfig({ showNav: false });
   * `).parse();
   * const [object] = manager.callArguments({
   *   importedName: 'addons',
   *   methodName: 'setConfig',
   *   moduleNames: ['storybook/manager-api'],
   * });
   * object.group(['layout'], ['showNav']);
   * object.getValue(['layout']); // { showNav: false }
   * manager.changed; // true
   * ```
   */
  callArguments(options: CallArgumentsOptions): readonly CsfObject[] {
    const report = (diagnostic: CsfMutationDiagnostic) =>
      this._mutationDiagnostics.push(diagnostic);
    const target = {
      kind: 'call-argument',
      importedName: options.importedName,
      methodName: options.methodName,
    } as const;
    const calls = findCallArguments(this, options, report);
    return calls.map((_, index) => {
      const host: CsfObjectHost = {
        editor: this._editor,
        root: () => {
          // Edits re-parse the file, so the argument is found again by its position among calls.
          const node = findCallArguments(this, options, () => {})[index];
          return node && literalRoot(this._editor, node);
        },
      };
      return createCsfObject(target, host, [], report, () => {
        this._changed = true;
      });
    });
  }

  /** Appends a statement, given as source, to the end of the file. */
  setBodyDeclaration(declaration: string) {
    appendStatement(this._editor, declaration);
    this._editor.commit();
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
    const requireDeclaration = this._findRequire(fromImport);
    if (requireDeclaration) {
      fromImport = (
        (requireDeclaration.declarations[0].init as E.CallExpression)
          .arguments[0] as E.StringLiteral
      ).value;
    }
    const source = printString(fromImport, this._editor.quote);
    const editor = this._editor;

    // if the import specifier is a string, we're dealing with default imports
    if (typeof importSpecifier === 'string') {
      const declarator = requireDeclaration?.declarations[0];
      if (!declarator || !isIdentifier(declarator.id, importSpecifier)) {
        // If the import declaration hasn't the specified default identifier, we add a new variable declaration
        prependStatement(editor, `const ${importSpecifier} = require(${source});`);
      }
      // if the import specifier is an array, we're dealing with named imports
    } else {
      const pattern = requireDeclaration?.declarations[0].id;
      const names = namesToAdd(
        importSpecifier,
        (name) =>
          pattern?.type === 'ObjectPattern' &&
          pattern.properties.some(
            (property) => property.type === 'Property' && isIdentifier(property.key, name)
          )
      );
      if (!pattern) {
        prependStatement(editor, `const { ${names.join(', ')} } = require(${source});`);
      } else if (pattern.type === 'ObjectPattern' && names.length > 0) {
        appendToList(editor, objectList(editor, pattern), names);
      }
    }
    this._editor.commit();
  }

  _findRequire(fromImport: string) {
    return this._program.body.find(
      (node): node is E.VariableDeclaration =>
        node.type === 'VariableDeclaration' &&
        node.declarations.length === 1 &&
        isRequireOf(node.declarations[0].init, fromImport)
    );
  }

  _findImport(fromImport: string) {
    return this._program.body.find(
      (node): node is E.ImportDeclaration =>
        node.type === 'ImportDeclaration' &&
        (node.source.value === fromImport || node.source.value === fromImport.split('node:')[1])
    );
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
   *
   * // import * as foo from 'bar';
   * setImport({ namespace: 'foo' }, 'bar');
   *
   * // import 'bar';
   * setImport(null, 'bar');
   * ```
   *
   * @param importSpecifiers - The import specifiers to set. If a string is passed in, a default
   *   import will be set. Otherwise, an array of named imports will be set
   * @param fromImport - The module to import from
   */
  setImport(importSpecifier: string[] | string | { namespace: string } | null, fromImport: string) {
    const importDeclaration = this._findImport(fromImport);
    if (importDeclaration) {
      fromImport = importDeclaration.source.value;
    }
    const editor = this._editor;
    const source = printString(fromImport, this._editor.quote);
    const has = (type: string, name?: string) =>
      !!importDeclaration?.specifiers.some(
        (specifier) =>
          specifier.type === type &&
          (name === undefined ||
            (type === 'ImportSpecifier'
              ? isIdentifier((specifier as E.ImportSpecifier).imported, name)
              : specifier.local.name === name))
      );
    // A new import goes after the existing ones, and a clause the declaration cannot take gets a
    // declaration of its own right after it, which keeps the module evaluation order.
    const addImport = (clause: string, merged?: { default?: string; named?: string[] }) => {
      if (!importDeclaration) {
        insertAfterImports(editor, `import ${clause} from ${source};`);
      } else if (merged) {
        setImportSpecifiers(editor, importDeclaration, importDeclaration.specifiers, merged);
      } else {
        insertStatementAfter(editor, importDeclaration, `import ${clause} from ${source};`);
      }
    };

    // Handle side-effect imports (e.g., import 'foo')
    if (importSpecifier === null) {
      if (!importDeclaration) {
        insertAfterImports(editor, `import ${source};`);
      }
      // Handle default imports e.g. import foo from 'bar'
    } else if (typeof importSpecifier === 'string') {
      if (!has('ImportDefaultSpecifier', importSpecifier)) {
        addImport(
          importSpecifier,
          has('ImportDefaultSpecifier') ? undefined : { default: importSpecifier }
        );
      }
      // Handle named imports e.g. import { foo } from 'bar'
    } else if (Array.isArray(importSpecifier)) {
      const names = namesToAdd(importSpecifier, (name) => has('ImportSpecifier', name));
      if (names.length > 0) {
        addImport(
          `{ ${names.join(', ')} }`,
          has('ImportNamespaceSpecifier') ? undefined : { named: names }
        );
      }
      // Handle namespace imports e.g. import * as foo from 'bar'
    } else if (
      importSpecifier.namespace &&
      !has('ImportNamespaceSpecifier', importSpecifier.namespace)
    ) {
      addImport(`* as ${importSpecifier.namespace}`);
    }
    this._editor.commit();
  }

  _removeRequireImport(
    importSpecifier: string[] | string | { namespace: string } | null,
    fromImport: string
  ) {
    const requireDeclaration = this._findRequire(fromImport);
    // require() has no side-effect only or namespace forms, so those are skipped.
    if (!requireDeclaration || importSpecifier === null) {
      return;
    }
    const declarator = requireDeclaration.declarations[0];
    const editor = this._editor;

    // Handle default requires e.g. const foo = require('bar')
    if (typeof importSpecifier === 'string') {
      // For default requires, if the identifier matches, remove the entire declaration
      if (isIdentifier(declarator.id, importSpecifier)) {
        removeStatement(editor, requireDeclaration);
      }
      return;
    }

    // Handle named requires e.g. const { foo, bar } = require('baz')
    if (Array.isArray(importSpecifier) && declarator.id.type === 'ObjectPattern') {
      const pattern = declarator.id;
      const removed = pattern.properties.filter(
        (property) =>
          property.type === 'Property' &&
          importSpecifier.some((specifier) => isIdentifier(property.key, specifier))
      );
      // If no properties left in the destructuring, remove the entire declaration
      if (removed.length === pattern.properties.length) {
        removeStatement(editor, requireDeclaration);
      } else if (removed.length > 0) {
        removeFromList(editor, objectList(editor, pattern), removed);
      }
    }
  }

  _removeImport(
    importSpecifier: string[] | string | { namespace: string } | null,
    fromImport: string
  ) {
    const importDeclaration = this._findImport(fromImport);
    if (!importDeclaration) {
      return;
    }
    const editor = this._editor;

    // Remove side-effect imports (e.g., import 'foo') if exact match, else do nothing.
    if (importSpecifier === null) {
      if (importDeclaration.specifiers.length === 0) {
        removeStatement(editor, importDeclaration);
      }
      return;
    }

    const removed = importDeclaration.specifiers.filter((specifier) => {
      // Handle namespace imports e.g. import * as foo from 'bar'
      if (typeof importSpecifier === 'object' && 'namespace' in importSpecifier) {
        return (
          specifier.type === 'ImportNamespaceSpecifier' &&
          specifier.local.name === importSpecifier.namespace
        );
      }
      // Handle default imports e.g. import foo from 'bar'
      if (typeof importSpecifier === 'string') {
        return (
          specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier
        );
      }
      // Handle named imports e.g. import { foo } from 'bar'
      return (
        specifier.type === 'ImportSpecifier' &&
        importSpecifier.some((name) => isIdentifier(specifier.imported, name))
      );
    });
    if (removed.length === 0) {
      return;
    }

    // If the import declaration has no specifiers left, remove it.
    if (removed.length === importDeclaration.specifiers.length) {
      removeStatement(editor, importDeclaration);
      return;
    }
    setImportSpecifiers(
      editor,
      importDeclaration,
      importDeclaration.specifiers.filter((specifier) => !removed.includes(specifier))
    );
  }

  /**
   * Remove import specifiers for a given import statement.
   *
   * Does not support removing type imports (yet)
   *
   * @example
   *
   * ```ts
   * // import { foo } from 'bar';
   * setImport(['foo'], 'bar');
   *
   * // import foo from 'bar';
   * setImport('foo', 'bar');
   *
   * // import * as foo from 'bar';
   * setImport({ namespace: 'foo' }, 'bar');
   *
   * // import 'bar';
   * setImport(null, 'bar');
   * ```
   *
   * @param importSpecifiers - The import specifiers to remove. If a string is passed in, will only
   *   remove the default import. Otherwise, named imports matching the array will be removed.
   * @param fromImport - The module to import from
   */
  removeImport(
    importSpecifier: string[] | string | { namespace: string } | null,
    fromImport: string
  ) {
    this._removeRequireImport(importSpecifier, fromImport);
    this._editor.commit();
    this._removeImport(importSpecifier, fromImport);
    this._editor.commit();
  }
}

// First object arguments of `importedName.methodName(...)` calls, in source order.
const findCallArguments = (
  config: ConfigFile,
  { importedName, methodName, moduleNames }: CallArgumentsOptions,
  report: (diagnostic: CsfMutationDiagnostic) => void
): E.ObjectExpression[] => {
  const editor = config._editor;
  const modules = new Set(moduleNames);
  const imports = new Map<string, Set<Node>>();
  const addImport = (name: string, node: Node) =>
    imports.set(name, (imports.get(name) ?? new Set()).add(node));

  walk(editor.program, (node) => {
    if (node.type === 'ImportDeclaration') {
      if (!modules.has(node.source.value) || node.importKind === 'type') {
        return;
      }
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.importKind !== 'type' &&
          isIdentifier(specifier.imported, importedName)
        ) {
          addImport(specifier.local.name, specifier);
        }
      }
    } else if (node.type === 'VariableDeclarator') {
      const { id, init } = node;
      if (
        id.type !== 'ObjectPattern' ||
        init?.type !== 'CallExpression' ||
        !isIdentifier(init.callee, 'require') ||
        editor.scopes.bindingOf(init.callee) !== undefined ||
        init.arguments.length !== 1 ||
        !isStringLiteral(init.arguments[0]) ||
        !modules.has(init.arguments[0].value)
      ) {
        return;
      }
      for (const property of id.properties) {
        if (
          property.type === 'Property' &&
          !property.computed &&
          (isIdentifier(property.key, importedName) ||
            (isStringLiteral(property.key) && property.key.value === importedName)) &&
          property.value.type === 'Identifier'
        ) {
          addImport(property.value.name, node);
        }
      }
    }
  });

  const objects: E.ObjectExpression[] = [];
  walk(editor.program, (node) => {
    if (node.type !== 'CallExpression') {
      return;
    }
    const { callee } = node;
    if (
      callee.type !== 'MemberExpression' ||
      callee.object.type !== 'Identifier' ||
      !(
        (isIdentifier(callee.property, methodName) && !callee.computed) ||
        (isStringLiteral(callee.property) && callee.property.value === methodName)
      )
    ) {
      return;
    }
    const binding = editor.scopes.bindingOf(callee.object);
    if (!binding || !imports.get(callee.object.name)?.has(binding.node)) {
      return;
    }
    const argument = node.arguments[0];
    if (!argument) {
      return;
    }
    const value = argument.type === 'SpreadElement' ? argument : unwrapExpression(argument);
    if (!binding.constant || value.type !== 'ObjectExpression') {
      report({
        code: !binding.constant ? 'ambiguous-binding' : 'unsupported-initializer',
        target: { kind: 'call-argument', importedName, methodName },
        path: [],
        message: !binding.constant
          ? 'the imported binding is reassigned'
          : 'the call argument is not an object literal',
        loc: locationOf(editor.code, argument.start, argument.end),
      });
      return;
    }
    objects.push(value);
  });
  return objects;
};

export const loadConfig = (code: string, fileName?: string) => new ConfigFile(code, fileName);

export const formatConfig = (config: ConfigFile): string => {
  return printConfig(config).code;
};

/**
 * Print the config with its edits and `\n` line endings; untouched code is otherwise preserved
 * byte for byte.
 */
export const printConfig = (config: ConfigFile): PrintResultType => {
  const code = config._editor.toString();
  return { code, toString: () => code };
};

export const readConfig = async (fileName: string) => {
  const code = (await readFile(fileName, 'utf-8')).toString();
  return loadConfig(code, fileName).parse();
};

export const writeConfig = async (config: ConfigFile, fileName?: string) => {
  const [diagnostic] = config.mutationDiagnostics;
  invariant(!diagnostic, diagnostic?.message);
  const fname = fileName || config.fileName;

  if (!fname) {
    throw new Error('Please specify a fileName for writeConfig');
  }
  await writeFile(fname, formatConfig(config));
};

export const isCsfFactoryPreview = (previewConfig: ConfigFile) => {
  return previewConfig._program.body.some(
    (node) =>
      node.type === 'ImportDeclaration' &&
      node.source.value.includes('storybook') &&
      node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' && isIdentifier(specifier.imported, 'definePreview')
      )
  );
};
