import { readFile, writeFile } from 'node:fs/promises';

import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';
import invariant from 'tiny-invariant';

import type { PrintResultType } from './PrintResultType.ts';
import { createConfigObject, locateConfigRoot } from './ConfigObject.ts';
import {
  type CsfExpression,
  type CsfInspection,
  type CsfMutationDiagnostic,
  type CsfMutationResult,
  type CsfObject,
  type CsfObjectHost,
  type CsfPath,
  type CsfValue,
  createCsfObject,
} from './CsfObject.ts';
import { literalRoot } from './ObjectRoot.ts';
import {
  type E,
  EstreeParseError,
  type Node,
  isIdentifier,
  isStringLiteral,
  locationOf,
  parseExpression,
  staticKey,
  unwrapExpression,
  walk,
} from './estree/ast.ts';
import {
  SourceEditor,
  appendStatement,
  appendToList,
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
import { isDeclared } from './estree/scope.ts';
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

const isRequireOf = (node: Node | null | undefined, fromImport: string) =>
  node?.type === 'CallExpression' &&
  isIdentifier(node.callee, 'require') &&
  isStringLiteral(node.arguments[0]) &&
  isSource(node.arguments[0].value, fromImport);

// `node:path` also finds an import of `path`.
const isSource = (value: string, fromImport: string) =>
  value === fromImport || value === fromImport.split('node:')[1];

interface ImportName {
  imported: string;
  local: string;
}

// `'a as b'` imports `a` under the local name `b`.
const IMPORT_NAME = /^\s*([\p{L}\p{N}_$]+)(?:\s+as\s+([\p{L}\p{N}_$]+))?\s*$/u;

const importNames = (specifiers: readonly string[]) => {
  const names = new Map<string, ImportName>();
  for (const specifier of specifiers) {
    const match = IMPORT_NAME.exec(specifier);
    if (!match) {
      throw new Error(`Expected an import name like 'a' or 'a as b', got '${specifier}'`);
    }
    const [, imported, local = imported] = match;
    names.set(`${imported} as ${local}`, { imported, local });
  }
  return [...names.values()];
};

const printImportName = ({ imported, local }: ImportName, separator: string) =>
  imported === local ? imported : `${imported}${separator}${local}`;

const bindsImport = (name: ImportName, imported: Node, local: Node) =>
  isIdentifier(imported, name.imported) &&
  // `{ a = 1 }` binds `a` too.
  isIdentifier(local.type === 'AssignmentPattern' ? local.left : local, name.local);

// A plain name removes every import of that export, an alias only the import under that name.
const removesImport = (name: ImportName, imported: Node, local: Node) =>
  name.imported === name.local
    ? isIdentifier(imported, name.imported)
    : bindsImport(name, imported, local);

type ImportSpecifierNode = E.ImportDeclaration['specifiers'][number];

const isTypeOnly = (declaration: E.ImportDeclaration, specifier: ImportSpecifierNode) =>
  declaration.importKind === 'type' ||
  (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type');

export class ConfigFile implements CsfObject {
  /**
   * Identify the config, meta, story, or call argument this editor represents.
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
   * Find the config object literal in the current parse, or `undefined` for a config made of named
   * exports or one whose config object cannot be located. It is the file's own node, not a copy: do
   * not change it, and read it again after a mutation, which parses the file again.
   *
   * @example
   * ```ts
   * const config = loadConfig('export default definePreview({ tags: [] });').parse();
   * textOf(config.node!); // '{ tags: [] }'
   * ```
   */
  get node(): E.ObjectExpression | undefined {
    const located = locateConfigRoot(this, 'read');
    return located.ok ? located.root.node : undefined;
  }

  /**
   * Read diagnostics from unsupported discovery or mutations. `writeConfig` refuses to write a
   * config with diagnostics, even if another edit succeeded.
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
   * Read a detached copy of the expression at a path of keys and indexes, such as `['addons', 0]`.
   * Missing fields return `undefined`; so does a path that does not fit a value, such as a key into
   * an array, or one a spread, computed key, or duplicate field leaves unproven. `inspect` tells
   * these apart.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'] };").parse();
   * object.get(['tags'])?.type; // 'ArrayExpression'
   * object.get(['missing']); // undefined
   * ```
   */
  get(path: CsfPath): CsfExpression | undefined {
    const reader = this._reader();
    return reader.ok ? reader.object.get(path) : undefined;
  }

  /**
   * Read the expression at a path like `get`, telling a missing field from one that cannot
   * be read statically, and why.
   *
   * @example
   * ```ts
   * const config = loadConfig('export default { tags: [], args: { ...base } };').parse();
   * config.inspect(['tags']).kind; // 'value'
   * config.inspect(['missing']); // { kind: 'missing' }
   * config.inspect(['args', 'size']).kind; // 'unreadable'
   * ```
   */
  inspect(path: CsfPath): CsfInspection {
    const reader = this._reader();
    return reader.ok
      ? reader.object.inspect(path)
      : { kind: 'unreadable', diagnostic: { ...reader.diagnostic, path: [...path] } };
  }

  /**
   * Read plain values without executing code, following local constants. Missing fields and
   * expressions it cannot evaluate, such as calls and functions, return `undefined`.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'], enabled: true };").parse();
   * object.getValue(['tags']); // ['docs']
   * object.getValue(['enabled']); // true
   * object.getValue(['missing']); // undefined
   * ```
   */
  getValue(path: CsfPath): CsfValue {
    const reader = this._reader();
    return reader.ok ? reader.object.getValue(path) : undefined;
  }

  /**
   * Set a plain value or an expression from `get` / `parseExpression`, creating missing parents at
   * keys. An index replaces the element or argument it addresses.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default {};').parse();
   * object.set(['parameters', 'a11y'], { test: 'todo', enabled: true });
   * // { ok: true, changed: true }
   * object.getValue(['parameters']); // { a11y: { test: 'todo', enabled: true } }
   * ```
   */
  set(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
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
    path: CsfPath,
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult {
    return this._mutate((object) => object.transform(path, derive));
  }

  /**
   * Remove a property and recursively clean up the objects it leaves empty. At an index, remove
   * that one element or argument and keep the list, also when it is left empty. Missing fields are
   * a no-op. An index on a field that holds a call addresses the call's arguments, whatever the
   * callee, such as `filter` in `[...].filter(Boolean)`.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default { parameters: { a11y: { disable: true } } };').parse();
   * object.remove(['parameters', 'a11y', 'disable']); // { ok: true, changed: true }
   * object.getValue(['parameters']); // undefined
   * object.remove(['parameters']); // { ok: true, changed: false }
   * ```
   */
  remove(path: CsfPath): CsfMutationResult {
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
  rename(path: CsfPath, name: string): CsfMutationResult {
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
  move(from: CsfPath, to: CsfPath): CsfMutationResult {
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
  group(path: CsfPath, names: readonly string[]): CsfMutationResult {
    return this._mutate((object) => object.group(path, names));
  }

  /**
   * Apply mutations together: when `fn` throws, returns `false`, or any mutation in it returns
   * `{ ok: false }`, every edit made in it is rolled back, those of array and import helpers too.
   * Its diagnostics stay, to report why. Returns whether the edits were kept.
   *
   * @example
   * ```ts
   * const config = loadConfig("export default { layout: 'centered', tags: ['a'] };").parse();
   * config.transaction(() => {
   *   config.remove(['layout']);
   *   config.set(['tags', 'value'], 'b');
   * }); // false: `tags` is an array, so the removal is rolled back too
   * ```
   */
  transaction(fn: () => boolean | void): boolean {
    return this.editor.transaction(fn);
  }

  // The transaction running, if any, resets the flag when it rolls back, also when it was started
  // on `editor` directly.
  _markChanged() {
    if (!this._changed) {
      this._changed = true;
      this.editor._onRollback(() => {
        this._changed = false;
      });
    }
  }

  /**
   * Add a plain value or an expression after the last element of the array, or the last argument
   * of the call, at a path. A missing array is created, carrying the spreads before it forward
   * like a missing parent. A field that holds a call gets an argument, whatever the callee: on
   * `[...].filter(Boolean)` that is an argument of `filter`.
   *
   * @example
   * ```ts
   * const config = loadConfig("export default { addons: ['a'] };").parse();
   * config.append(['addons'], 'b'); // { ok: true, changed: true }
   * config.getValue(['addons']); // ['a', 'b']
   * ```
   */
  append(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    return this._mutate((object) => object.append(path, value));
  }

  /**
   * Add a plain value or an expression before the first element of the array, or the first
   * argument of the call, at a path. A missing array is created like for `append`.
   *
   * @example
   * ```ts
   * const config = loadConfig("export default { addons: ['a'] };").parse();
   * config.prepend(['addons'], 'b'); // { ok: true, changed: true }
   * config.getValue(['addons']); // ['b', 'a']
   * ```
   */
  prepend(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    return this._mutate((object) => object.prepend(path, value));
  }

  _mutate(operation: (object: CsfObject) => CsfMutationResult): CsfMutationResult {
    const editor = createConfigObject(
      this,
      'mutate',
      (diagnostic) => this._mutationDiagnostics.push(diagnostic),
      () => {
        this._markChanged();
      }
    );
    return editor.ok === true ? operation(editor.object) : this._reject(editor.diagnostic);
  }

  _reject(diagnostic: CsfMutationDiagnostic): CsfMutationResult {
    this._mutationDiagnostics.push(diagnostic);
    this.editor._refuse();
    return { ok: false, changed: false, diagnostic };
  }

  _reader() {
    return createConfigObject(
      this,
      'read',
      () => {},
      () => {}
    );
  }

  /** Edit the file's source directly, for edits that have no path. Commit to parse it again. */
  editor: SourceEditor;

  _exports: Record<string, Node> = {};

  // FIXME: this is a hack. this is only used in the case where the user is
  // modifying a named export that's a scalar. The _exports map is not suitable
  // for that. But rather than refactor the whole thing, we just use this as a stopgap.
  _exportDecls: Record<string, E.VariableDeclarator | E.Function> = {};

  _exportsObject: E.ObjectExpression | undefined;

  fileName?: string;

  hasDefaultExport = false;

  constructor(code: string, fileName?: string) {
    this.editor = new SourceEditor(code, fileName, () => {
      this._exports = {};
      this._exportDecls = {};
      this._exportsObject = undefined;
      this.hasDefaultExport = false;
      this.parse();
    });
    this.fileName = fileName;
  }

  /** Read the program of the current parse. */
  get program(): E.Program {
    return this.editor.program;
  }

  /** @deprecated Use `editor`. */
  get _editor(): SourceEditor {
    return this.editor;
  }

  /** @deprecated Use `program`. */
  get _program(): E.Program {
    return this.program;
  }

  get _code(): string {
    return this.editor.code;
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
      const initialization = findVarInitialization(decl.name, this.program);
      return initialization ? unwrapExpression(initialization) : decl;
    }
    return decl;
  };

  parse() {
    walk(this.program, (node, parent) => {
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
            if (isTopLevel && !node.source && !isDeclared(this.editor, spec.local)) {
              throw new EstreeParseError(
                `Export '${localName}' is not defined`,
                this.fileName,
                locationOf(this._code, spec.local.start, spec.local.start)
              );
            }

            const decl =
              _findVarDeclarator(localName, this.program) ??
              this.program.body.find(
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

  /**
   * @deprecated Use `append`, which takes a plain value too, and adds to a call's arguments as
   * well as to an array.
   */
  appendValueToArray(path: string[], value: any): CsfMutationResult {
    return this.appendNodeToArray(path, this.valueToNode(value));
  }

  /**
   * @deprecated Use `append`, which adds to a call's arguments as well as to an array.
   */
  appendNodeToArray(path: string[], node: CsfExpression): CsfMutationResult {
    const array = this._arrayAt(path);
    return array.kind === 'other' ? this._reject(array.diagnostic) : this.append(path, node);
  }

  /**
   * Remove the first entry of the array literal at a path that names `value`: a string, a
   * `{ name }` object, or a call like `getAbsolutePath(value)`. A missing field or entry is a no-op.
   *
   * @deprecated Find the entry's index and `remove([...path, index])` it. `get(path)` returns the
   * field as written, so the index is that of `get(path).elements` for an array literal written
   * at the field, not for a constant it names.
   */
  removeEntryFromArray(path: string[], value: string): CsfMutationResult {
    const current = this.inspect(path);
    if (current.kind === 'unreadable') {
      return this._reject(current.diagnostic);
    }
    const array = this._arrayAt(path);
    if (array.kind === 'other') {
      return this._reject(array.diagnostic);
    }
    const index =
      array.kind === 'missing'
        ? -1
        : array.node.elements.findIndex((element) => {
            if (isStringLiteral(element)) {
              return element.value === value;
            }
            if (element?.type === 'ObjectExpression') {
              const name = this._getPresetValue(element, 'name');
              return name === value;
            }
            return element ? this._getWrappedValue(element) === value : false;
          });
    return index < 0 ? { ok: true, changed: false } : this.remove([...path, index]);
  }

  // The array literal at a path as `getFieldNode` resolves it, through local constants and type
  // assertions, which `append` and `remove` reach as well. A field holding anything else, such as
  // a call, comes with the diagnostic of the array helpers, which refuse it.
  _arrayAt(
    path: string[]
  ):
    | { kind: 'missing' }
    | { kind: 'array'; node: E.ArrayExpression }
    | { kind: 'other'; diagnostic: CsfMutationDiagnostic } {
    const node = this.getFieldNode(path);
    if (!node) {
      return { kind: 'missing' };
    }
    const value = unwrapExpression(node);
    if (value.type === 'ArrayExpression') {
      return { kind: 'array', node: value };
    }
    return {
      kind: 'other',
      diagnostic: {
        code: 'unsupported-value',
        target: this.target,
        path,
        message: `Expected an array literal at '${path.join('.')}', got '${node.type}'`,
        loc: locationOf(this._code, node.start, node.end),
      },
    };
  }

  valueToNode(value: any): CsfExpression {
    return parseExpression(printValue(value, this.editor.quote));
  }

  getBodyDeclarations(): Node[] {
    return this.program.body;
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
        editor: this.editor,
        root: () => {
          // Edits re-parse the file, so the argument is found again by its position among calls.
          const node = findCallArguments(this, options, () => {})[index];
          return node && literalRoot(this.editor, node);
        },
      };
      return createCsfObject(target, host, report, () => {
        this._markChanged();
      });
    });
  }

  /** Appends a statement, given as source, to the end of the file. */
  setBodyDeclaration(declaration: string) {
    appendStatement(this.editor, declaration);
    this.editor.commit();
  }

  /**
   * Add `require` bindings of a module: a string as `const name = require(…)`, an array of names or
   * `'name as alias'` as destructured properties. A binding a top-level `require` of the module has
   * already is skipped. Statements end with `;` unless most statements of the file omit it.
   *
   * @example
   *
   * ```ts
   * // const { foo, bar: baz } = require('bar');
   * setRequireImport(['foo', 'bar as baz'], 'bar');
   *
   * // const foo = require('bar');
   * setRequireImport('foo', 'bar');
   * ```
   *
   * @throws When a name is neither an identifier nor `'name as alias'`.
   */
  setRequireImport(importSpecifier: string[] | string, fromImport: string) {
    const requires = this._findRequires(fromImport);
    const call = requires[0]?.declarations[0].init as E.CallExpression | undefined;
    const source = printString(
      call ? (call.arguments[0] as E.StringLiteral).value : fromImport,
      this.editor.quote
    );
    const end = this.editor.semicolons ? ';' : '';
    const editor = this.editor;
    const ids = requires.map((declaration) => declaration.declarations[0].id);

    if (typeof importSpecifier === 'string') {
      if (!ids.some((id) => isIdentifier(id, importSpecifier))) {
        prependStatement(editor, `const ${importSpecifier} = require(${source})${end}`);
      }
    } else {
      const patterns = ids.filter((id): id is E.ObjectPattern => id.type === 'ObjectPattern');
      const texts = importNames(importSpecifier)
        .filter(
          (name) =>
            !patterns.some((pattern) =>
              pattern.properties.some(
                (property) =>
                  property.type === 'Property' && bindsImport(name, property.key, property.value)
              )
            )
        )
        .map((name) => printImportName(name, ': '));
      // Nothing may follow a rest element.
      const pattern = patterns.find((id) =>
        id.properties.every((property) => property.type === 'Property')
      );
      if (texts.length > 0 && pattern) {
        appendToList(editor, objectList(editor, pattern), texts);
      } else if (texts.length > 0) {
        prependStatement(editor, `const { ${texts.join(', ')} } = require(${source})${end}`);
      }
    }
    this.editor.commit();
  }

  _findRequires(fromImport: string) {
    return this.program.body.filter(
      (node): node is E.VariableDeclaration =>
        node.type === 'VariableDeclaration' &&
        node.declarations.length === 1 &&
        isRequireOf(node.declarations[0].init, fromImport)
    );
  }

  _findImports(fromImport: string) {
    return this.program.body.filter(
      (node): node is E.ImportDeclaration =>
        node.type === 'ImportDeclaration' && isSource(node.source.value, fromImport)
    );
  }

  /**
   * Add import bindings of a module: a string as the default import, an array of names or
   * `'name as alias'` as named imports. A binding a value import of the module has already is
   * skipped; one only a type-only import has becomes a value import. Statements end with `;` unless
   * most statements of the file omit it.
   *
   * @example
   *
   * ```ts
   * // import { foo, bar as baz } from 'bar';
   * setImport(['foo', 'bar as baz'], 'bar');
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
   * @throws When a name is neither an identifier nor `'name as alias'`.
   */
  setImport(importSpecifier: string[] | string | { namespace: string } | null, fromImport: string) {
    const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : [];
    const spelled = this._findImports(fromImport)[0]?.source.value ?? fromImport;
    // A type-only binding of a name to import as a value would clash with it, so it goes.
    this._removeImportSpecifiers(
      fromImport,
      (declaration, specifier) =>
        isTypeOnly(declaration, specifier) &&
        (specifier.type === 'ImportSpecifier'
          ? names.some((name) => bindsImport(name, specifier.imported, specifier.local))
          : specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier)
    );
    this.editor.commit();

    const values = this._findImports(fromImport).filter(
      (declaration) => declaration.importKind !== 'type'
    );
    const editor = this.editor;
    const source = printString(spelled, this.editor.quote);
    const end = this.editor.semicolons ? ';' : '';
    const specifiers = values.flatMap((declaration) =>
      declaration.specifiers.filter((specifier) => !isTypeOnly(declaration, specifier))
    );
    // A clause goes into the first value import without a specifier that blocks it. Otherwise it
    // gets a declaration of its own after the module's value imports, or after all imports, which
    // keeps the module evaluation order.
    const addImport = (
      clause: string,
      merged?: { blockedBy: string; specifiers: { default?: string; named?: string[] } }
    ) => {
      const target =
        merged &&
        values.find(
          (declaration) =>
            !declaration.specifiers.some((specifier) => specifier.type === merged.blockedBy)
        );
      if (target) {
        setImportSpecifiers(editor, target, target.specifiers, merged.specifiers);
      } else if (values.length > 0) {
        insertStatementAfter(editor, values.at(-1)!, `import ${clause} from ${source}${end}`);
      } else {
        insertAfterImports(editor, `import ${clause} from ${source}${end}`);
      }
    };

    // Handle side-effect imports (e.g., import 'foo')
    if (importSpecifier === null) {
      if (values.length === 0) {
        insertAfterImports(editor, `import ${source}${end}`);
      }
      // Handle default imports e.g. import foo from 'bar'
    } else if (typeof importSpecifier === 'string') {
      if (
        !specifiers.some(
          (specifier) =>
            specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier
        )
      ) {
        addImport(importSpecifier, {
          blockedBy: 'ImportDefaultSpecifier',
          specifiers: { default: importSpecifier },
        });
      }
      // Handle named imports e.g. import { foo } from 'bar'
    } else if (Array.isArray(importSpecifier)) {
      const texts = names
        .filter(
          (name) =>
            !specifiers.some(
              (specifier) =>
                specifier.type === 'ImportSpecifier' &&
                bindsImport(name, specifier.imported, specifier.local)
            )
        )
        .map((name) => printImportName(name, ' as '));
      if (texts.length > 0) {
        addImport(`{ ${texts.join(', ')} }`, {
          blockedBy: 'ImportNamespaceSpecifier',
          specifiers: { named: texts },
        });
      }
      // Handle namespace imports e.g. import * as foo from 'bar'
    } else if (
      importSpecifier.namespace &&
      !specifiers.some(
        (specifier) =>
          specifier.type === 'ImportNamespaceSpecifier' &&
          specifier.local.name === importSpecifier.namespace
      )
    ) {
      addImport(`* as ${importSpecifier.namespace}`);
    }
    this.editor.commit();
  }

  // Removes the matching specifiers of a module's imports, and each import left without any.
  _removeImportSpecifiers(
    fromImport: string,
    matches: (declaration: E.ImportDeclaration, specifier: ImportSpecifierNode) => boolean
  ) {
    for (const declaration of this._findImports(fromImport)) {
      const kept = declaration.specifiers.filter((specifier) => !matches(declaration, specifier));
      if (kept.length === 0 && declaration.specifiers.length > 0) {
        removeStatement(this.editor, declaration);
      } else if (kept.length < declaration.specifiers.length) {
        setImportSpecifiers(this.editor, declaration, kept);
      }
    }
  }

  _removeRequireImport(
    importSpecifier: string[] | string | { namespace: string } | null,
    fromImport: string
  ) {
    const editor = this.editor;
    // require() has no side-effect only or namespace forms, so those are skipped.
    const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : undefined;
    for (const declaration of this._findRequires(fromImport)) {
      const { id } = declaration.declarations[0];
      // Handle default requires e.g. const foo = require('bar')
      if (typeof importSpecifier === 'string' && isIdentifier(id, importSpecifier)) {
        removeStatement(editor, declaration);
      }
      // Handle named requires e.g. const { foo, bar } = require('baz')
      if (!names || id.type !== 'ObjectPattern') {
        continue;
      }
      const removed = id.properties.filter(
        (property) =>
          property.type === 'Property' &&
          names.some((name) => removesImport(name, property.key, property.value))
      );
      if (removed.length === id.properties.length) {
        removeStatement(editor, declaration);
      } else if (removed.length > 0) {
        removeFromList(editor, objectList(editor, id), removed);
      }
    }
  }

  _removeImport(
    importSpecifier: string[] | string | { namespace: string } | null,
    fromImport: string
  ) {
    // Remove side-effect imports (e.g., import 'foo') if exact match, else do nothing.
    if (importSpecifier === null) {
      for (const declaration of this._findImports(fromImport)) {
        if (declaration.specifiers.length === 0) {
          removeStatement(this.editor, declaration);
        }
      }
      return;
    }
    const names = Array.isArray(importSpecifier) ? importNames(importSpecifier) : [];
    this._removeImportSpecifiers(fromImport, (declaration, specifier) => {
      if (isTypeOnly(declaration, specifier)) {
        return false;
      }
      // Handle default imports e.g. import foo from 'bar'
      if (typeof importSpecifier === 'string') {
        return (
          specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === importSpecifier
        );
      }
      // Handle named imports e.g. import { foo } from 'bar'
      if (Array.isArray(importSpecifier)) {
        return (
          specifier.type === 'ImportSpecifier' &&
          names.some((name) => removesImport(name, specifier.imported, specifier.local))
        );
      }
      // Handle namespace imports e.g. import * as foo from 'bar'
      return (
        specifier.type === 'ImportNamespaceSpecifier' &&
        specifier.local.name === importSpecifier.namespace
      );
    });
  }

  /**
   * Remove import and `require` bindings of a module: a string removes the default import, an
   * array named imports. A name removes every import of that export, whatever its local name;
   * `'name as alias'` removes only the import under that alias. Type-only imports are left as they
   * are.
   *
   * @example
   *
   * ```ts
   * // import { foo } from 'bar';
   * removeImport(['foo'], 'bar');
   *
   * // import foo from 'bar';
   * removeImport('foo', 'bar');
   *
   * // import * as foo from 'bar';
   * removeImport({ namespace: 'foo' }, 'bar');
   *
   * // import 'bar';
   * removeImport(null, 'bar');
   * ```
   */
  removeImport(
    importSpecifier: string[] | string | { namespace: string } | null,
    fromImport: string
  ) {
    this._removeRequireImport(importSpecifier, fromImport);
    this.editor.commit();
    this._removeImport(importSpecifier, fromImport);
    this.editor.commit();
  }
}

// First object arguments of `importedName.methodName(...)` calls, in source order.
const findCallArguments = (
  config: ConfigFile,
  { importedName, methodName, moduleNames }: CallArgumentsOptions,
  report: (diagnostic: CsfMutationDiagnostic) => void
): E.ObjectExpression[] => {
  const editor = config.editor;
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
 * Print the config with its edits. Untouched code is kept as written, except that every line ends
 * like the first one: CRLF when that is CRLF, `\n` otherwise.
 */
export const printConfig = (config: ConfigFile): PrintResultType => {
  const code = config.editor.toString();
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
  return previewConfig.program.body.some(
    (node) =>
      node.type === 'ImportDeclaration' &&
      node.source.value.includes('storybook') &&
      node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' && isIdentifier(specifier.imported, 'definePreview')
      )
  );
};
