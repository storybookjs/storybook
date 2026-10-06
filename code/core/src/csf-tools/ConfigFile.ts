import { readFile, writeFile } from 'node:fs/promises';

import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';
import invariant from 'tiny-invariant';

import type { PrintResultType } from './PrintResultType.ts';
import { createConfigObject, specifierList } from './ConfigObject.ts';
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
  printExpression,
} from './CsfObject.ts';
import {
  type E,
  type Node,
  isIdentifier,
  isStringLiteral,
  locationOf,
  unwrapExpression,
  walk,
} from './estree/ast.ts';
import {
  SourceEditor,
  appendStatement,
  appendToList,
  arrayList,
  objectList,
  prependStatement,
  printString,
  printValue,
  removeFromList,
  removeStatement,
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

const propKey = (p: Node) => {
  if (p.type !== 'Property') {
    return null;
  }
  if (p.key.type === 'Identifier') {
    return p.key.name;
  }
  if (isStringLiteral(p.key)) {
    return p.key.value;
  }
  return null;
};

const _getPath = (path: string[], node: Node | null | undefined): Node | undefined => {
  if (path.length === 0) {
    return node ?? undefined;
  }
  if (node?.type === 'ObjectExpression') {
    const [first, ...rest] = path;
    const field = node.properties.find((p) => propKey(p) === first) as E.ObjectProperty | undefined;
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
    const field = node.properties.find((p) => propKey(p) === first) as E.ObjectProperty | undefined;
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
    const editor = this._editor();
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
    const editor = this._editor();
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
   *   parseExpression(`[...${printExpression(value)}, 'autodocs']`)
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
    const editor = this._editor();
    return editor.ok === true
      ? operation(editor.object)
      : { ok: false, changed: false, diagnostic: editor.diagnostic };
  }

  _editor() {
    const editor = createConfigObject(
      this,
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

  /** Source and AST; `CsfFile` calls this `_editor`, but `_editor()` builds the object editor here. */
  _editorSource: SourceEditor;

  _exports: Record<string, Node> = {};

  // FIXME: this is a hack. this is only used in the case where the user is
  // modifying a named export that's a scalar. The _exports map is not suitable
  // for that. But rather than refactor the whole thing, we just use this as a stopgap.
  _exportDecls: Record<string, E.VariableDeclarator | E.Function> = {};

  _exportsObject: E.ObjectExpression | undefined;

  _quotes: 'single' | 'double' | undefined;

  fileName?: string;

  hasDefaultExport = false;

  constructor(code: string, fileName?: string) {
    this._editorSource = new SourceEditor(code, fileName);
    this.fileName = fileName;
  }

  get _program(): E.Program {
    return this._editorSource.program;
  }

  get _code(): string {
    return this._editorSource.code;
  }

  /** Applies pending source edits and parses the result again, refreshing every field. */
  _commit() {
    if (!this._editorSource.commit()) {
      return;
    }
    this._exports = {};
    this._exportDecls = {};
    this._exportsObject = undefined;
    this.hasDefaultExport = false;
    this.parse();
  }

  _parseExportsObject(exportsObject: E.ObjectExpression) {
    this._exportsObject = exportsObject;
    for (const p of exportsObject.properties) {
      const exportName = propKey(p);
      if (exportName) {
        this._exports[exportName] = this._resolveDeclaration((p as E.ObjectProperty).value);
      }
    }
  }

  /** Unwraps TS assertions/satisfies from a node, to get the underlying node. */
  _unwrap = (node: Node | undefined | null): any => {
    if (node?.type === 'TSAsExpression' || node?.type === 'TSSatisfiesExpression') {
      return this._unwrap(node.expression);
    }
    return node;
  };

  /**
   * Resolve a declaration node by unwrapping TS assertions/satisfies and following identifiers to
   * resolve the correct node in case it's an identifier.
   */
  _resolveDeclaration = (node: Node, isTopLevel = true) => {
    const decl = this._unwrap(node);
    if (decl?.type === 'Identifier' && isTopLevel) {
      const initialization = findVarInitialization(decl.name, this._program);
      return initialization ? this._unwrap(initialization) : decl;
    }
    return decl;
  };

  parse() {
    // Infer the dominant quote style from the pristine source up front: later mutations can
    // remove the last string literals (e.g. cleanupTypeImports dropping a legacy import),
    // which must not change how newly generated nodes are quoted.
    this._editorSource.preferredQuote = this._quote;
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
              this._exports[exportName] = value;
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
              const exportName = propKey(p);
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
    const editor = this._editorSource;
    const removeProperty = (object: E.ObjectExpression, prop: string) => {
      const member = object.properties.find((p) => propKey(p) === prop);
      if (member) {
        removeFromList(editor, objectList(object), [member]);
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
        // default export
        if (node.type === 'ExportDefaultDeclaration') {
          const resolved = this._resolveDeclaration(node.declaration as Node);
          if (resolved?.type === 'ObjectExpression') {
            removeProperty(resolved, path[0]);
            removedRootProperty = true;
          }
        }
        // module.exports
        if (
          node.type === 'ExpressionStatement' &&
          node.expression.type === 'AssignmentExpression' &&
          node.expression.left.type === 'MemberExpression' &&
          isIdentifier(node.expression.left.object, 'module') &&
          isIdentifier(node.expression.left.property, 'exports') &&
          node.expression.right.type === 'ObjectExpression'
        ) {
          removeProperty(node.expression.right, path[0]);
          removedRootProperty = true;
        }
      }

      if (removedRootProperty) {
        this._commit();
        return;
      }
    }

    const [root, ...rest] = path;
    const parentNode = _getPath(rest.slice(0, -1), this._exports[root]);
    if (this._exports[root] && parentNode?.type === 'ObjectExpression') {
      removeProperty(parentNode, path.at(-1)!);
      this._commit();
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
    if (!current) {
      this.set(path, parseExpression(`[${printExpression(node)}]`));
    } else if (current.type === 'ArrayExpression') {
      appendToList(this._editorSource, arrayList(current), [printExpression(node)], '');
      this._commit();
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
        removeFromList(this._editorSource, arrayList(current), [element]);
        this._commit();
      } else {
        throw new Error(`Could not find '${value}' in array at '${path.join('.')}'`);
      }
    } else {
      throw new Error(`Expected array at '${path.join('.')}', got '${current.type}'`);
    }
  }

  _inferQuotes() {
    if (!this._quotes) {
      const occurrences = { "'": 0, '"': 0 };
      walk(this._program, (node) => {
        const raw = isStringLiteral(node) ? node.raw : undefined;
        if (typeof raw === 'string' && (raw[0] === "'" || raw[0] === '"')) {
          occurrences[raw[0] as "'" | '"'] += 1;
        }
      });
      this._quotes = occurrences["'"] > occurrences['"'] ? 'single' : 'double';
    }
    return this._quotes;
  }

  get _quote() {
    return this._inferQuotes() === 'single' ? "'" : '"';
  }

  valueToNode(value: any): CsfExpression | undefined {
    return parseExpression(printValue(value, this._quote));
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
        editor: this._editorSource,
        root: () => {
          // Edits re-parse the file, so the argument is found again by its position among calls.
          const node = findCallArguments(this, options, () => {})[index];
          return node && literalRoot(this._editorSource, node);
        },
        commit: () => this._commit(),
      };
      return createCsfObject(target, host, [], report, () => {
        this._changed = true;
      });
    });
  }

  /** Appends a statement, given as source, to the end of the file. */
  setBodyDeclaration(declaration: string) {
    appendStatement(this._editorSource, declaration);
    this._commit();
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
    const source = printString(fromImport, this._quote);
    const editor = this._editorSource;

    // if the import specifier is a string, we're dealing with default imports
    if (typeof importSpecifier === 'string') {
      const declarator = requireDeclaration?.declarations[0];
      if (!declarator || !isIdentifier(declarator.id, importSpecifier)) {
        // If the import declaration hasn't the specified default identifier, we add a new variable declaration
        prependStatement(editor, `const ${importSpecifier} = require(${source});`);
      }
      // if the import specifier is an array, we're dealing with named imports
    } else if (requireDeclaration) {
      const pattern = requireDeclaration.declarations[0].id;
      if (pattern.type === 'ObjectPattern') {
        const missing = importSpecifier.filter(
          (specifier) =>
            !pattern.properties.some(
              (property) => property.type === 'Property' && isIdentifier(property.key, specifier)
            )
        );
        if (missing.length > 0) {
          appendToList(editor, objectList(pattern), missing);
        }
      }
    } else {
      prependStatement(editor, `const { ${importSpecifier.join(', ')} } = require(${source});`);
    }
    this._commit();
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
    const editor = this._editorSource;
    const source = printString(fromImport, this._quote);
    const has = (type: string, name: string) =>
      importDeclaration?.specifiers.some(
        (specifier) =>
          specifier.type === type &&
          (type === 'ImportSpecifier'
            ? isIdentifier((specifier as E.ImportSpecifier).imported, name)
            : specifier.local.name === name)
      );

    // Handle side-effect imports (e.g., import 'foo')
    if (importSpecifier === null) {
      if (!importDeclaration) {
        prependStatement(editor, `import ${source};`);
      }
      // Handle default imports e.g. import foo from 'bar'
    } else if (typeof importSpecifier === 'string') {
      if (!importDeclaration) {
        prependStatement(editor, `import ${importSpecifier} from ${source};`);
      } else if (!has('ImportDefaultSpecifier', importSpecifier)) {
        this._addSpecifiers(importDeclaration, { defaultName: importSpecifier });
      }
      // Handle named imports e.g. import { foo } from 'bar'
    } else if (Array.isArray(importSpecifier)) {
      if (!importDeclaration) {
        prependStatement(editor, `import { ${importSpecifier.join(', ')} } from ${source};`);
      } else {
        const missing = importSpecifier.filter((name) => !has('ImportSpecifier', name));
        if (missing.length > 0) {
          this._addSpecifiers(importDeclaration, { named: missing });
        }
      }
      // Handle namespace imports e.g. import * as foo from 'bar'
    } else if (importSpecifier.namespace) {
      if (!importDeclaration) {
        prependStatement(editor, `import * as ${importSpecifier.namespace} from ${source};`);
      } else if (!has('ImportNamespaceSpecifier', importSpecifier.namespace)) {
        this._addSpecifiers(importDeclaration, { namespace: importSpecifier.namespace });
      }
    }
    this._commit();
  }

  /** Rewrites an import clause with added specifiers, keeping the existing ones. */
  _addSpecifiers(
    declaration: E.ImportDeclaration,
    added: { defaultName?: string; named?: string[]; namespace?: string }
  ) {
    const editor = this._editorSource;
    const named = declaration.specifiers.filter(
      (specifier): specifier is E.ImportSpecifier => specifier.type === 'ImportSpecifier'
    );
    if (added.named && named.length > 0) {
      appendToList(editor, specifierList(editor, declaration), added.named);
      return;
    }
    const defaultSpecifier = declaration.specifiers.find(
      (specifier) => specifier.type === 'ImportDefaultSpecifier'
    );
    const namespace = declaration.specifiers.find(
      (specifier) => specifier.type === 'ImportNamespaceSpecifier'
    );
    const parts = [
      added.defaultName ?? (defaultSpecifier && editor.source(defaultSpecifier)),
      added.namespace ? `* as ${added.namespace}` : namespace && editor.source(namespace),
      named.length > 0
        ? `{ ${named.map((specifier) => editor.source(specifier)).join(', ')} }`
        : added.named && `{ ${added.named.join(', ')} }`,
    ].filter(Boolean);
    const kind = declaration.importKind === 'type' ? 'import type' : 'import';
    editor.edits.overwrite(
      declaration.start,
      declaration.source.start,
      `${kind} ${parts.join(', ')} from `
    );
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
    const editor = this._editorSource;

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
        removeFromList(editor, objectList(pattern), removed);
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
    const editor = this._editorSource;

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
    const kept = importDeclaration.specifiers.filter((specifier) => !removed.includes(specifier));
    const defaultSpecifier = kept.find((specifier) => specifier.type === 'ImportDefaultSpecifier');
    const namespace = kept.find((specifier) => specifier.type === 'ImportNamespaceSpecifier');
    const named = kept.filter((specifier) => specifier.type === 'ImportSpecifier');
    const parts = [
      defaultSpecifier && editor.source(defaultSpecifier),
      namespace && editor.source(namespace),
      named.length > 0 && `{ ${named.map((specifier) => editor.source(specifier)).join(', ')} }`,
    ].filter(Boolean);
    const kind = importDeclaration.importKind === 'type' ? 'import type' : 'import';
    editor.edits.overwrite(
      importDeclaration.start,
      importDeclaration.source.start,
      `${kind} ${parts.join(', ')} from `
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
    this._commit();
    this._removeImport(importSpecifier, fromImport);
    this._commit();
  }
}

/** First object arguments of `importedName.methodName(...)` calls, in source order. */
const findCallArguments = (
  config: ConfigFile,
  { importedName, methodName, moduleNames }: CallArgumentsOptions,
  report: (diagnostic: CsfMutationDiagnostic) => void
): E.ObjectExpression[] => {
  const editor = config._editorSource;
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

/** Print the config with its edits; untouched code is preserved byte for byte. */
export const printConfig = (config: ConfigFile): PrintResultType => {
  // Written files always use LF line endings, whatever the input used.
  const code = config._editorSource.toString().replace(/\r\n?/g, '\n');
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
