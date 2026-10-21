import {
  type CsfPath,
  type Located,
  type Slot,
  creatable,
  insertAt,
  isInvalidIndex,
  isKey,
  listAt,
  locate,
  printCsfPath,
  unsafePath,
  valueAt,
} from './CsfObjectPath.ts';
import { type Access, lookupMember } from './ObjectMembers.ts';
import { type ObjectRoot, listRoot, literalRoot } from './ObjectRoot.ts';
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
  printValue,
} from './estree/editor.ts';
import {
  type CsfValue,
  UNRESOLVED,
  isEvaluationInert,
  nodeWithoutParse,
  readValue,
  resolveExpression,
} from './estree/values.ts';

export type { CsfValue };

export type CsfObjectTarget =
  | { kind: 'config' }
  | { kind: 'call-argument'; importedName: string; methodName: string }
  | { kind: 'meta' }
  | { kind: 'story'; exportName: string; localName: string };

export type CsfMutationDiagnosticCode =
  | 'unsupported-initializer'
  | 'aliased-story'
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

/** What a diagnostic is about: an editor's object, or the whole file for an edit of its imports. */
export type CsfMutationTarget = CsfObjectTarget | { kind: 'file' };

export interface CsfMutationDiagnostic {
  code: CsfMutationDiagnosticCode;
  target: CsfMutationTarget;
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
 * What `append` and `prepend` would act on at a path: the list they add to, a detached copy of the
 * array literal or, at an item path, the call, whose arguments are its items; a missing one they
 * create; or the diagnostic they would refuse with.
 */
export type CsfListInspection =
  | { kind: 'list'; node: E.ArrayExpression | E.CallExpression }
  | { kind: 'missing' }
  | { kind: 'refused'; diagnostic: CsfMutationDiagnostic };

/**
 * Outcome of a mutation. A refused one leaves the file as it was, also when its edit would leave a
 * file the CSF indexer rejects, such as a meta `tags` that is no longer an array of string literals.
 */
export type CsfMutationResult =
  | { ok: true; changed: boolean }
  | { ok: false; changed: false; diagnostic: CsfMutationDiagnostic };

/** A story's editor, or the diagnostic that says why it has none. */
export type CsfObjectLookup =
  | { ok: true; object: CsfObject }
  | { ok: false; diagnostic: CsfMutationDiagnostic };

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
   * `Story.name = value` assignments, for a CSF factory call without an argument until a write adds
   * it, and once the object is gone. It is the file's own node, not
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
  get(path: CsfPath): CsfExpression | undefined;
  /**
   * Read the expression at a path like `get`, telling a missing field from one that cannot
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
   * Set a plain value or an expression from `get`, `parseExpression` or `parseModule`, creating
   * missing parents at keys. An index replaces the element or argument it addresses.
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
   * Add a plain value or an expression after the last element of the array at a path, or the last
   * argument of the call at an item path such as `['loaders', 0]`. A missing array is created,
   * carrying the spreads before it forward like a missing parent. A field is a list only when it
   * holds an array literal: one that holds a call, such as `[...].filter(Boolean)`, is refused, as
   * an argument of `filter` would be no entry. A method, such as `addons() {}`, is refused as the
   * `Property` it is written as.
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
   * Add a plain value or an expression before the first element of the array at a path, or the
   * first argument of the call at an item path. A missing array is created, and a field holding a
   * call refused, like for `append`.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { addons: ['a'] };").parse();
   * object.prepend(['addons'], 'b'); // { ok: true, changed: true }
   * object.getValue(['addons']); // ['b', 'a']
   * ```
   */
  prepend(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult;
  /**
   * Read what `append` and `prepend` would act on at a path, by the rule they apply, without
   * editing or reporting: the list, `missing` when they would create it, or the diagnostic they
   * would refuse it with. A refusal of the added value, such as `invalid-csf` for an entry that
   * leaves a meta `tags` invalid, is not foreseen.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default { addons: [a], tags: tags() };').parse();
   * object.inspectList(['addons']).kind; // 'list'
   * object.inspectList(['loaders']); // { kind: 'missing' }
   * object.inspectList(['tags']).kind; // 'refused'
   * ```
   */
  inspectList(path: CsfPath): CsfListInspection;
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
    | ({ kind: 'value' } & Slot)
    | { kind: 'missing' }
    | { kind: 'unreadable'; diagnostic: CsfMutationDiagnostic } {
    if (path.length === 0) {
      return { kind: 'missing' };
    }
    if (path.some(isInvalidIndex)) {
      return {
        kind: 'unreadable',
        diagnostic: this.diagnostic('unsupported-member', path, this.anchor()),
      };
    }
    const found = this.locate(path, 'read', false);
    if (found.ok === false) {
      return { kind: 'unreadable', diagnostic: this.diagnostic(found.code, path, found.node) };
    }
    const slot = valueAt(this.editor, found);
    return slot ? { kind: 'value', ...slot } : { kind: 'missing' };
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
    if (inspected.kind === 'item') {
      inspected.parent.replace(inspected.index, text());
      return this.commit(path);
    }
    if (inspected.kind === 'property') {
      inspected.parent.replaceValue(inspected.property, text());
      return this.commit(path);
    }
    const creation = creatable(this.editor, inspected, path, 'when-creating-parents');
    if (!creation.ok) {
      return this.failure(creation.code, path, creation.node, creation.message);
    }
    const key = creation.keys.at(-1)!;
    const printed = text();
    insertAt(this.editor, this.root(), path.slice(0, -1), {
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
    const unprintable = this.unprintable(path, value);
    if (unprintable) {
      return unprintable;
    }
    const list = listAt(this.editor, this.root(), path);
    if (list.ok === false) {
      return this.failure(list.code, path, list.node, list.message);
    }
    const { quote, indent } = this.editor;
    const text = printValue(value, quote, { indent, expand: 'multiline' });
    if (list.kind === 'missing') {
      insertAt(this.editor, this.root(), path, { items: [text], first: end === 'prepend' });
    } else {
      listRoot(this.editor, list.list)[end]([text]);
    }
    return this.commit(path);
  }

  inspectList(path: CsfPath): CsfListInspection {
    const list = listAt(this.editor, this.root(), path);
    if (list.ok === false) {
      const diagnostic = this.diagnostic(list.code, path, list.node, list.message);
      return { kind: 'refused', diagnostic };
    }
    if (list.kind === 'missing') {
      return { kind: 'missing' };
    }
    // `f?.(a)` parses as the chain around the call.
    const copy = readOnly(parseExpression(detachedSource(this.editor, list.list)));
    const node = copy.type === 'ChainExpression' ? copy.expression : copy;
    return { kind: 'list', node: node as E.ArrayExpression | E.CallExpression };
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
    const slot = valueAt(this.editor, inspected);
    if (!slot) {
      return { ok: true, changed: false };
    }
    const value = readOnly(parseExpression(slot.source));
    const derived = derive(value);
    if (!derived || derived === value) {
      return { ok: true, changed: false };
    }
    const unprintable = this.unprintable(path, derived);
    if (unprintable) {
      return unprintable;
    }
    if (inspected.kind === 'item') {
      inspected.parent.replace(inspected.index, detachedTextOf(derived));
    } else if (inspected.kind === 'property') {
      inspected.parent.replaceValue(inspected.property, detachedTextOf(derived));
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
    if (inspected.kind === 'item') {
      // An emptied list stays: `tags: []` is not a missing `tags`.
      inspected.parent.remove(inspected.index);
      return this.commit(path);
    }
    if (inspected.kind !== 'property') {
      return { ok: true, changed: false };
    }
    const removal = lookupMember(this.editor, inspected.parent.properties, inspected.key, 'remove');
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
        `Cannot move ${printCsfPath(from)} to ${printCsfPath(to)}: an element or argument has a position, not a key`
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
    if (source.kind !== 'property') {
      return { ok: true, changed: false };
    }
    const removal = lookupMember(this.editor, source.parent.properties, name, 'remove');
    if (!removal.ok) {
      return this.failure(removal.code, from, removal.node);
    }
    const destination = this.locate(to);
    if (destination.ok === false) {
      return this.failure(destination.code, to, destination.node);
    }
    if (destination.kind === 'property') {
      return this.failure('occupied-destination', to, destination.property);
    }
    const creation = creatable(this.editor, destination, to, 'when-creating-parents');
    if (!creation.ok) {
      return this.failure(creation.code, to, creation.node, creation.message);
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
    insertAt(this.editor, this.root(), to.slice(0, -1), { members: [{ ...moved, key }] });
    const inserted = this.commit(from);
    if (!inserted.ok) {
      return inserted;
    }
    const remaining = this.locate(from);
    if (remaining.ok === false || remaining.kind !== 'property') {
      throw new Error(`CsfObject: ${printCsfPath(from)} was not found again after moving it`);
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
        `Cannot group into ${printCsfPath(path)}: an element or argument has a position, not a key`
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
      const slot = valueAt(this.editor, inspected);
      if (!slot) {
        return { ok: true, changed: false };
      }
      const value = slot.expression && resolveExpression(this.editor.scopes, slot.expression);
      if (value?.type !== 'ObjectExpression') {
        return this.failure('unsupported-member', path, slot.node);
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
    const destination = lookupMember(this.editor, parent.properties, group);
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
      const ancestor = this.locate(path.slice(0, depth));
      if (ancestor.ok === false || ancestor.kind !== 'property' || ancestor.property.method) {
        return;
      }
      const value = resolveExpression(this.editor.scopes, ancestor.property.value);
      if (value?.type !== 'ObjectExpression' || value.properties.length > 0) {
        return;
      }
      if (!lookupMember(this.editor, ancestor.parent.properties, ancestor.key, 'remove').ok) {
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

  private locate(path: CsfPath, access?: Access, edits?: boolean): Located {
    return locate(this.editor, this.root(), path, access, edits);
  }

  // `printValue` would print a node no parse produced as its fields.
  private unprintable(path: CsfPath, value: CsfValue<CsfExpression>) {
    const node = nodeWithoutParse(value);
    return node
      ? this.failure(
          'unsupported-value',
          path,
          this.anchor(),
          `Cannot set ${printCsfPath(path)} to a ${node.type} node that did not come from \`get\`, \`transform\`, \`parseExpression\` or \`parseModule\``
        )
      : undefined;
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
    message = `Cannot mutate ${printCsfPath(path)} because the target contains ${code.replaceAll('-', ' ')}`
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
        `Edited ${printCsfPath(path)}, but the result is not valid CSF: ${reason}`
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
