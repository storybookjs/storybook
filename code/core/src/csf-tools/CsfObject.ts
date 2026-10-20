import {
  type E,
  type Node,
  type Property,
  type SourceLocation,
  type Span,
  isValidIdentifier,
  locationOf,
  parseExpression,
  staticKey,
  unwrapExpression,
} from './estree/ast.ts';
import {
  type SourceEditor,
  appendMembers,
  detachedTextOf,
  groupMembers,
  keySource,
  prependMembers,
  printKey,
  printMembers,
  printString,
  printValue,
  removeMembers,
  renameKey,
  renamedMemberText,
  replaceValue,
} from './estree/editor.ts';
import {
  type CsfValue,
  UNRESOLVED,
  isEvaluationInert,
  nodeWithoutParse,
  placeableValueSource,
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

export interface CsfMutationDiagnostic {
  code: CsfMutationDiagnosticCode;
  target: CsfObjectTarget;
  path: readonly string[];
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
 * Outcome of a mutation. `ok: false` with `changed: true` means the edit was applied but left a file
 * the CSF indexer rejects, such as a meta `tags` that is no longer an array of string literals.
 */
export type CsfMutationResult =
  | { ok: true; changed: boolean }
  | { ok: false; changed: boolean; diagnostic: CsfMutationDiagnostic };

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
   * `Story.name = value` assignments, and once the object is gone. It is the file's own node, not a copy: do not change it, and read it
   * again after a mutation, which parses the file again.
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
   * Read a detached copy of the expression at a property path. Missing fields return `undefined`; so does a path
   * through a value that is not an object literal, or one a spread, computed key, or duplicate field
   * leaves unproven, which also adds a mutation diagnostic.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'] };").parse();
   * object.get(['tags'])?.type; // 'ArrayExpression'
   * object.get(['missing']); // undefined
   * ```
   */
  get(path: readonly string[]): CsfExpression | undefined;
  /**
   * Read the expression at a property path like `get`, telling a missing field from one that cannot
   * be read statically, without adding a mutation diagnostic. Use it for reads that only inform;
   * `get` and `getValue` record why a read failed, which stops `writeConfig`.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default { tags: [], args: { ...base } };').parse();
   * object.inspect(['tags']).kind; // 'value'
   * object.inspect(['missing']); // { kind: 'missing' }
   * object.inspect(['args', 'size']).kind; // 'unreadable'
   * object.mutationDiagnostics; // []
   * ```
   */
  inspect(path: readonly string[]): CsfInspection;
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
  getValue(path: readonly string[]): CsfValue;
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
  set(path: readonly string[], value: CsfValue<CsfExpression>): CsfMutationResult;
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
    path: readonly string[],
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
  remove(path: readonly string[]): CsfMutationResult;
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
  rename(path: readonly string[], name: string): CsfMutationResult;
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
  move(from: readonly string[], to: readonly string[]): CsfMutationResult;
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
  group(path: readonly string[], names: readonly string[]): CsfMutationResult;
}

export interface CsfObjectOptions {
  meta?: boolean;
  stories?: boolean;
}

// `text` is the whole member, including its leading comments.
export interface MemberInsert {
  key: string;
  value: string;
  text: string;
}

// Object literals edit their braces; a config made of named exports edits export declarations.
export interface ObjectRoot {
  readonly properties: readonly E.ObjectPropertyKind[];
  readonly detached: boolean;
  // The object literal itself, when the root is one.
  readonly node?: E.ObjectExpression;
  append(members: MemberInsert[]): void;
  prepend(members: MemberInsert[]): void;
  remove(members: Property[]): void;
  replaceValue(member: Property, text: string): void;
  // `key` is the raw property name.
  rename(member: Property, key: string): void;
  // Replaces contiguous members with `key: { ...members }`.
  group(members: Property[], key: string): void;
  // The member as text to insert elsewhere under another key.
  take(member: Property, key: string): MemberInsert;
}

/**
 * A member of an `ObjectRoot` that is not written as one, such as a named export or a
 * `Story.name = value` assignment. Its key and value are real nodes, so every span a shared helper
 * reads is a real one; the member itself only exists in memory, spanning `statement`.
 */
export const detachedMember = (key: Node, value: Node, computed: boolean, statement: Span) =>
  ({
    type: 'Property',
    kind: 'init',
    method: false,
    shorthand: false,
    computed,
    key,
    value,
    start: statement.start,
    end: statement.end,
  }) as unknown as Property;

export interface CsfObjectHost {
  readonly editor: SourceEditor;
  // Located again after every commit.
  root(): ObjectRoot | undefined;
}

export const literalRoot = (editor: SourceEditor, object: E.ObjectExpression): ObjectRoot => ({
  properties: object.properties,
  detached: false,
  node: object,
  append: (members) =>
    appendMembers(
      editor,
      object,
      members.map((member) => member.text)
    ),
  prepend: (members) =>
    prependMembers(
      editor,
      object,
      members.map((member) => member.text)
    ),
  remove: (members) => removeMembers(editor, object, members),
  replaceValue: (member, text) => replaceValue(editor, member, text),
  rename: (member, key) => renameKey(editor, member, printKey(key, editor.quote)),
  group: (members, key) => groupMembers(editor, object, members, key),
  take: (member, key) => ({
    key,
    value: placeableValueSource(editor, member),
    text: renamedMemberText(editor, object, member, printKey(key, editor.quote)),
  }),
});

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;

type ParentObject = { root: ObjectRoot; node?: E.ObjectExpression };

type PropertyLookup =
  | { ok: true; property?: Property }
  | { ok: false; code: CsfMutationDiagnosticCode; node: Node };

const unsafePath = (path: readonly string[]) => path.includes('__proto__');

// A `set` appends a missing field after every member, so it overrides what they could provide;
// a removal could reveal what an earlier member provides.
type Access = 'read' | 'set' | 'remove';

const lookupProperty = (
  properties: readonly E.ObjectPropertyKind[],
  name: string,
  access: Access = 'read'
): PropertyLookup => {
  const matches: Property[] = [];
  let unknown: { code: CsfMutationDiagnosticCode; node: Node } | undefined;
  let unknownAfterMatch: { code: CsfMutationDiagnosticCode; node: Node } | undefined;

  for (const member of properties) {
    const key = member.type === 'SpreadElement' ? undefined : staticKey(member);
    if (key === undefined) {
      unknown = {
        code: member.type === 'SpreadElement' ? 'spread-field' : 'dynamic-key',
        node: member,
      };
      if (matches.length > 0) {
        unknownAfterMatch = unknown;
      }
      continue;
    }
    if (key !== name) {
      continue;
    }
    if (member.type !== 'Property' || member.kind !== 'init') {
      return { ok: false, code: 'unsupported-member', node: member };
    }
    matches.push(member);
  }

  if (matches.length > 1) {
    return { ok: false, code: 'duplicate-field', node: matches[1] };
  }
  // A member whose key is only known at runtime cannot shadow an explicit property declared after
  // it, but it can shadow one declared before it, and with no explicit property at all it leaves
  // both the value and its absence unproven.
  const unproven =
    unknownAfterMatch ??
    (access === 'remove' || (access === 'read' && matches.length === 0) ? unknown : undefined);
  if (unproven) {
    return { ok: false, code: unproven.code, node: unproven.node };
  }
  return { ok: true, property: matches[0] };
};

// A spread a parent created after it carries forward, with the object literal of the local
// constant it spreads, whose members are known.
type CarriedSpread = { source: string; literal: E.ObjectExpression | undefined };

// A reference reads the same value when it is read again.
const isReference = (node: Node): boolean =>
  node.type === 'Identifier' ||
  (node.type === 'MemberExpression' &&
    !node.computed &&
    !node.optional &&
    node.property.type === 'Identifier' &&
    isReference(node.object));

const carriedSpreads = (
  editor: SourceEditor,
  properties: readonly E.ObjectPropertyKind[]
):
  | { ok: true; spreads: CarriedSpread[] }
  | { ok: false; code: CsfMutationDiagnosticCode; node: Node } => {
  const spreads: CarriedSpread[] = [];
  for (const member of properties) {
    if (member.type !== 'SpreadElement') {
      if (staticKey(member) === undefined) {
        return { ok: false, code: 'dynamic-key', node: member };
      }
      continue;
    }
    const reference = unwrapExpression(member.argument);
    if (!isReference(reference)) {
      return { ok: false, code: 'spread-field', node: member };
    }
    const binding =
      reference.type === 'Identifier' ? editor.scopes.bindingOf(reference) : undefined;
    const init =
      binding?.constant && binding.node.type === 'VariableDeclarator'
        ? unwrapExpression(binding.node.init)
        : undefined;
    // A type assertion stays, so the carried member has the type the spread was given.
    const source = editor.source(member.argument);
    spreads.push({
      source: reference === member.argument ? source : `(${source})`,
      literal: init?.type === 'ObjectExpression' ? init : undefined,
    });
  }
  return { ok: true, spreads };
};

const memberAccess = (key: string, optional: boolean, quote: string) =>
  isValidIdentifier(key, false)
    ? `${optional ? '?.' : '.'}${key}`
    : `${optional ? '?.' : ''}[${printString(key, quote)}]`;

// What an object literal is known to hold at `key`: no member, the value of one, or unknown.
const literalMember = (literal: E.ObjectExpression, key: string) => {
  const lookup = lookupProperty(literal.properties, key);
  if (!lookup.ok || lookup.property?.method) {
    return { kind: 'unknown' as const };
  }
  if (!lookup.property) {
    return { kind: 'missing' as const };
  }
  const value = unwrapExpression(lookup.property.value);
  return { kind: 'value' as const, literal: value.type === 'ObjectExpression' ? value : undefined };
};

// The value the spreads give the member at `keys`, or `undefined` when none gives it one. The last
// spread with the first key replaces what earlier ones give it, which are only read when it may
// lack it, after `??`. A member below the spread's own is read with `?.`, as it may be missing; one
// a local literal lacks is left out.
const carriedValue = (
  spreads: readonly CarriedSpread[],
  keys: readonly string[],
  quote: string
) => {
  const [first, ...rest] = keys;
  const candidates: { expression: string; literal: E.ObjectExpression | undefined }[] = [];
  for (const spread of [...spreads].reverse()) {
    const member = spread.literal ? literalMember(spread.literal, first) : undefined;
    if (member?.kind === 'missing') {
      continue;
    }
    candidates.push({
      expression: `${spread.source}${memberAccess(first, false, quote)}`,
      literal: member?.kind === 'value' ? member.literal : undefined,
    });
    if (member?.kind === 'value') {
      break;
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
  if (candidates.length > 1) {
    const either = candidates.map(({ expression }) => expression).join(' ?? ');
    return rest.length === 0
      ? { expression: either, alternatives: true }
      : {
          expression: `(${either})${rest.map((key) => memberAccess(key, true, quote)).join('')}`,
          alternatives: false,
        };
  }
  let [{ expression, literal }] = candidates;
  for (const key of rest) {
    const member = literal ? literalMember(literal, key) : undefined;
    if (member?.kind === 'missing') {
      return undefined;
    }
    expression += memberAccess(key, !literal, quote);
    literal = member?.kind === 'value' ? member.literal : undefined;
  }
  return { expression, alternatives: false };
};

class CsfObjectEditor implements CsfObject {
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

  get(path: readonly string[]): CsfExpression | undefined {
    const read = this.read(path);
    if (read.kind === 'unreadable') {
      this.reportDiagnostic(read.diagnostic);
    }
    return read.kind === 'value' ? read.node : undefined;
  }

  inspect(path: readonly string[]): CsfInspection {
    const read = this.read(path);
    if (read.kind !== 'outside') {
      return read;
    }
    const name = path.length > 0 ? path.join('.') : 'the object itself';
    const message = `Cannot read ${name}, which is not a field of this ${this.target.kind} object`;
    return {
      kind: 'unreadable',
      diagnostic: this.diagnostic('unsupported-member', path, this.anchor(), message),
    };
  }

  // `get` reads a path outside the object as missing, without a diagnostic.
  private read(path: readonly string[]): CsfInspection | { kind: 'outside' } {
    const found = this.find(path);
    return found.kind === 'property'
      ? { kind: 'value', node: parseExpression(valueSource(this.editor, found.property)) }
      : found;
  }

  getValue(path: readonly string[]): CsfValue {
    const property = this.getProperty(path);
    if (!property) {
      return undefined;
    }
    if (property.method) {
      this.reportDiagnostic(this.diagnostic('unsupported-value', path, property));
      return undefined;
    }
    const value = readValue(this.editor.scopes, property.value);
    if (value === UNRESOLVED) {
      this.reportDiagnostic(this.diagnostic('unsupported-value', path, property.value));
      return undefined;
    }
    return value;
  }

  private find(
    path: readonly string[]
  ):
    | { kind: 'property'; property: Property }
    | { kind: 'missing' }
    | { kind: 'outside' }
    | { kind: 'unreadable'; diagnostic: CsfMutationDiagnostic } {
    if (path.length === 0) {
      return { kind: 'outside' };
    }
    const found = this.locate(path);
    if (found.ok === false) {
      return { kind: 'unreadable', diagnostic: this.diagnostic(found.code, path, found.node) };
    }
    return found.property ? { kind: 'property', property: found.property } : { kind: 'missing' };
  }

  private getProperty(path: readonly string[]): Property | undefined {
    const found = this.find(path);
    if (found.kind === 'unreadable') {
      this.reportDiagnostic(found.diagnostic);
    }
    return found.kind === 'property' ? found.property : undefined;
  }

  set(path: readonly string[], value: CsfValue<CsfExpression>): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const unprintable = nodeWithoutParse(value);
    if (unprintable) {
      return this.failure(
        'unsupported-value',
        path,
        this.anchor(),
        `Cannot set ${path.join('.')} to a ${unprintable.type} node that did not come from \`get\`, \`transform\` or \`parseExpression\``
      );
    }
    const inspected = this.locate(path, 'set');
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (inspected.missing !== undefined && inspected.missing < path.length - 1) {
      const carried = carriedSpreads(this.editor, inspected.parent!.root.properties);
      if (carried.ok === false) {
        return this.failure(carried.code, path, carried.node);
      }
    }
    const { quote, indent } = this.editor;
    const text = printValue(value, quote, { indent, expand: 'multiline' });
    if (inspected.property && inspected.parent) {
      inspected.parent.root.replaceValue(inspected.property, text);
    } else {
      const key = path.at(-1)!;
      this.insert(path.slice(0, -1), {
        members: [{ key, value: text, text: `${printKey(key, quote)}: ${text}` }],
      });
    }
    return this.commit(path);
  }

  // `set` of an array of `items` at a missing path, which carries the spreads before it forward
  // like a missing parent, for appending to the array a spread may provide.
  createArray(path: readonly string[], items: string[]): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.locate(path, 'set');
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (inspected.property) {
      return this.failure('occupied-destination', path, inspected.property);
    }
    const carried = carriedSpreads(this.editor, inspected.parent!.root.properties);
    if (carried.ok === false) {
      return this.failure(carried.code, path, carried.node);
    }
    this.insert(path, { items });
    return this.commit(path);
  }

  transform(
    path: readonly string[],
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.locate(path);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const { property, parent } = inspected;
    if (!property || !parent) {
      return { ok: true, changed: false };
    }
    const value = parseExpression(valueSource(this.editor, property));
    const derived = derive(value);
    if (!derived || derived === value) {
      return { ok: true, changed: false };
    }
    parent.root.replaceValue(property, detachedTextOf(derived));
    return this.commit(path);
  }

  remove(path: readonly string[]): CsfMutationResult {
    if (path.length === 0 || unsafePath(path)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.locate(path);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (!inspected.property || !inspected.parent) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(inspected.parent.root.properties, path.at(-1)!, 'remove');
    if (!removal.ok) {
      return this.failure(removal.code, path, removal.node);
    }
    inspected.parent.root.remove([inspected.property]);
    const removed = this.commit(path);
    if (!removed.ok) {
      return removed;
    }
    return this.removeEmptyParents(path) ?? removed;
  }

  rename(path: readonly string[], name: string): CsfMutationResult {
    const destination = [...path.slice(0, -1), name];
    return this.move(path, destination);
  }

  move(from: readonly string[], to: readonly string[]): CsfMutationResult {
    if (from.length === 0 || to.length === 0 || unsafePath(from) || unsafePath(to)) {
      return this.failure('unsupported-member', from.length === 0 ? from : to, this.anchor());
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
    if (!source.property || !source.parent) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(source.parent.root.properties, from.at(-1)!, 'remove');
    if (!removal.ok) {
      return this.failure(removal.code, from, removal.node);
    }
    const destination = this.locate(to);
    if (destination.ok === false) {
      return this.failure(destination.code, to, destination.node);
    }
    if (destination.property) {
      return this.failure('occupied-destination', to, destination.property);
    }

    const key = to.at(-1)!;
    const sourceParent = from.slice(0, -1);
    const destinationParent = to.slice(0, -1);
    if (
      sourceParent.length === destinationParent.length &&
      sourceParent.every((part, index) => destinationParent[index] === part)
    ) {
      source.parent.root.rename(source.property, key);
      return this.commit(from);
    }

    const moved = source.parent.root.take(source.property, key);
    // Insert first: if that throws, nothing has been committed. The source is removed afterwards,
    // looked up again since the insertion moved its spans.
    this.insert(to.slice(0, -1), { members: [{ ...moved, key }] });
    const inserted = this.commit(from);
    if (!inserted.ok) {
      return inserted;
    }
    const remaining = this.locate(from);
    if (remaining.ok === false || !remaining.property || !remaining.parent) {
      throw new Error(`CsfObject: ${from.join('.')} was not found again after moving it`);
    }
    remaining.parent.root.remove([remaining.property]);
    const removed = this.commit(from);
    if (!removed.ok) {
      return removed;
    }
    return this.removeEmptyParents(from) ?? removed;
  }

  group(path: readonly string[], names: readonly string[]): CsfMutationResult {
    if (path.length === 0 || unsafePath(path) || unsafePath(names)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const group = path.at(-1)!;
    if (names.includes(group)) {
      return this.failure('cyclic-move', path, this.anchor());
    }
    let parent: ObjectRoot = this.root();
    if (path.length > 1) {
      const inspected = this.locate(path.slice(0, -1));
      if (inspected.ok === false) {
        return this.failure(inspected.code, path, inspected.node);
      }
      if (!inspected.property) {
        return { ok: true, changed: false };
      }
      const value = resolveExpression(this.editor.scopes, inspected.property.value);
      if (value?.type !== 'ObjectExpression') {
        return this.failure('unsupported-member', path, inspected.property);
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
  private removeEmptyParents(path: readonly string[]): CsfMutationResult | undefined {
    for (let depth = path.length - 1; depth > 0; depth--) {
      const ancestor = this.locate(path.slice(0, depth));
      if (
        ancestor.ok === false ||
        !ancestor.property ||
        ancestor.property.method ||
        !ancestor.parent
      ) {
        return;
      }
      const value = resolveExpression(this.editor.scopes, ancestor.property.value);
      if (value?.type !== 'ObjectExpression' || value.properties.length > 0) {
        return;
      }
      if (!lookupProperty(ancestor.parent.root.properties, path[depth - 1], 'remove').ok) {
        return;
      }
      ancestor.parent.root.remove([ancestor.property]);
      const committed = this.commit(path);
      if (!committed.ok) {
        return committed;
      }
    }
    return undefined;
  }

  // `access` applies to the last field of the path, and to its parents for a `set`, which creates
  // missing ones; other parents are read.
  private locate(
    path: readonly string[],
    access: Access = 'read'
  ):
    | { ok: true; parent?: ParentObject; property?: Property; missing?: number }
    | { ok: false; code: CsfMutationDiagnosticCode; node: Node } {
    let parent: ParentObject = { root: this.root() };
    let property: Property | undefined;

    for (const [index, name] of path.entries()) {
      const lookup = lookupProperty(
        parent.root.properties,
        name,
        index === path.length - 1 || access === 'set' ? access : 'read'
      );
      if (lookup.ok === false) {
        return lookup;
      }
      property = lookup.property;
      if (!property) {
        return { ok: true, parent, missing: index };
      }
      if (index === path.length - 1) {
        return { ok: true, parent, property };
      }
      if (property.method) {
        return { ok: false, code: 'unsupported-member', node: property };
      }
      const value = resolveExpression(this.editor.scopes, property.value);
      if (value?.type !== 'ObjectExpression') {
        return { ok: false, code: 'unsupported-member', node: property.value };
      }
      parent = { root: literalRoot(this.editor, value), node: value };
    }

    return { ok: true, parent, property };
  }

  // Writes `content` into the object at `containers`, creating the missing ones, which carry the
  // spreads before them forward; the last one is an array for `items`. The caller has validated it.
  private insert(
    containers: readonly string[],
    content: { members: MemberInsert[] } | { items: string[] }
  ) {
    let parent = this.root();
    const { quote, indent } = this.editor;
    const invalidated = () => new Error('CsfObject mutation preflight was invalidated');
    for (const [index, name] of containers.entries()) {
      const lookup = lookupProperty(parent.properties, name, 'set');
      if (lookup.ok === false) {
        throw invalidated();
      }
      if (!lookup.property) {
        const carried = carriedSpreads(this.editor, parent.properties);
        if (carried.ok === false) {
          throw invalidated();
        }
        const missing = containers.slice(index);
        const texts =
          'members' in content ? content.members.map((member) => member.text) : content.items;
        // Comments travel with moved members; a line comment needs the object to span lines.
        const multiline = texts.some((text) => text.includes('\n'));
        const block = (members: string[]) =>
          multiline ? printMembers(members, indent) : `{ ${members.join(', ')} }`;
        const forward = (depth: number, array: boolean) => {
          const value = carriedValue(carried.spreads, missing.slice(0, depth + 1), quote);
          if (!value) {
            return [];
          }
          const { expression, alternatives } = value;
          return [
            array
              ? `...(${expression} ?? [])`
              : `...${alternatives ? `(${expression})` : expression}`,
          ];
        };
        const last = missing.length - 1;
        let nested =
          'members' in content
            ? block([...forward(last, false), ...texts])
            : `[${[...forward(last, true), ...texts].join(', ')}]`;
        for (let depth = last - 1; depth >= 0; depth--) {
          nested = block([
            ...forward(depth, false),
            `${printKey(missing[depth + 1], quote)}: ${nested}`,
          ]);
        }
        parent.append([{ key: name, value: nested, text: `${printKey(name, quote)}: ${nested}` }]);
        return;
      }
      const value = lookup.property.method
        ? undefined
        : resolveExpression(this.editor.scopes, lookup.property.value);
      if (value?.type !== 'ObjectExpression') {
        throw invalidated();
      }
      parent = literalRoot(this.editor, value);
    }
    if (!('members' in content)) {
      throw invalidated();
    }
    parent.append(content.members);
  }

  private anchor(): Node {
    return this.editor.program;
  }

  private diagnostic(
    code: CsfMutationDiagnosticCode,
    path: readonly string[],
    node: Node,
    message = `Cannot mutate ${path.join('.')} because the target contains ${code.replaceAll('-', ' ')}`
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

  private failure(
    code: CsfMutationDiagnosticCode,
    path: readonly string[],
    node: Node,
    message?: string
  ) {
    const diagnostic = this.diagnostic(code, path, node, message);
    this.reportDiagnostic(diagnostic);
    // Unlike a read, a refused mutation rolls back the transaction it runs in.
    this.editor._refuse();
    return { ok: false as const, changed: false as const, diagnostic };
  }

  // The edit stays applied when the file's indexer rejects the committed code: the file is valid
  // JS, so that is a diagnostic rather than an error. Code that does not parse is left pending by
  // the editor, and the error is the caller's.
  private commit(path: readonly string[]): CsfMutationResult {
    if (!this.#changed) {
      this.#changed = true;
      this.editor._transaction?.rollbacks.push(() => {
        this.#changed = false;
      });
    }
    this.markChanged();
    try {
      this.editor.commit();
    } catch (error) {
      if (this.editor.pending) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      const rejected = this.failure(
        'invalid-csf',
        path,
        this.anchor(),
        `Edited ${path.join('.')}, but the result is not valid CSF: ${reason}`
      );
      return { ...rejected, changed: true };
    }
    return { ok: true, changed: true };
  }
}

// Append to an array at a missing field, as `ConfigFile#appendNodeToArray` does.
export const createArray = (object: CsfObject, path: readonly string[], items: string[]) => {
  if (!(object instanceof CsfObjectEditor)) {
    throw new Error('CsfObject: createArray needs an editor of createCsfObject');
  }
  return object.createArray(path, items);
};

export const createCsfObject = (
  target: CsfObjectTarget,
  host: CsfObjectHost,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject => new CsfObjectEditor(target, host, report, markChanged);

export { keySource };
