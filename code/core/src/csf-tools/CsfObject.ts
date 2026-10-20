import { type Access, carriedSpread, carriedSpreads, lookupProperty } from './ObjectMembers.ts';
import { type MemberInsert, type ObjectRoot, literalRoot } from './ObjectRoot.ts';
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
   * duplicate field leaves unproven, which also adds a mutation diagnostic.
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

// `CsfObject` with the mutation `ConfigFile` adds: a new array at a missing field.
export interface CsfObjectEditor extends CsfObject {
  createArray(path: readonly string[], items: string[]): CsfMutationResult;
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

const unsafePath = (path: readonly string[]) => path.includes('__proto__');

class Editor implements CsfObjectEditor {
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
    const property = this.getProperty(path);
    return property && parseExpression(valueSource(this.editor, property));
  }

  // Unlike `get`, which reads the object itself as missing, `inspect` reports it.
  inspect(path: readonly string[]): CsfInspection {
    if (path.length === 0) {
      const message = `Cannot read the object itself, which is not a field of this ${this.target.kind} object`;
      return {
        kind: 'unreadable',
        diagnostic: this.diagnostic('unsupported-member', path, this.anchor(), message),
      };
    }
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
    | { kind: 'unreadable'; diagnostic: CsfMutationDiagnostic } {
    if (path.length === 0) {
      return { kind: 'missing' };
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
      const carried = carriedSpreads(this.editor, inspected.parent.properties);
      if (carried.ok === false) {
        return this.failure(carried.code, path, carried.node);
      }
    }
    const { quote, indent } = this.editor;
    const text = printValue(value, quote, { indent, expand: 'multiline' });
    if (inspected.property) {
      inspected.parent.replaceValue(inspected.property, text);
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
    const carried = carriedSpreads(this.editor, inspected.parent.properties);
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
    if (!property) {
      return { ok: true, changed: false };
    }
    const value = parseExpression(valueSource(this.editor, property));
    const derived = derive(value);
    if (!derived || derived === value) {
      return { ok: true, changed: false };
    }
    parent.replaceValue(property, detachedTextOf(derived));
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
    if (!inspected.property) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(inspected.parent.properties, path.at(-1)!, 'remove');
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
    if (!source.property) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(source.parent.properties, from.at(-1)!, 'remove');
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
      source.parent.rename(source.property, key);
      return this.commit(from);
    }

    const moved = source.parent.take(source.property, key);
    // Insert first: if that throws, nothing has been committed. The source is removed afterwards,
    // looked up again since the insertion moved its spans.
    this.insert(to.slice(0, -1), { members: [{ ...moved, key }] });
    const inserted = this.commit(from);
    if (!inserted.ok) {
      return inserted;
    }
    const remaining = this.locate(from);
    if (remaining.ok === false || !remaining.property) {
      throw new Error(`CsfObject: ${from.join('.')} was not found again after moving it`);
    }
    remaining.parent.remove([remaining.property]);
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
      if (ancestor.ok === false || !ancestor.property || ancestor.property.method) {
        return;
      }
      const value = resolveExpression(this.editor.scopes, ancestor.property.value);
      if (value?.type !== 'ObjectExpression' || value.properties.length > 0) {
        return;
      }
      if (!lookupProperty(ancestor.parent.properties, path[depth - 1], 'remove').ok) {
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
  // missing ones; other parents are read.
  private locate(
    path: readonly string[],
    access: Access = 'read'
  ):
    | { ok: true; parent: ObjectRoot; property?: Property; missing?: number }
    | { ok: false; code: CsfMutationDiagnosticCode; node: Node } {
    let parent = this.root();
    let property: Property | undefined;

    for (const [index, name] of path.entries()) {
      const lookup = lookupProperty(
        parent.properties,
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
      parent = literalRoot(this.editor, value);
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
        const forward = (depth: number, into: 'object' | 'array' = 'object') => {
          const spread = carriedSpread(carried.spreads, missing.slice(0, depth + 1), quote, into);
          return spread ? [spread] : [];
        };
        const last = missing.length - 1;
        let nested =
          'members' in content
            ? block([...forward(last), ...texts])
            : `[${[...forward(last, 'array'), ...texts].join(', ')}]`;
        for (let depth = last - 1; depth >= 0; depth--) {
          nested = block([...forward(depth), `${printKey(missing[depth + 1], quote)}: ${nested}`]);
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

export const createCsfObject = (
  target: CsfObjectTarget,
  host: CsfObjectHost,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObjectEditor => new Editor(target, host, report, markChanged);
