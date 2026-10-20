import {
  type Access,
  carriedSpread,
  carriedSpreads,
  lookupElement,
  lookupProperty,
} from './ObjectMembers.ts';
import {
  type Container,
  type ListRoot,
  type MemberInsert,
  type ObjectRoot,
  isListRoot,
  listRoot,
  literalRoot,
} from './ObjectRoot.ts';
import {
  type E,
  type Node,
  type Property,
  type SourceLocation,
  locationOf,
  parseExpression,
  staticKey,
  unwrapExpression,
} from './estree/ast.ts';
import {
  type SourceEditor,
  detachedSource,
  detachedTextOf,
  printKey,
  printMembers,
  printValue,
} from './estree/editor.ts';
import {
  type CsfValue,
  UNRESOLVED,
  isEvaluationInert,
  nodeWithoutParse,
  readValue,
  resolveExpression,
  valueSource,
} from './estree/values.ts';

export type { CsfValue };

export type CsfObjectTarget =
  | { kind: 'config' }
  | { kind: 'call-argument'; importedName: string; methodName: string }
  | { kind: 'meta' }
  | { kind: 'story'; exportName: string; localName: string };

export type CsfMutationDiagnosticCode =
  | 'unsupported-initializer'
  | 'ambiguous-binding'
  | 'duplicate-field'
  | 'spread-field'
  | 'dynamic-key'
  | 'unsupported-value'
  | 'unsupported-member'
  | 'occupied-destination'
  | 'cyclic-move'
  | 'evaluation-order'
  | 'invalid-csf';

/**
 * A path to a value: a string addresses a property of an object, a number an element of an array
 * or an argument of a call, by its position in the source.
 */
export type CsfPath = readonly (string | number)[];

/** Print a path as `parameters.msw.handlers[0]`. */
export const printPath = (path: CsfPath) =>
  path
    .map((segment, index) =>
      typeof segment === 'number' ? `[${segment}]` : index === 0 ? segment : `.${segment}`
    )
    .join('');

export interface CsfMutationDiagnostic {
  code: CsfMutationDiagnosticCode;
  target: CsfObjectTarget;
  path: CsfPath;
  message: string;
  loc?: SourceLocation;
}

/**
 * What `inspect` found at a path. A path that is not a field of the object, the empty path, is
 * unreadable.
 */
export type CsfInspection =
  | { kind: 'value'; node: CsfExpression }
  | { kind: 'missing' }
  | { kind: 'unreadable'; diagnostic: CsfMutationDiagnostic };

/**
 * Outcome of a mutation. A refused one leaves the file as it was, also when its edit would leave a
 * file the CSF indexer rejects, such as a meta `tags` that is no longer an array of string literals.
 */
export type CsfMutationResult =
  | { ok: true; changed: boolean }
  | { ok: false; changed: false; diagnostic: CsfMutationDiagnostic };

/**
 * An expression detached from any file, as returned by `get` and accepted by `set` and
 * `transform`. It is a plain OXC ESTree node; its source is kept alongside it, so a value read from
 * one file can be written to another without a code generator.
 */
export type CsfExpression = E.Expression;

export interface CsfObject {
  /**
   * Identify the config, meta, story, or call argument this editor represents.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default {};').parse();
   * object.target; // { kind: 'config' }
   * ```
   */
  readonly target: CsfObjectTarget;
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
  readonly changed: boolean;
  /**
   * Find the object literal this editor edits in the current parse. It is `undefined` for a config
   * made of named exports, for a story without an object literal, whose fields are all
   * `Story.name = value` assignments, and once the object is gone. It is the file's own node, not
   * a copy: do not change it, and read it again after a mutation, which parses the file again.
   *
   * @example
   * ```ts
   * const csf = loadCsf('export default {}; export const Primary = { args: {} };', {
   *   makeTitle: () => 'Example',
   * }).parse();
   * const [story] = csf.objects({ meta: false });
   * textOf(story.node!); // '{ args: {} }'
   * ```
   */
  readonly node: E.ObjectExpression | undefined;
  /**
   * Read a detached copy of the expression at a property path. Missing fields return `undefined`;
   * so does a path through a value that is not an object literal, or one a spread, computed key, or
   * duplicate field leaves unproven. `inspect` tells these apart.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'] };").parse();
   * object.get(['tags'])?.type; // 'ArrayExpression'
   * object.get(['missing']); // undefined
   * ```
   */
  get(path: CsfPath): CsfExpression | undefined;
  /**
   * Read the expression at a property path like `get`, telling a missing field from one that cannot
   * be read statically, and why.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default { tags: [], args: { ...base } };').parse();
   * object.inspect(['tags']).kind; // 'value'
   * object.inspect(['missing']); // { kind: 'missing' }
   * object.inspect(['args', 'size']).kind; // 'unreadable'
   * ```
   */
  inspect(path: CsfPath): CsfInspection;
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
  getValue(path: CsfPath): CsfValue;
  /**
   * Set a plain value or an expression from `get` / `parseExpression`, creating missing parents.
   * Expressions can also be nested in the arrays and objects of a plain value.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default {};').parse();
   * object.set(['parameters', 'a11y'], { test: 'todo', enabled: true });
   * // { ok: true, changed: true }
   * object.getValue(['parameters']); // { a11y: { test: 'todo', enabled: true } }
   * ```
   */
  set(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult;
  /**
   * Replace a value derived from its current expression. Return a new expression, or `undefined`
   * (or the input) to leave the value unchanged.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default { args: { count: 1 } };').parse();
   * object.transform(['args', 'count'], (value) =>
   *   parseExpression(`${placeableTextOf(value)} + 1`)
   * ); // { ok: true, changed: true }
   * textOf(object.get(['args', 'count'])!); // '1 + 1'
   * ```
   */
  transform(
    path: CsfPath,
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult;
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
  remove(path: CsfPath): CsfMutationResult;
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
  rename(path: CsfPath, name: string): CsfMutationResult;
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
  move(from: CsfPath, to: CsfPath): CsfMutationResult;
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
  group(path: CsfPath, names: readonly string[]): CsfMutationResult;
  /**
   * Add a plain value or an expression after the last element of the array, or the last argument
   * of the call, at a path. A missing array is created, carrying the spreads before it forward
   * like a missing parent.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { addons: ['a'] };").parse();
   * object.append(['addons'], 'b'); // { ok: true, changed: true }
   * object.getValue(['addons']); // ['a', 'b']
   * ```
   */
  append(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult;
  /**
   * Add a plain value or an expression before the first element of the array, or the first
   * argument of the call, at a path. A missing array is created like for `append`.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { addons: ['a'] };").parse();
   * object.prepend(['addons'], 'b'); // { ok: true, changed: true }
   * object.getValue(['addons']); // ['b', 'a']
   * ```
   */
  prepend(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult;
}

export interface CsfObjectOptions {
  meta?: boolean;
  stories?: boolean;
}

export interface CsfObjectHost {
  readonly editor: SourceEditor;
  // Located again after every commit.
  root(): ObjectRoot | undefined;
}

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;

// `__proto__` would set the prototype, and an index is a position in the source.
const unsafePath = (path: CsfPath) =>
  path.some(
    (segment) =>
      segment === '__proto__' ||
      (typeof segment === 'number' && !(Number.isSafeInteger(segment) && segment >= 0))
  );

const isKey = (segment: string | number): segment is string => typeof segment === 'string';

const invalidated = () => new Error('CsfObject mutation preflight was invalidated');

// A new array: its items go after the spread it carries forward, or before it when `first`.
type ArrayInsert = { items: string[]; first: boolean };

// `missing` is the first segment of the path the source lacks. An item is `null` for a hole and
// `undefined` past the end of its list.
type Located =
  | { ok: true; parent: ObjectRoot; property?: Property; missing?: number }
  | { ok: true; parent: ListRoot; index: number; element?: E.Expression | null; missing?: number }
  | { ok: false; code: CsfMutationDiagnosticCode; node: Node };

// What the segment after a value addresses into it: an object literal's property for a key, an
// array's element or a call's argument for an index.
const containerFor = (
  editor: SourceEditor,
  value: Node | undefined,
  segment: string | number
): Container | undefined => {
  if (typeof segment === 'string') {
    return value?.type === 'ObjectExpression' ? literalRoot(editor, value) : undefined;
  }
  return value?.type === 'ArrayExpression' || value?.type === 'CallExpression'
    ? listRoot(editor, value)
    : undefined;
};

// `set` prints a node from its source, so a change to its fields would be lost: it throws instead.
const readOnly = <T extends object>(node: T): T => {
  for (const value of Object.values(node)) {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      readOnly(value);
    }
  }
  return Object.freeze(node);
};

class Editor implements CsfObject {
  #changed = false;

  readonly target: CsfObjectTarget;

  private readonly host: CsfObjectHost;

  private readonly reportDiagnostic: ReportDiagnostic;

  private readonly markChanged: MarkChanged;

  constructor(
    target: CsfObjectTarget,
    host: CsfObjectHost,
    reportDiagnostic: ReportDiagnostic,
    markChanged: MarkChanged
  ) {
    this.target = target;
    this.host = host;
    this.reportDiagnostic = reportDiagnostic;
    this.markChanged = markChanged;
  }

  get changed() {
    return this.#changed;
  }

  get node() {
    return this.host.root()?.node;
  }

  private get editor() {
    return this.host.editor;
  }

  private root(): ObjectRoot {
    const root = this.host.root();
    if (!root) {
      throw new Error('CsfObject: the edited object no longer exists in the file');
    }
    return root;
  }

  get(path: CsfPath): CsfExpression | undefined {
    const found = this.find(path);
    return found.kind === 'value' ? readOnly(parseExpression(found.source)) : undefined;
  }

  // Unlike `get`, which reads the object itself as missing, `inspect` reports it.
  inspect(path: CsfPath): CsfInspection {
    if (path.length === 0) {
      const message = `Cannot read the object itself, which is not a field of this ${this.target.kind} object`;
      return {
        kind: 'unreadable',
        diagnostic: this.diagnostic('unsupported-member', path, this.anchor(), message),
      };
    }
    const found = this.find(path);
    return found.kind === 'value'
      ? { kind: 'value', node: readOnly(parseExpression(found.source)) }
      : found;
  }

  getValue(path: CsfPath): CsfValue {
    const found = this.find(path);
    if (found.kind !== 'value' || !found.expression) {
      return undefined;
    }
    const value = readValue(this.editor.scopes, found.expression);
    return value === UNRESOLVED ? undefined : value;
  }

  private find(
    path: CsfPath
  ):
    | { kind: 'value'; source: string; expression?: Node }
    | { kind: 'missing' }
    | { kind: 'unreadable'; diagnostic: CsfMutationDiagnostic } {
    if (path.length === 0) {
      return { kind: 'missing' };
    }
    const found = this.locate(path, 'read', false);
    if (found.ok === false) {
      return { kind: 'unreadable', diagnostic: this.diagnostic(found.code, path, found.node) };
    }
    return this.valueAt(found) ?? { kind: 'missing' };
  }

  // The source of the value a path located, and the expression to evaluate, which a method lacks.
  private valueAt(
    located: Extract<Located, { ok: true }>
  ): { kind: 'value'; source: string; expression?: Node } | undefined {
    if ('index' in located) {
      const { element } = located;
      return element
        ? { kind: 'value', source: detachedSource(this.editor, element), expression: element }
        : undefined;
    }
    const { property } = located;
    return property
      ? {
          kind: 'value',
          source: valueSource(this.editor, property),
          ...(property.method ? {} : { expression: property.value }),
        }
      : undefined;
  }

  set(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    return this.atomic(() => this.setValue(path, value));
  }

  private setValue(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const unprintable = this.unprintable(path, value);
    if (unprintable) {
      return unprintable;
    }
    const inspected = this.locate(path, 'set');
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const { quote, indent } = this.editor;
    const text = () => printValue(value, quote, { indent, expand: 'multiline' });
    if ('index' in inspected) {
      if (inspected.element === undefined) {
        return this.cannotCreate(path, inspected.parent.node);
      }
      inspected.parent.replace(inspected.index, text());
      return this.commit(path);
    }
    if (inspected.property) {
      inspected.parent.replaceValue(inspected.property, text());
      return this.commit(path);
    }
    const created = path.slice(inspected.missing);
    if (!created.every(isKey)) {
      return this.cannotCreate(path, inspected.parent.node ?? this.anchor());
    }
    const refused = this.refusedKey(inspected.parent, created[0], path);
    if (refused) {
      return refused;
    }
    if (created.length > 1) {
      const carried = carriedSpreads(this.editor, inspected.parent.properties, created[0]);
      if (carried.ok === false) {
        return this.failure(carried.code, path, carried.node);
      }
    }
    const key = created.at(-1)!;
    const printed = text();
    this.insert(path.slice(0, -1), {
      members: [{ key, value: printed, text: `${printKey(key, quote)}: ${printed}` }],
    });
    return this.commit(path);
  }

  append(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    return this.atomic(() => this.addItem(path, value, 'append'));
  }

  prepend(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    return this.atomic(() => this.addItem(path, value, 'prepend'));
  }

  private addItem(
    path: CsfPath,
    value: CsfValue<CsfExpression>,
    end: 'append' | 'prepend'
  ): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const unprintable = this.unprintable(path, value);
    if (unprintable) {
      return unprintable;
    }
    const inspected = this.locate(path, 'set');
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const { quote, indent } = this.editor;
    const text = () => printValue(value, quote, { indent, expand: 'multiline' });
    const holder = 'index' in inspected ? inspected.element : inspected.property;
    if (!holder) {
      if ('index' in inspected) {
        return this.cannotCreate(path, inspected.parent.node);
      }
      const created = path.slice(inspected.missing);
      if (!created.every(isKey)) {
        return this.cannotCreate(path, inspected.parent.node ?? this.anchor());
      }
      const refused = this.refusedKey(inspected.parent, created[0], path);
      if (refused) {
        return refused;
      }
      const carried = carriedSpreads(this.editor, inspected.parent.properties, created[0]);
      if (carried.ok === false) {
        return this.failure(carried.code, path, carried.node);
      }
      this.insert(path, { items: [text()], first: end === 'prepend' });
      return this.commit(path);
    }
    const node = holder.type === 'Property' ? holder.value : holder;
    const list =
      holder.type === 'Property' && holder.method
        ? undefined
        : resolveExpression(this.editor.scopes, node);
    if (list?.type !== 'ArrayExpression' && list?.type !== 'CallExpression') {
      return this.failure(
        'unsupported-value',
        path,
        node,
        `Expected an array literal or a call at '${printPath(path)}', got '${(list ?? node).type}'`
      );
    }
    listRoot(this.editor, list)[end]([text()]);
    return this.commit(path);
  }

  transform(
    path: CsfPath,
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult {
    return this.atomic(() => this.transformValue(path, derive));
  }

  private transformValue(
    path: CsfPath,
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.locate(path);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const current = this.valueAt(inspected);
    if (!current) {
      return { ok: true, changed: false };
    }
    const value = readOnly(parseExpression(current.source));
    const derived = derive(value);
    if (!derived || derived === value) {
      return { ok: true, changed: false };
    }
    const unprintable = this.unprintable(path, derived);
    if (unprintable) {
      return unprintable;
    }
    if ('index' in inspected) {
      inspected.parent.replace(inspected.index, detachedTextOf(derived));
    } else {
      inspected.parent.replaceValue(inspected.property!, detachedTextOf(derived));
    }
    return this.commit(path);
  }

  remove(path: CsfPath): CsfMutationResult {
    return this.atomic(() => this.removeValue(path));
  }

  private removeValue(path: CsfPath): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.locate(path);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if ('index' in inspected) {
      if (inspected.element === undefined) {
        return { ok: true, changed: false };
      }
      // An emptied list stays: `tags: []` is not a missing `tags`.
      inspected.parent.remove(inspected.index);
      return this.commit(path);
    }
    if (!inspected.property) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(inspected.parent.properties, path.at(-1) as string, 'remove');
    if (!removal.ok) {
      return this.failure(removal.code, path, removal.node);
    }
    inspected.parent.remove([inspected.property]);
    const removed = this.commit(path);
    if (!removed.ok) {
      return removed;
    }
    return this.removeEmptyParents(path) ?? removed;
  }

  rename(path: CsfPath, name: string): CsfMutationResult {
    const destination = [...path.slice(0, -1), name];
    return this.move(path, destination);
  }

  move(from: CsfPath, to: CsfPath): CsfMutationResult {
    return this.atomic(() => this.moveValue(from, to));
  }

  private moveValue(from: CsfPath, to: CsfPath): CsfMutationResult {
    if (from.length === 0 || to.length === 0 || unsafePath(from) || unsafePath(to)) {
      return this.failure('unsupported-member', from.length === 0 ? from : to, this.anchor());
    }
    const name = from.at(-1);
    const key = to.at(-1);
    if (typeof name !== 'string' || typeof key !== 'string') {
      return this.failure(
        'unsupported-member',
        typeof name === 'string' ? to : from,
        this.anchor(),
        `Cannot move ${printPath(from)} to ${printPath(to)}: an element or argument has a position, not a key`
      );
    }
    if (from.length === to.length && from.every((part, index) => to[index] === part)) {
      return { ok: true, changed: false };
    }
    if (to.length > from.length && from.every((part, index) => to[index] === part)) {
      return this.failure('cyclic-move', to, this.anchor());
    }

    const source = this.locate(from);
    if (source.ok === false) {
      return this.failure(source.code, from, source.node);
    }
    if ('index' in source || !source.property) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(source.parent.properties, name, 'remove');
    if (!removal.ok) {
      return this.failure(removal.code, from, removal.node);
    }
    const destination = this.locate(to);
    if (destination.ok === false) {
      return this.failure(destination.code, to, destination.node);
    }
    if ('index' in destination) {
      return this.cannotCreate(to, destination.parent.node);
    }
    if (destination.property) {
      return this.failure('occupied-destination', to, destination.property);
    }
    const created = to.slice(destination.missing);
    if (!created.every(isKey)) {
      return this.cannotCreate(to, destination.parent.node ?? this.anchor());
    }
    const refused = this.refusedKey(destination.parent, created[0], to);
    if (refused) {
      return refused;
    }

    const sourceParent = from.slice(0, -1);
    const destinationParent = to.slice(0, -1);
    if (
      sourceParent.length === destinationParent.length &&
      sourceParent.every((part, index) => destinationParent[index] === part)
    ) {
      source.parent.rename(source.property, key);
      return this.commit(from);
    }

    const moved = source.parent.take(source.property, key);
    // The source is removed after the insertion, looked up again since the insertion moved its spans.
    this.insert(to.slice(0, -1), { members: [{ ...moved, key }] });
    const inserted = this.commit(from);
    if (!inserted.ok) {
      return inserted;
    }
    const remaining = this.locate(from);
    if (remaining.ok === false || 'index' in remaining || !remaining.property) {
      throw new Error(`CsfObject: ${printPath(from)} was not found again after moving it`);
    }
    remaining.parent.remove([remaining.property]);
    const removed = this.commit(from);
    if (!removed.ok) {
      return removed;
    }
    return this.removeEmptyParents(from) ?? removed;
  }

  group(path: CsfPath, names: readonly string[]): CsfMutationResult {
    return this.atomic(() => this.groupValues(path, names));
  }

  private groupValues(path: CsfPath, names: readonly string[]): CsfMutationResult {
    if (path.length === 0 || unsafePath(path) || unsafePath(names)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const group = path.at(-1)!;
    if (!isKey(group)) {
      return this.failure(
        'unsupported-member',
        path,
        this.anchor(),
        `Cannot group into ${printPath(path)}: an element or argument has a position, not a key`
      );
    }
    if (names.includes(group)) {
      return this.failure('cyclic-move', path, this.anchor());
    }
    let parent: ObjectRoot = this.root();
    if (path.length > 1) {
      const inspected = this.locate(path.slice(0, -1));
      if (inspected.ok === false) {
        return this.failure(inspected.code, path, inspected.node);
      }
      const holder = 'index' in inspected ? inspected.element : inspected.property;
      if (!holder) {
        return { ok: true, changed: false };
      }
      const value = resolveExpression(
        this.editor.scopes,
        holder.type === 'Property' ? holder.value : holder
      );
      if (value?.type !== 'ObjectExpression') {
        return this.failure('unsupported-member', path, holder);
      }
      parent = literalRoot(this.editor, value);
    }
    const moved = parent.properties.filter(
      (property): property is Property =>
        property.type !== 'SpreadElement' && names.includes(staticKey(property) ?? '')
    );
    if (moved.length === 0) {
      return { ok: true, changed: false };
    }
    for (const property of parent.properties) {
      if (
        property.type === 'SpreadElement' ||
        property.computed ||
        staticKey(property) === undefined
      ) {
        return this.failure(
          property.type === 'SpreadElement' ? 'spread-field' : 'dynamic-key',
          path,
          property,
          `the configuration contains ${property.type === 'SpreadElement' ? 'a spread property' : 'a computed property'}`
        );
      }
    }
    const sourceNames = new Set<string>();
    for (const property of moved) {
      const name = staticKey(property)!;
      if (property.kind !== 'init' || property.method) {
        return this.failure(
          'unsupported-member',
          path,
          property,
          `the top-level ${name} ${group} option is a method or accessor, not a movable value property`
        );
      }
      if (sourceNames.has(name)) {
        return this.failure('duplicate-field', path, property);
      }
      sourceNames.add(name);
    }
    const destination = lookupProperty(parent.properties, group);
    if (destination.ok === false) {
      return this.failure(
        destination.code,
        path,
        destination.node,
        destination.code === 'duplicate-field'
          ? `the configuration defines ${group} more than once`
          : `the existing ${group} value is not an object literal`
      );
    }
    if (destination.property) {
      const existing = destination.property;
      const value = existing.method ? undefined : unwrapExpression(existing.value);
      if (value?.type !== 'ObjectExpression') {
        return this.failure(
          'unsupported-member',
          path,
          existing,
          `the existing ${group} value is not an object literal`
        );
      }
      for (const property of value.properties) {
        if (
          property.type === 'SpreadElement' ||
          property.computed ||
          staticKey(property) === undefined
        ) {
          return this.failure(
            property.type === 'SpreadElement' ? 'spread-field' : 'dynamic-key',
            path,
            property,
            `the existing ${group} object contains ${property.type === 'SpreadElement' ? 'a spread property' : 'a computed property'}`
          );
        }
        if (property.kind !== 'init' || property.method) {
          return this.failure(
            'unsupported-member',
            path,
            property,
            `the existing ${group} object contains a method or accessor`
          );
        }
      }
      const existingNames = new Set(
        value.properties.map((property) =>
          property.type === 'SpreadElement' ? undefined : staticKey(property)
        )
      );
      for (const property of moved) {
        const name = staticKey(property)!;
        if (existingNames.has(name)) {
          return this.failure(
            'occupied-destination',
            path,
            property,
            `the ${name} option exists at both top level and inside ${group}, where the nested value is authoritative`
          );
        }
        if (!isEvaluationInert(property.value)) {
          return this.failure(
            'evaluation-order',
            path,
            property,
            `the ${name} option has a ${unwrapExpression(property.value).type} value whose relocation into the existing ${group} object could change expression evaluation order`
          );
        }
      }
      literalRoot(this.editor, value).prepend(
        moved.map((property) => parent.take(property, staticKey(property)!))
      );
      parent.remove(moved);
    } else {
      const refused = this.refusedKey(parent, group, path);
      if (refused) {
        return refused;
      }
      if (parent.detached) {
        const effectful = moved.find((property) => !isEvaluationInert(property.value));
        if (effectful) {
          return this.failure(
            'evaluation-order',
            path,
            effectful,
            'Grouping named config exports could change initializer evaluation order'
          );
        }
      }
      // The members a root adds after its object literal, like a story's assignments, run later.
      const inLiteral = (property: Property) => parent.node?.properties.includes(property);
      if (moved.some(inLiteral) && !moved.every(inLiteral)) {
        return this.failure(
          'evaluation-order',
          path,
          moved.find((property) => !inLiteral(property))!,
          `the ${group} options are written both in the object and after it, so grouping them could change expression evaluation order`
        );
      }
      const first = parent.properties.indexOf(moved[0]);
      const last = parent.properties.indexOf(moved.at(-1)!);
      if (last - first + 1 !== moved.length) {
        return this.failure(
          'evaluation-order',
          path,
          moved[1] ?? moved[0],
          `the top-level ${group} options are not contiguous, so grouping them could change expression evaluation order`
        );
      }
      parent.group(moved, group);
    }
    return this.commit(path);
  }

  // Returns the result of a rejected commit, which ends the clean-up.
  // Stops at an element or argument: the list keeps it, as it keeps an emptied list.
  private removeEmptyParents(path: CsfPath): CsfMutationResult | undefined {
    for (let depth = path.length - 1; depth > 0; depth--) {
      const key = path[depth - 1];
      const ancestor = this.locate(path.slice(0, depth));
      if (
        !isKey(key) ||
        ancestor.ok === false ||
        'index' in ancestor ||
        !ancestor.property ||
        ancestor.property.method
      ) {
        return;
      }
      const value = resolveExpression(this.editor.scopes, ancestor.property.value);
      if (value?.type !== 'ObjectExpression' || value.properties.length > 0) {
        return;
      }
      if (!lookupProperty(ancestor.parent.properties, key, 'remove').ok) {
        return;
      }
      ancestor.parent.remove([ancestor.property]);
      const committed = this.commit(path);
      if (!committed.ok) {
        return committed;
      }
    }
    return undefined;
  }

  // `access` applies to the last field of the path, and to its parents for a `set`, which creates
  // missing ones; other parents are read. Only a lookup for a read follows a shared constant.
  private locate(path: CsfPath, access: Access = 'read', edits = true): Located {
    if (!isKey(path[0] ?? '')) {
      return { ok: false, code: 'unsupported-member', node: this.anchor() };
    }
    let parent: Container = this.root();

    for (const [index, segment] of path.entries()) {
      const last = index === path.length - 1;
      let value: Node;
      // `containerFor` chose the parent for this segment.
      if (isListRoot(parent)) {
        const position = segment as number;
        const lookup = lookupElement(parent.items, position);
        if (lookup.ok === false) {
          return lookup;
        }
        const { element } = lookup;
        if (last) {
          return { ok: true, parent, index: position, element };
        }
        if (!element) {
          return { ok: true, parent, index: position, missing: index };
        }
        value = element;
      } else {
        const lookup = lookupProperty(
          parent.properties,
          segment as string,
          last || access === 'set' ? access : 'read'
        );
        if (lookup.ok === false) {
          return lookup;
        }
        const { property } = lookup;
        if (!property) {
          return { ok: true, parent, missing: index };
        }
        if (last) {
          return { ok: true, parent, property };
        }
        if (property.method) {
          return { ok: false, code: 'unsupported-member', node: property };
        }
        value = property.value;
      }
      const resolved = resolveExpression(this.editor.scopes, value, edits ? 'write' : 'read');
      const container = containerFor(this.editor, resolved, path[index + 1]);
      if (!container) {
        return { ok: false, code: 'unsupported-member', node: value };
      }
      parent = container;
    }

    return { ok: true, parent: this.root() };
  }

  // Writes `content` into the object at `containers`, creating the missing ones, which carry the
  // spreads before them forward; the last one is an array for `items`. The caller has validated it.
  private insert(containers: CsfPath, content: { members: MemberInsert[] } | ArrayInsert) {
    let parent: Container = this.root();
    for (const [index, segment] of containers.entries()) {
      let value: Node | undefined;
      if (isListRoot(parent)) {
        const lookup = lookupElement(parent.items, segment as number);
        if (lookup.ok === false || !lookup.element) {
          throw invalidated();
        }
        value = lookup.element;
      } else {
        const name = segment as string;
        const lookup = lookupProperty(parent.properties, name, 'set');
        if (lookup.ok === false) {
          throw invalidated();
        }
        if (!lookup.property) {
          this.create(parent, containers.slice(index), content);
          return;
        }
        value = lookup.property.method ? undefined : lookup.property.value;
      }
      // After the last container come the members, which need an object.
      const next = containers[index + 1] ?? '';
      const container = containerFor(
        this.editor,
        value && resolveExpression(this.editor.scopes, value),
        next
      );
      if (!container) {
        throw invalidated();
      }
      parent = container;
    }
    if (!('members' in content) || isListRoot(parent)) {
      throw invalidated();
    }
    parent.append(content.members);
  }

  // Writes the missing containers at `missing` into `parent`, the first one a member of it, which
  // carry the spreads before them forward.
  private create(
    parent: ObjectRoot,
    missing: CsfPath,
    content: { members: MemberInsert[] } | ArrayInsert
  ) {
    const { quote, indent } = this.editor;
    if (!missing.every(isKey)) {
      throw invalidated();
    }
    const [name] = missing;
    const carried = carriedSpreads(this.editor, parent.properties, name);
    if (carried.ok === false) {
      throw invalidated();
    }
    const texts =
      'members' in content ? content.members.map((member) => member.text) : content.items;
    // Comments travel with moved members; a line comment needs the object to span lines.
    const multiline = texts.some((text) => text.includes('\n'));
    const block = (members: string[]) =>
      multiline ? printMembers(members, indent) : `{ ${members.join(', ')} }`;
    const forward = (depth: number, into: 'object' | 'array' = 'object') => {
      const spread = carriedSpread(carried.spread, missing.slice(0, depth + 1), quote, into);
      return spread ? [spread] : [];
    };
    const last = missing.length - 1;
    let nested: string;
    if ('members' in content) {
      nested = block([...forward(last), ...texts]);
    } else {
      const spread = forward(last, 'array');
      nested = `[${(content.first ? [...texts, ...spread] : [...spread, ...texts]).join(', ')}]`;
    }
    for (let depth = last - 1; depth >= 0; depth--) {
      nested = block([...forward(depth), `${printKey(missing[depth + 1], quote)}: ${nested}`]);
    }
    parent.append([{ key: name, value: nested, text: `${printKey(name, quote)}: ${nested}` }]);
  }

  // `printValue` would print a node no parse produced as its fields.
  private unprintable(path: CsfPath, value: CsfValue<CsfExpression>) {
    const node = nodeWithoutParse(value);
    return node
      ? this.failure(
          'unsupported-value',
          path,
          this.anchor(),
          `Cannot set ${printPath(path)} to a ${node.type} node that did not come from \`get\`, \`transform\` or \`parseExpression\``
        )
      : undefined;
  }

  // Missing values are created only for keys: a position exists in the source or not at all.
  private cannotCreate(path: CsfPath, node: Node) {
    return this.failure(
      'unsupported-member',
      path,
      node,
      `Cannot create ${printPath(path)}: an index addresses an element or argument that exists, and append or prepend adds one`
    );
  }

  private refusedKey(parent: ObjectRoot, key: string, path: CsfPath) {
    const refusal = parent.refuseKey?.(key);
    return refusal ? this.failure('unsupported-member', path, this.anchor(), refusal) : undefined;
  }

  private anchor(): Node {
    return this.editor.program;
  }

  private diagnostic(
    code: CsfMutationDiagnosticCode,
    path: CsfPath,
    node: Node,
    message = `Cannot mutate ${printPath(path)} because the target contains ${code.replaceAll('-', ' ')}`
  ): CsfMutationDiagnostic {
    return {
      code,
      target: this.target,
      path: [...path],
      message,
      ...(node !== this.editor.program
        ? { loc: locationOf(this.editor.code, node.start, node.end) }
        : {}),
    };
  }

  private failure(code: CsfMutationDiagnosticCode, path: CsfPath, node: Node, message?: string) {
    const diagnostic = this.diagnostic(code, path, node, message);
    this.reportDiagnostic(diagnostic);
    // Unlike a read, a refused mutation rolls back the transaction it runs in.
    this.editor._refuse();
    return { ok: false as const, changed: false as const, diagnostic };
  }

  // Runs a mutation in a transaction of its own, so a refused or throwing one leaves the file as
  // it was, also after some of its edits were committed. A refusal still rolls back the
  // transaction around it.
  private atomic(mutation: () => CsfMutationResult): CsfMutationResult {
    let result = { ok: true, changed: false } as CsfMutationResult;
    this.editor.transaction(() => {
      result = mutation();
    });
    if (!result.ok) {
      this.editor._refuse();
    } else if (result.changed) {
      if (!this.#changed) {
        this.#changed = true;
        this.editor._onRollback(() => {
          this.#changed = false;
        });
      }
      this.markChanged();
    }
    return result;
  }

  // A file the indexer rejects is valid JS, so that is a diagnostic rather than an error. Code that
  // does not parse throws, and the error is the caller's.
  private commit(path: CsfPath): CsfMutationResult {
    try {
      this.editor.commit();
    } catch (error) {
      if (this.editor.pending) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      return this.failure(
        'invalid-csf',
        path,
        this.anchor(),
        `Edited ${printPath(path)}, but the result is not valid CSF: ${reason}`
      );
    }
    return { ok: true, changed: true };
  }
}

export const createCsfObject = (
  target: CsfObjectTarget,
  host: CsfObjectHost,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject => new Editor(target, host, report, markChanged);
