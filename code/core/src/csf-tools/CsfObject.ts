import {
  type Access,
  carriedSpread,
  carriedSpreads,
  lookupElement,
  lookupProperty,
} from './ObjectMembers.ts';
import {
  type ListRoot,
  type MemberInsert,
  type ObjectRoot,
  listRoot,
  literalRoot,
} from './ObjectRoot.ts';
import {
  type E,
  type Node,
  type Property,
  type SourceLocation,
  type Span,
  outerSpan,
  parseExpression,
  parseModule,
  staticKey,
  unwrapExpression,
} from './estree/ast.ts';
import {
  type Added,
  type Dependency,
  type SourceEditor,
  type Written,
  adding,
  detachedSource,
  detachedTextOf,
  isPendingAt,
  isRemoved,
  locationIn,
  markStaged,
  objectList,
  printKey,
  printObject,
  printValue,
} from './estree/editor.ts';
import type { ScopeInfo } from './estree/scope.ts';
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

/**
 * A path to a value: a string addresses a property of an object, a number an element of an array
 * or an argument of a call, by its position in the source.
 */
export type CsfPath = readonly (string | number)[];

/** Print a path as `parameters.msw.handlers[0]`. */
export const printCsfPath = (path: CsfPath) =>
  path
    .map((segment, index) =>
      typeof segment === 'number' ? `[${segment}]` : index === 0 ? segment : `.${segment}`
    )
    .join('');

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
   * Add a plain value or an expression after the last element of the array, or the last argument
   * of the call, at a path. A missing array is created, carrying the spreads before it forward
   * like a missing parent. A field that holds a call gets an argument, whatever the callee: on
   * `[...].filter(Boolean)` that is an argument of `filter`. A method, such as `addons() {}`, is
   * refused as the `Property` it is written as.
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
  // What the file's index reads, so that a mutation of it commits to be checked: the values at
  // some paths, and the calls of some names wherever they are.
  readonly index?: { reads(path: CsfPath): boolean; callees: readonly string[] };
}

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;

// An index is a position in the source.
const isInvalidIndex = (segment: string | number) =>
  typeof segment === 'number' && !(Number.isSafeInteger(segment) && segment >= 0);

// `__proto__` would set the prototype.
const unsafePath = (path: CsfPath) =>
  path.some((segment) => segment === '__proto__' || isInvalidIndex(segment));

const isKey = (segment: string | number): segment is string => typeof segment === 'string';

const invalidated = () => new Error('CsfObject mutation preflight was invalidated');

// A commit of pending edits that leaves a file the index rejects, or, outside a mutation, one that
// fails at all.
class Unindexable extends Error {
  constructor(readonly reason: unknown) {
    super(reason instanceof Error ? reason.message : String(reason));
  }
}

// What a lookup is for, which picks the spans its last step depends on: a read and a replacement
// depend on the whole value, a removal on the gaps of the list it removes from, and a write into
// the value on its ends alone.
type Intent = 'read' | 'replace' | 'remove' | 'into';

// A dependency on the ends of a span, which an edit inside it leaves alone.
const ends = ({ start, end }: Span): Dependency[] => [
  { start, end: start },
  { start: end, end },
];

// A lookup that crossed a pending edit, so the edits are committed and it is made again.
const CROSSED = Symbol('crossed');

const IDENTIFIER = /[\p{ID_Start}$_][\p{ID_Continue}$\u200c\u200d]*/gu;

// The raw writes the reference rule found to mention no binding, so they are not read again.
const cleared = new WeakSet<Written>();

// A new array: its items go after the spread it carries forward, or before it when `first`.
type ArrayInsert = { items: string[]; first: boolean };

// Where a path ends: a property or an item, which is `null` for a hole, or the first segment the
// source lacks, a key at `missing` of the path or an item past the end of its list or at a hole
// before the last segment.
type Located =
  | { ok: true; kind: 'property'; parent: ObjectRoot; key: string; property: Property }
  | { ok: true; kind: 'item'; parent: ListRoot; index: number; element: E.Expression | null }
  | { ok: true; kind: 'missing-key'; parent: ObjectRoot; missing: number }
  | { ok: true; kind: 'missing-item'; parent: ListRoot; index: number }
  | { ok: false; code: CsfMutationDiagnosticCode; node: Node };

type Found = Extract<Located, { ok: true }>;

// The value at a property or an item, as `get` reads it: `node` is the property or the element,
// and `expression` the value to evaluate, which a method lacks.
type Slot = { node: Property | E.Expression; source: string; expression?: Node };

// The next segment of a path with the container it addresses.
type Step =
  | { kind: 'object'; parent: ObjectRoot; key: string }
  | { kind: 'list'; parent: ListRoot; index: number };

// An array literal, or a call, also an optional one: `f?.(a)`.
const listNode = (value: Node | undefined) => {
  const node = value?.type === 'ChainExpression' ? value.expression : value;
  return node?.type === 'ArrayExpression' || node?.type === 'CallExpression' ? node : undefined;
};

// A key addresses a property of an object literal, an index an element of an array or an
// argument of a call.
const stepInto = (
  editor: SourceEditor,
  value: Node | undefined,
  segment: string | number
): Step | undefined => {
  if (isKey(segment)) {
    return value?.type === 'ObjectExpression'
      ? { kind: 'object', parent: literalRoot(editor, value), key: segment }
      : undefined;
  }
  const list = listNode(value);
  return list && { kind: 'list', parent: listRoot(editor, list), index: segment };
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

  // Whether a mutation is running, and the first of the batch's writes it made.
  #mutating = false;

  #from = 0;

  // The batch `#from` counts in; another one, such as a commit by other code, starts at 0.
  #batch: unknown;

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
    const node = this.host.root()?.node;
    if (!node || !isPendingAt(this.editor, [node])) {
      return node;
    }
    try {
      this.settle();
    } catch (error) {
      if (!(error instanceof Unindexable)) {
        throw error;
      }
      return node;
    }
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
    // The constants it follows may hold pending edits too.
    const { scopes } = this.editor;
    const followed: Node[] = [];
    const tracking: ScopeInfo = Object.create(scopes, {
      bindingOf: {
        value: (node: Node) => {
          const binding = scopes.bindingOf(node);
          if (binding) {
            followed.push(binding.node);
          }
          return binding;
        },
      },
    });
    const value = readValue(tracking, found.expression);
    if (isPendingAt(this.editor, followed)) {
      try {
        this.settle();
      } catch (error) {
        if (!(error instanceof Unindexable)) {
          throw error;
        }
        return undefined;
      }
      return this.getValue(path);
    }
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
    let found: Located;
    try {
      this.settleRaw();
      found = this.locate(path, 'read', false);
    } catch (error) {
      if (!(error instanceof Unindexable)) {
        throw error;
      }
      const message = `Cannot read ${printCsfPath(path)} because the pending edits do not commit: ${error.message}`;
      return {
        kind: 'unreadable',
        diagnostic: this.diagnostic('invalid-csf', path, this.anchor(), message),
      };
    }
    if (found.ok === false) {
      return { kind: 'unreadable', diagnostic: this.diagnostic(found.code, path, found.node) };
    }
    const slot = this.valueAt(found);
    return slot ? { kind: 'value', ...slot } : { kind: 'missing' };
  }

  private valueAt(located: Found): Slot | undefined {
    if (located.kind === 'item' && located.element) {
      const { element } = located;
      return { node: element, source: detachedSource(this.editor, element), expression: element };
    }
    if (located.kind === 'property') {
      const { property } = located;
      return {
        node: property,
        source: valueSource(this.editor, property),
        ...(property.method ? {} : { expression: property.value }),
      };
    }
    return undefined;
  }

  set(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    return this.atomic(path, () => this.setValue(path, value));
  }

  private setValue(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const unprintable = this.unprintable(path, value);
    if (unprintable) {
      return unprintable;
    }
    const inspected = this.locate(path, 'set', true, 'replace');
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const { quote, indent } = this.editor;
    const text = () => printValue(value, quote, { indent, expand: 'multiline' });
    if (inspected.kind === 'item') {
      inspected.parent.replace(inspected.index, text());
      return this.stage(path);
    }
    if (inspected.kind === 'property') {
      inspected.parent.replaceValue(inspected.property, text());
      return this.stage(path);
    }
    const creatable = this.creatable(inspected, path, (keys) => keys.length > 1);
    if (!creatable.ok) {
      return creatable;
    }
    const key = creatable.keys.at(-1)!;
    const printed = text();
    this.insert(path.slice(0, -1), {
      members: [{ key, value: printed, text: `${printKey(key, quote)}: ${printed}` }],
    });
    return this.stage(path);
  }

  append(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    return this.atomic(path, () => this.addItem(path, value, 'append'));
  }

  prepend(path: CsfPath, value: CsfValue<CsfExpression>): CsfMutationResult {
    return this.atomic(path, () => this.addItem(path, value, 'prepend'));
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
    const inspected = this.locate(path, 'set', true, 'into');
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const { quote, indent } = this.editor;
    const text = () => printValue(value, quote, { indent, expand: 'multiline' });
    const slot = this.valueAt(inspected);
    if (!slot) {
      const creatable = this.creatable(inspected, path, () => true);
      if (!creatable.ok) {
        return creatable;
      }
      this.insert(path, { items: [text()], first: end === 'prepend' });
      return this.stage(path);
    }
    const { scopes } = this.editor;
    const list = slot.expression && listNode(resolveExpression(scopes, slot.expression));
    if (!list) {
      const node = slot.expression ?? slot.node;
      const shared =
        slot.expression && listNode(resolveExpression(scopes, slot.expression, 'read'));
      return this.failure(
        'unsupported-value',
        path,
        node,
        shared
          ? `Cannot add to '${printCsfPath(path)}', a constant that other code refers to as well`
          : `Expected an array literal or a call at '${printCsfPath(path)}', got '${node.type}'`
      );
    }
    const items = listRoot(this.editor, list);
    const texts = [text()];
    const added = end === 'append' ? { into: list, key: Symbol('item') } : undefined;
    if (isPendingAt(this.editor, [...ends(list), ...this.gaps(items.gaps(), added, texts)])) {
      this.settle();
      return this.addItem(path, value, end);
    }
    if (added) {
      adding(this.editor, added, () => items.append(texts));
    } else {
      items.prepend(texts);
    }
    return this.stage(path);
  }

  transform(
    path: CsfPath,
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult {
    return this.atomic(path, () => this.transformValue(path, derive));
  }

  private transformValue(
    path: CsfPath,
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.locate(path, 'read', true, 'read');
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const slot = this.valueAt(inspected);
    if (!slot) {
      return { ok: true, changed: false };
    }
    const value = readOnly(parseExpression(slot.source));
    const parsed = this.editor._module;
    const derived = derive(value);
    if (!derived || derived === value) {
      return { ok: true, changed: false };
    }
    const unprintable = this.unprintable(path, derived);
    if (unprintable) {
      return unprintable;
    }
    // `derive` can read the file, which can commit it.
    const target =
      this.editor._module === parsed ? inspected : this.locate(path, 'read', true, 'read');
    if (target.ok === false || !this.valueAt(target)) {
      throw invalidated();
    }
    if (target.kind === 'item') {
      target.parent.replace(target.index, detachedTextOf(derived));
    } else if (target.kind === 'property') {
      target.parent.replaceValue(target.property, detachedTextOf(derived));
    }
    return this.stage(path);
  }

  remove(path: CsfPath): CsfMutationResult {
    return this.atomic(path, () => this.removeValue(path));
  }

  private removeValue(path: CsfPath): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.locate(path, 'read', true, 'remove');
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (inspected.kind === 'item') {
      // An emptied list stays: `tags: []` is not a missing `tags`.
      inspected.parent.remove(inspected.index);
      return this.stage(path);
    }
    if (inspected.kind !== 'property') {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(
      inspected.parent.properties,
      inspected.key,
      'remove',
      this.editor
    );
    if (!removal.ok) {
      return this.failure(removal.code, path, removal.node);
    }
    inspected.parent.remove([inspected.property]);
    this.removeEmptyParents(path);
    return this.stage(path);
  }

  rename(path: CsfPath, name: string): CsfMutationResult {
    const destination = [...path.slice(0, -1), name];
    return this.move(path, destination);
  }

  move(from: CsfPath, to: CsfPath): CsfMutationResult {
    return this.atomic(from, () => this.moveValue(from, to));
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

    // A lookup that commits leaves the nodes of the lookups before it stale.
    const parsed = this.editor._module;
    const source = this.locate(from, 'read', true, 'read');
    if (source.ok === false) {
      return this.failure(source.code, from, source.node);
    }
    if (source.kind !== 'property') {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(source.parent.properties, name, 'remove', this.editor);
    if (!removal.ok) {
      return this.failure(removal.code, from, removal.node);
    }
    const destination = this.locate(to, 'read', true, 'into');
    if (this.editor._module !== parsed) {
      return this.moveValue(from, to);
    }
    if (destination.ok === false) {
      return this.failure(destination.code, to, destination.node);
    }
    if (destination.kind === 'property') {
      return this.failure('occupied-destination', to, destination.property);
    }
    // A read refuses a missing key next to a spread or computed key, so there is none to carry.
    const creatable = this.creatable(destination, to, () => false);
    if (!creatable.ok) {
      return creatable;
    }

    const sourceParent = from.slice(0, -1);
    const destinationParent = to.slice(0, -1);
    if (
      sourceParent.length === destinationParent.length &&
      sourceParent.every((part, index) => destinationParent[index] === part)
    ) {
      source.parent.rename(source.property, key);
      return this.stage(from, [from, to]);
    }

    const moved = source.parent.take(source.property, key);
    // The source is removed after the insertion, looked up again in case the insertion went into
    // its list, which commits the insertion first.
    this.insert(to.slice(0, -1), { members: [{ ...moved, key }] });
    const remaining = this.locate(from, 'read', true, 'remove');
    if (remaining.ok === false || remaining.kind !== 'property') {
      throw new Error(`CsfObject: ${printCsfPath(from)} was not found again after moving it`);
    }
    remaining.parent.remove([remaining.property]);
    this.removeEmptyParents(from);
    return this.stage(from, [from, to]);
  }

  group(path: CsfPath, names: readonly string[]): CsfMutationResult {
    return this.atomic(path, () => this.groupValues(path, names));
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
      const inspected = this.locate(path.slice(0, -1), 'read', true, 'into');
      if (inspected.ok === false) {
        return this.failure(inspected.code, path, inspected.node);
      }
      const slot = this.valueAt(inspected);
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
    // The members and the destination are read as parsed, so pending edits of them commit first.
    const read = parent.properties.filter(
      (property) => property.type !== 'SpreadElement' && staticKey(property) === group
    );
    if (isPendingAt(this.editor, [...this.members(parent), ...moved, ...read])) {
      this.settle();
      return this.groupValues(path, names);
    }
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
      const into = literalRoot(this.editor, value);
      if (isPendingAt(this.editor, this.members(into))) {
        this.settle();
        return this.groupValues(path, names);
      }
      into.prepend(moved.map((property) => parent.take(property, staticKey(property)!)));
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
    return this.stage(path, [path, ...names.map((name) => [...path.slice(0, -1), name])]);
  }

  // Stops at an element or argument: the list keeps it, as it keeps an emptied list.
  private removeEmptyParents(path: CsfPath) {
    for (let depth = path.length - 1; depth > 0; depth--) {
      const ancestor = this.locate(path.slice(0, depth), 'read', true, 'into');
      if (ancestor.ok === false || ancestor.kind !== 'property' || ancestor.property.method) {
        return;
      }
      const value = resolveExpression(this.editor.scopes, ancestor.property.value);
      if (value?.type !== 'ObjectExpression' || !this.emptied(value)) {
        return;
      }
      if (!lookupProperty(ancestor.parent.properties, ancestor.key, 'remove', this.editor).ok) {
        return;
      }
      if (
        isPendingAt(this.editor, [
          ancestor.property.key,
          ...this.gaps(ancestor.parent.members?.().gaps),
        ])
      ) {
        // Committed, the emptied object is looked up again at the same depth.
        this.settle();
        depth++;
        continue;
      }
      ancestor.parent.remove([ancestor.property]);
    }
  }

  // Whether pending edits removed every member of an object and inserted no other in it. An
  // insert inside a removed span is removed with it.
  private emptied(object: E.ObjectExpression) {
    const { open, close } = objectList(this.editor, object);
    const { touched } = this.editor._batch;
    const inserted = touched.some(
      (written) =>
        written.start === written.end &&
        written.text.trim() !== '' &&
        open <= written.start &&
        written.start <= close &&
        !touched.some((other) => other.start < written.start && written.start < other.end)
    );
    return !inserted && object.properties.every((property) => isRemoved(this.editor, property));
  }

  // `access` applies to the last field of the path, and to its parents for a `set`, which creates
  // missing ones; other parents are read. Only a lookup for a read follows a shared constant. A
  // lookup that crosses a pending edit commits the edits and looks up again.
  private locate(
    path: CsfPath,
    access: Access = 'read',
    edits = true,
    intent: Intent = 'read'
  ): Located {
    const located = this.locateOnce(path, access, edits, intent);
    if (located !== CROSSED) {
      return located;
    }
    this.settle();
    const again = this.locateOnce(path, access, edits, intent);
    if (again === CROSSED) {
      throw new Error(`CsfObject: ${printCsfPath(path)} crossed a pending edit after a commit`);
    }
    return again;
  }

  private locateOnce(
    path: CsfPath,
    access: Access,
    edits: boolean,
    intent: Intent
  ): Located | typeof CROSSED {
    const [first] = path;
    if (typeof first !== 'string') {
      return { ok: false, code: 'unsupported-member', node: this.anchor() };
    }
    let step: Step = { kind: 'object', parent: this.root(), key: first };

    for (let index = 0; ; index++) {
      const last = index === path.length - 1;
      // A step before the last one only goes into the value.
      const purpose = last ? intent : 'into';
      const follow = (node: Node) =>
        resolveExpression(this.editor.scopes, node, edits ? 'write' : 'read');
      let value: Node;
      let resolved: Node | undefined;
      if (step.kind === 'list') {
        const { parent, index: position } = step;
        const lookup = lookupElement(parent.items, position);
        const element = lookup.ok ? lookup.element : undefined;
        resolved = !last && element ? follow(element) : undefined;
        // An item added or removed before it moves a position, so a list's gaps always count.
        const at = element && { whole: outerSpan(element), value: outerSpan(element) };
        if (
          isPendingAt(this.editor, [
            ...parent.gaps(),
            ...this.dependencies(at, purpose, [], resolved),
          ])
        ) {
          return CROSSED;
        }
        if (lookup.ok === false) {
          return lookup;
        }
        if (last && lookup.element !== undefined) {
          return { ok: true, kind: 'item', parent, index: position, element: lookup.element };
        }
        if (!element) {
          return { ok: true, kind: 'missing-item', parent, index: position };
        }
        value = element;
      } else {
        const { parent, key } = step;
        const lookup = lookupProperty(
          parent.properties,
          key,
          last || access === 'set' ? access : 'read',
          this.editor
        );
        const property = lookup.ok ? lookup.property : undefined;
        // The lookup reads the constants of the spreads among the members, which a pending edit
        // may have given the key or taken it from.
        const spreads = this.spreads(parent);
        if (!property) {
          // A pending edit may have added the key.
          const about = this.about(parent, key);
          const keyed = this.members(parent).map(({ start, end }) => ({ start, end, about }));
          if (isPendingAt(this.editor, [...keyed, ...spreads])) {
            return CROSSED;
          }
          return lookup.ok ? { ok: true, kind: 'missing-key', parent, missing: index } : lookup;
        }
        resolved = !last && !property.method ? follow(property.value) : undefined;
        const at = {
          key: property.key,
          whole: property,
          value: property.method ? property : outerSpan(property.value),
        };
        const gaps = purpose === 'remove' ? this.gaps(parent.members?.().gaps) : [];
        if (
          isPendingAt(this.editor, [...this.dependencies(at, purpose, gaps, resolved), ...spreads])
        ) {
          return CROSSED;
        }
        if (last) {
          return { ok: true, kind: 'property', parent, key, property };
        }
        if (property.method) {
          return { ok: false, code: 'unsupported-member', node: property };
        }
        value = property.value;
      }
      const next = stepInto(this.editor, resolved, path[index + 1]);
      if (!next) {
        return { ok: false, code: 'unsupported-member', node: value };
      }
      step = next;
    }
  }

  // Whether a write can create the value a path lacks. Missing values are created only at keys: a
  // position is in the source or nowhere, and a hole is no value to add to. `carries` tells, from
  // the keys to create, whether the first one carries the spreads before it forward.
  private creatable(
    located: Found,
    path: CsfPath,
    carries: (keys: readonly string[]) => boolean
  ): { ok: true; keys: readonly string[] } | Extract<CsfMutationResult, { ok: false }> {
    const keys = located.kind === 'missing-key' ? path.slice(located.missing) : [];
    if (located.kind !== 'missing-key' || !keys.every(isKey)) {
      return this.failure(
        'unsupported-member',
        path,
        located.parent.node ?? this.anchor(),
        `Cannot create ${printCsfPath(path)}: an index addresses an element or argument that exists, and append or prepend adds one`
      );
    }
    const refused = this.refusedKey(located.parent, keys[0], path);
    if (refused) {
      return refused;
    }
    if (carries(keys)) {
      const carried = carriedSpreads(this.editor, located.parent.properties, keys[0]);
      if (carried.ok === false) {
        return this.failure(carried.code, path, carried.node);
      }
    }
    return { ok: true, keys };
  }

  // Writes `content` into the object at `containers`, creating the missing ones, which carry the
  // spreads before them forward; the last one is an array for `items`. The caller has validated it.
  // A write that would not compose with the pending edits of its list commits them first.
  private insert(containers: CsfPath, content: { members: MemberInsert[] } | ArrayInsert): void {
    let object: ObjectRoot | undefined = containers.length === 0 ? this.root() : undefined;
    if (!object) {
      const located = this.locate(containers, 'set', true, 'into');
      if (located.ok && located.kind === 'missing-key') {
        if (!this.create(located.parent, containers.slice(located.missing), content)) {
          this.settle();
          this.insert(containers, content);
        }
        return;
      }
      const slot = located.ok ? this.valueAt(located) : undefined;
      const value = slot?.expression && resolveExpression(this.editor.scopes, slot.expression);
      object = value?.type === 'ObjectExpression' ? literalRoot(this.editor, value) : undefined;
    }
    if (!object || !('members' in content)) {
      throw invalidated();
    }
    const [member] = content.members;
    const added = this.about(object, member.key);
    if (isPendingAt(this.editor, this.gaps(object.members?.().gaps, added, [member.text]))) {
      this.settle();
      this.insert(containers, content);
      return;
    }
    this.appendTo(object, added, [member]);
  }

  // Writes the missing containers at `missing` into `parent`, the first one a member of it, which
  // carry the spreads before them forward. Returns `false`, writing nothing, when the write would
  // not compose with the pending edits of `parent`.
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
    const forward = (depth: number, into: 'object' | 'array' = 'object') => {
      const spread = carriedSpread(carried.spread, missing.slice(0, depth + 1), quote, into);
      return spread ? [spread] : [];
    };
    const last = missing.length - 1;
    let nested: string;
    // Comments travel with moved members; a line comment makes the object span lines.
    if ('members' in content) {
      nested = printObject([...forward(last), ...texts], indent);
    } else {
      const spread = forward(last, 'array');
      nested = `[${(content.first ? [...texts, ...spread] : [...spread, ...texts]).join(', ')}]`;
    }
    for (let depth = last - 1; depth >= 0; depth--) {
      nested = printObject(
        [...forward(depth), `${printKey(missing[depth + 1], quote)}: ${nested}`],
        indent
      );
    }
    const text = `${printKey(name, quote)}: ${nested}`;
    const added = this.about(parent, name);
    if (isPendingAt(this.editor, this.gaps(parent.members?.().gaps, added, [text]))) {
      return false;
    }
    this.appendTo(parent, added, [{ key: name, value: nested, text }]);
    return true;
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
      ...(node !== this.editor.program ? { loc: locationIn(this.editor, node) } : {}),
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
  private atomic(path: CsfPath, mutation: () => CsfMutationResult): CsfMutationResult {
    let result = { ok: true, changed: false } as CsfMutationResult;
    const mutating = this.#mutating;
    this.#mutating = true;
    try {
      this.editor.transaction(() => {
        this.settleRaw();
        this.#batch = this.editor._batch;
        this.#from = this.editor._batch.touched.length;
        result = mutation();
      });
    } catch (error) {
      if (!(error instanceof Unindexable)) {
        throw error;
      }
      result = this.failure(
        'invalid-csf',
        path,
        this.anchor(),
        `Edited ${printCsfPath(path)}, but the result is not valid CSF: ${error.message}`
      );
    } finally {
      this.#mutating = mutating;
    }
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

  // Leaves the mutation's edits pending, unless the index reads a path it changed, `paths`, it
  // declares or removes bindings, it writes into a root that cannot name its member spans, such as
  // the argument a factory call without one gets, which the index sees, its text mentions a binding
  // the proofs count references of or a callee the index reads, it writes lines while an appended
  // statement waits for a commit to be set apart, or the statements it edited no longer parse; then
  // it commits.
  private stage(path: CsfPath, paths: readonly CsfPath[] = [path]): CsfMutationResult {
    const from = this.editor._batch === this.#batch ? this.#from : 0;
    const own = this.editor._batch.touched.slice(from);
    const ownNames = this.target.kind === 'story' ? [this.target.localName] : [];
    const root = this.host.root();
    if (
      paths.some((changed) => this.host.index?.reads(changed)) ||
      root?.declares ||
      !root?.members ||
      (this.editor._appendedWithoutBlankLine.length > 0 &&
        own.some((written) => written.text.includes('\n'))) ||
      this.mentions(own, ownNames) ||
      !this.parses(own)
    ) {
      return this.commit(path);
    }
    markStaged(this.editor, from);
    return { ok: true, changed: true };
  }

  // Whether text written or removed names a module binding other than an import, or a callee the
  // index reads. Proofs such as `onlyRead` count the references of bindings in the tree, which the
  // pending edits are not in. One of `ownNames` heading the text, as in `Story.args = …`, is the
  // object's own assignment, which the lookup of its key finds pending instead.
  private mentions(writes: readonly Written[], ownNames: readonly string[]) {
    if (writes.length === 0) {
      return false;
    }
    const { code } = this.editor;
    const { bindings } = this.editor.scopes.program;
    const callees = this.host.index?.callees ?? [];
    const assigned = (text: string, name: string, index: number) =>
      ownNames.includes(name) &&
      /^[\s;]*$/.test(text.slice(0, index)) &&
      /^\s*[.[]/.test(text.slice(index + name.length));
    return writes.some((written) =>
      [written.text, code.slice(written.start, written.end)].some((text) =>
        [...text.matchAll(IDENTIFIER)].some(({ 0: name, index }) => {
          const binding = bindings.get(name);
          return (
            callees.includes(name) ||
            (!!binding && binding.kind !== 'import' && !assigned(text, name, index))
          );
        })
      )
    );
  }

  // Whether the top-level statements the writes are in parse as edited. One that does not commits,
  // which throws the parse error a commit throws.
  private parses(writes: readonly Written[]) {
    if (writes.length === 0) {
      return true;
    }
    let start = Math.min(...writes.map((written) => written.start));
    let end = Math.max(...writes.map((written) => written.end));
    for (const statement of this.editor.program.body) {
      if (statement.start <= end && start <= statement.end) {
        start = Math.min(start, statement.start);
        end = Math.max(end, statement.end);
      }
    }
    try {
      parseModule(this.editor.edits.slice(start, end), this.editor.fileName);
      return true;
    } catch {
      return false;
    }
  }

  // Commits the pending edits when the edits made on the editor since the last read or mutation
  // name a binding, which changes what discovery and the proofs read.
  private settleRaw() {
    const raw = this.editor._batch.touched.filter(
      (written) => !written.staged && !cleared.has(written)
    );
    if (this.mentions(raw, [])) {
      this.settle();
    } else {
      raw.forEach((written) => cleared.add(written));
    }
  }

  // Commits the pending edits, so lookups see them. Outside a mutation, a commit that fails leaves
  // the editor as it was.
  private settle() {
    if (this.#mutating) {
      try {
        this.editor.commit();
      } catch (error) {
        if (this.editor.pending) {
          throw error;
        }
        throw new Unindexable(error);
      }
    } else {
      try {
        this.editor.transaction(() => {
          this.editor.commit();
        });
      } catch (error) {
        throw new Unindexable(error);
      }
    }
    this.#batch = this.editor._batch;
    this.#from = 0;
  }

  // The spans a step depends on, given the field or item it reaches: its key, and what of it the
  // purpose reads. A read and a replacement depend on all of the value, a removal on the gaps of
  // its list, and a step into the value, also through the constant it follows, on their ends.
  private dependencies(
    at: { key?: Span; whole: Span; value: Span } | null | undefined,
    purpose: Intent,
    gaps: readonly Dependency[],
    resolved: Node | undefined
  ): Dependency[] {
    if (!at) {
      return [];
    }
    const reads = {
      read: [at.whole],
      replace: [at.value],
      remove: gaps,
      into: ends(at.value),
    }[purpose];
    return [...(at.key ? [at.key] : []), ...reads, ...(resolved ? ends(resolved) : [])];
  }

  // The gaps a write to a list writes to, or the whole file for a root that cannot tell. An append
  // depends on them as about the member it adds, so it composes with appends of other members to
  // the same object, unless its text spans lines, which lays the list out again.
  private gaps(
    gaps: readonly Span[] | undefined,
    about?: Added,
    texts: readonly string[] = []
  ): Dependency[] {
    const spans = gaps ?? [{ start: 0, end: this.editor.code.length }];
    const keyed = about && !texts.some((text) => text.includes('\n'));
    return spans.map(({ start, end }) => (keyed ? { start, end, about } : { start, end }));
  }

  // Where a root's members are written: their keys and the gaps around them.
  private members(root: ObjectRoot): Dependency[] {
    const members = root.members?.();
    return members ? [...members.keys, ...members.gaps] : this.gaps(undefined);
  }

  // The member `key` of a root, for a root that names the object its appends add to. A root that
  // cannot name its member spans cannot tell its appends apart either, such as the argument a call
  // without one gets from its first write, so a lookup in it depends on every append to it.
  private about(root: ObjectRoot, key: string): Added | undefined {
    const owner = root.members?.().owner;
    return owner && { into: owner, key };
  }

  private appendTo(root: ObjectRoot, added: Added | undefined, members: MemberInsert[]) {
    if (added) {
      adding(this.editor, added, () => root.append(members));
    } else {
      root.append(members);
    }
  }

  // The constants the spreads among a root's members read, which tell what a member created after
  // them carries forward.
  private spreads(root: ObjectRoot): Dependency[] {
    return root.properties.flatMap((property) => {
      const reference = property.type === 'SpreadElement' && unwrapExpression(property.argument);
      const binding =
        reference && reference.type === 'Identifier'
          ? this.editor.scopes.bindingOf(reference)
          : undefined;
      return binding ? [binding.node] : [];
    });
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
