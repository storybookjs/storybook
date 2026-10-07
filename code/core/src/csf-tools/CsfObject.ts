import {
  type E,
  type Node,
  type Property,
  type SourceLocation,
  isIdentifier,
  isNode,
  isNumericLiteral,
  locationOf,
  expressionFromSource,
  staticKey,
  textOf,
  unwrapExpression,
} from './estree/ast.ts';
import {
  type SourceEditor,
  appendMembers,
  functionFromMethod,
  keySource,
  memberText,
  prependMembers,
  printKey,
  printValue,
  removeMembers,
  renameKey,
  renamedMemberText,
  replaceValue,
  separatorBefore,
} from './estree/editor.ts';

export type CsfObjectTarget =
  | { kind: 'config' }
  | { kind: 'call-argument'; importedName: string; methodName: string }
  | { kind: 'meta' }
  | { kind: 'story'; exportName: string; localName: string }
  | {
      kind: 'story-annotation';
      exportName: string;
      localName: string;
      annotation: 'parameters';
    };

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
  | 'evaluation-order';

export interface CsfMutationDiagnostic {
  code: CsfMutationDiagnosticCode;
  target: CsfObjectTarget;
  path: readonly string[];
  message: string;
  loc?: SourceLocation;
}

export type CsfMutationResult =
  | { ok: true; changed: boolean }
  | { ok: false; changed: false; diagnostic: CsfMutationDiagnostic };

export type CsfValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly CsfValue[]
  | { readonly [key: string]: CsfValue };

/**
 * An expression detached from any file, as returned by `get` and accepted by `set` and
 * `transform`. It is a plain OXC ESTree node; its source is kept alongside it, so a value read from
 * one file can be written to another without a code generator.
 */
export type CsfExpression = E.Expression;

/**
 * Parse source into a detached expression for `set` and `transform`.
 *
 * @example
 * ```ts
 * object.transform(['tags'], (value) => parseExpression(`[...${printExpression(value)}, 'autodocs']`));
 * ```
 */
export const parseExpression = (code: string): CsfExpression => expressionFromSource(code);

/** Source of an expression returned by `get` or `parseExpression`, or of any node inside one. */
export const printExpression = (node: Node): string => {
  const source = textOf(node);
  if (source === undefined) {
    throw new Error(
      'CsfObject: expressions must come from `get`, `transform` or `parseExpression`'
    );
  }
  return source;
};

export interface CsfObject {
  /**
   * Identify the config, meta, story, annotation, or call argument this editor represents.
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
   * Read a detached copy of the expression at a property path. Missing fields return `undefined`.
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
   *
   * @example
   * ```ts
   * const object = loadConfig('export default {};').parse();
   * object.set(['parameters', 'a11y'], { test: 'todo', enabled: true });
   * // { ok: true, changed: true }
   * object.getValue(['parameters']); // { a11y: { test: 'todo', enabled: true } }
   * ```
   */
  set(path: readonly string[], value: CsfValue | CsfExpression): CsfMutationResult;
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

/** A member to insert: its key, value source, and full text (which may carry comments). */
export interface MemberInsert {
  key: string;
  value: string;
  text: string;
}

/**
 * Object-shaped edit target. Object literals edit their braces; a config made of named exports
 * edits export declarations instead.
 */
export interface ObjectRoot {
  readonly properties: readonly E.ObjectPropertyKind[];
  readonly detached: boolean;
  append(members: MemberInsert[]): void;
  prepend(members: MemberInsert[]): void;
  remove(members: Property[]): void;
  replaceValue(member: Property, text: string): void;
  /** Renames a member; `key` is the raw property name. */
  rename(member: Property, key: string): void;
  /** Replaces contiguous members with `key: { ...members }`. */
  group(members: Property[], key: string): void;
  /** The member as text to insert elsewhere under another key. */
  take(member: Property, key: string): MemberInsert;
}

export interface CsfObjectHost {
  readonly editor: SourceEditor;
  /** The root of this editor in the current source, located again after every commit. */
  root(): ObjectRoot | undefined;
  /** Applies pending edits and refreshes the host's parsed state. */
  commit(): void;
}

export const literalRoot = (editor: SourceEditor, object: E.ObjectExpression): ObjectRoot => ({
  properties: object.properties,
  detached: false,
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
  group: (members, key) => {
    const texts = members.map((member) => memberText(editor, object, member));
    const first = object.properties.indexOf(members[0]);
    const multiline = editor.code.slice(object.start, object.end).includes('\n');
    removeMembers(editor, object, members.slice(1));
    const before = editor.code.slice(0, members[0].start);
    const indent = /[ \t]*$/.exec(before.slice(before.lastIndexOf('\n') + 1))![0];
    const inner = multiline
      ? `{\n${texts.map((text) => `${indent}  ${text.split('\n').join(`\n${indent}  `)},`).join('\n')}\n${indent}}`
      : `{ ${texts.join(', ')} }`;
    // Leading comments of the first member move into the group with it.
    const start = separatorBefore(editor.code, object, first);
    const lead = multiline ? `\n${indent}` : ' ';
    editor.edits.overwrite(
      start,
      members[0].end,
      `${lead}${printKey(key, editor.quote)}: ${inner}`
    );
  },
  take: (member, key) => ({
    key,
    value: valueSource(editor, member),
    text: renamedMemberText(editor, object, member, printKey(key, editor.quote)),
  }),
});

/** Source of a member's value as an expression; methods become function expressions. */
export const valueSource = (editor: SourceEditor, member: Property) =>
  member.method || member.kind !== 'init'
    ? functionFromMethod(editor, member)
    : editor.source(member.value);

const UNRESOLVED = Symbol('unresolved');

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;

type ParentObject = { root: ObjectRoot; node?: E.ObjectExpression };

type PropertyLookup =
  | { ok: true; property?: Property }
  | { ok: false; code: CsfMutationDiagnosticCode; node: Node };

const unsafePath = (path: readonly string[]) => path.includes('__proto__');

const lookupProperty = (
  properties: readonly E.ObjectPropertyKind[],
  name: string,
  removing = false
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
  const unproven = unknownAfterMatch ?? (removing || matches.length === 0 ? unknown : undefined);
  if (unproven) {
    return { ok: false, code: unproven.code, node: unproven.node };
  }
  return { ok: true, property: matches[0] };
};

const isEvaluationInert = (node: Node): boolean => {
  const value = unwrapExpression(node);
  if (value.type === 'TemplateLiteral') {
    return value.expressions.length === 0;
  }
  if (
    value.type === 'Literal' ||
    value.type === 'FunctionExpression' ||
    value.type === 'ArrowFunctionExpression'
  ) {
    return true;
  }
  if (value.type === 'UnaryExpression') {
    return ['!', 'void', 'typeof'].includes(value.operator)
      ? isEvaluationInert(value.argument)
      : isNumericLiteral(unwrapExpression(value.argument));
  }
  if (value.type === 'ArrayExpression') {
    return value.elements.every((element) => element === null || isEvaluationInert(element));
  }
  if (value.type === 'ObjectExpression') {
    return value.properties.every(
      (property) =>
        property.type === 'Property' &&
        property.kind === 'init' &&
        !property.method &&
        !property.computed &&
        staticKey(property) !== undefined &&
        isEvaluationInert(property.value)
    );
  }
  return false;
};

class CsfObjectEditor implements CsfObject {
  #changed = false;

  readonly target: CsfObjectTarget;

  private readonly host: CsfObjectHost;

  private readonly prefix: readonly string[];

  private readonly reportDiagnostic: ReportDiagnostic;

  private readonly markChanged: MarkChanged;

  constructor(
    target: CsfObjectTarget,
    host: CsfObjectHost,
    prefix: readonly string[],
    reportDiagnostic: ReportDiagnostic,
    markChanged: MarkChanged
  ) {
    this.target = target;
    this.host = host;
    this.prefix = prefix;
    this.reportDiagnostic = reportDiagnostic;
    this.markChanged = markChanged;
  }

  get changed() {
    return this.#changed;
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
    const found = this.getProperty(path);
    return found ? parseExpression(valueSource(this.editor, found)) : undefined;
  }

  getValue(path: readonly string[]): CsfValue {
    const property = this.getProperty(path);
    if (!property) {
      return undefined;
    }
    if (property.method) {
      this.failure('unsupported-value', path, property);
      return undefined;
    }
    const value = this.readValue(property.value);
    if (value === UNRESOLVED) {
      this.failure('unsupported-value', path, property.value);
      return undefined;
    }
    return value;
  }

  private getProperty(path: readonly string[]): Property | undefined {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath) {
      return undefined;
    }
    const found = this.inspect(logicalPath);
    if (found.ok === false) {
      this.failure(found.code, path, found.node);
      return undefined;
    }
    return found.property;
  }

  private sourceFor(value: CsfValue | CsfExpression) {
    return isNode(value) && textOf(value) !== undefined
      ? printExpression(value as CsfExpression)
      : printValue(value, this.editor.quote);
  }

  set(path: readonly string[], value: CsfValue | CsfExpression): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0 || unsafePath(logicalPath)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.inspect(logicalPath);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const text = this.sourceFor(value);
    if (inspected.property && inspected.parent) {
      inspected.parent.root.replaceValue(inspected.property, text);
    } else {
      this.insert(logicalPath, [
        {
          key: logicalPath.at(-1)!,
          value: text,
          text: `${printKey(logicalPath.at(-1)!, this.editor.quote)}: ${text}`,
        },
      ]);
    }
    return this.success();
  }

  transform(
    path: readonly string[],
    derive: (value: CsfExpression) => CsfExpression | undefined
  ): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0 || unsafePath(logicalPath)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.inspect(logicalPath);
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
    parent.root.replaceValue(property, printExpression(derived));
    return this.success();
  }

  remove(path: readonly string[]): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0 || unsafePath(logicalPath)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const inspected = this.inspect(logicalPath);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (!inspected.property || !inspected.parent) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(inspected.parent.root.properties, logicalPath.at(-1)!, true);
    if (!removal.ok) {
      return this.failure(removal.code, path, removal.node);
    }
    inspected.parent.root.remove([inspected.property]);
    this.commit();
    this.removeEmptyParents(logicalPath);
    return this.success();
  }

  rename(path: readonly string[], name: string): CsfMutationResult {
    const destination = [...path.slice(0, -1), name];
    return this.move(path, destination);
  }

  move(from: readonly string[], to: readonly string[]): CsfMutationResult {
    const sourcePath = this.normalizePath(from);
    const destinationPath = this.normalizePath(to);
    if (
      !sourcePath ||
      !destinationPath ||
      sourcePath.length === 0 ||
      destinationPath.length === 0 ||
      unsafePath(sourcePath) ||
      unsafePath(destinationPath)
    ) {
      return this.failure('unsupported-member', !sourcePath ? from : to, this.anchor());
    }
    if (
      sourcePath.length === destinationPath.length &&
      sourcePath.every((part, index) => destinationPath[index] === part)
    ) {
      return { ok: true, changed: false };
    }
    if (
      destinationPath.length > sourcePath.length &&
      sourcePath.every((part, index) => destinationPath[index] === part)
    ) {
      return this.failure('cyclic-move', to, this.anchor());
    }

    const source = this.inspect(sourcePath);
    if (source.ok === false) {
      return this.failure(source.code, from, source.node);
    }
    if (!source.property || !source.parent) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(source.parent.root.properties, sourcePath.at(-1)!, true);
    if (!removal.ok) {
      return this.failure(removal.code, from, removal.node);
    }
    const destination = this.inspect(destinationPath);
    if (destination.ok === false) {
      return this.failure(destination.code, to, destination.node);
    }
    if (destination.property) {
      return this.failure('occupied-destination', to, destination.property);
    }

    const key = destinationPath.at(-1)!;
    const sourceParent = sourcePath.slice(0, -1);
    const destinationParent = destinationPath.slice(0, -1);
    if (
      sourceParent.length === destinationParent.length &&
      sourceParent.every((part, index) => destinationParent[index] === part)
    ) {
      source.parent.root.rename(source.property, key);
      return this.success();
    }

    const moved = source.parent.root.take(source.property, key);
    source.parent.root.remove([source.property]);
    this.commit();
    this.insert(destinationPath, [{ ...moved, key }]);
    this.commit();
    this.removeEmptyParents(sourcePath);
    return this.success();
  }

  group(path: readonly string[], names: readonly string[]): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0 || unsafePath(logicalPath) || unsafePath(names)) {
      return this.failure('unsupported-member', path, this.anchor());
    }
    const group = logicalPath.at(-1)!;
    if (names.includes(group)) {
      return this.failure('cyclic-move', path, this.anchor());
    }
    let parent: ObjectRoot = this.root();
    if (logicalPath.length > 1) {
      const inspected = this.inspect(logicalPath.slice(0, -1));
      if (inspected.ok === false) {
        return this.failure(inspected.code, path, inspected.node);
      }
      if (!inspected.property) {
        return { ok: true, changed: false };
      }
      const value = this.resolveExpression(inspected.property.value);
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
    return this.success();
  }

  private removeEmptyParents(path: readonly string[]) {
    for (let depth = path.length - 1; depth > 0; depth--) {
      const ancestor = this.inspect(path.slice(0, depth));
      if (
        ancestor.ok === false ||
        !ancestor.property ||
        ancestor.property.method ||
        !ancestor.parent
      ) {
        return;
      }
      const value = this.resolveExpression(ancestor.property.value);
      if (value?.type !== 'ObjectExpression' || value.properties.length > 0) {
        return;
      }
      if (!lookupProperty(ancestor.parent.root.properties, path[depth - 1], true).ok) {
        return;
      }
      ancestor.parent.root.remove([ancestor.property]);
      this.commit();
    }
  }

  private normalizePath(path: readonly string[]) {
    if (this.prefix.length === 0) {
      return [...path];
    }
    if (
      path.length < this.prefix.length ||
      this.prefix.some((part, index) => path[index] !== part)
    ) {
      return undefined;
    }
    return path.slice(this.prefix.length);
  }

  private readValue(node: Node): CsfValue | typeof UNRESOLVED {
    const value = this.resolveExpression(node);
    if (!value) {
      return UNRESOLVED;
    }
    if (value.type === 'Literal') {
      if ('regex' in value || 'bigint' in value) {
        return UNRESOLVED;
      }
      return (value as E.StringLiteral | E.NumericLiteral | E.BooleanLiteral | E.NullLiteral).value;
    }
    if (value.type === 'Identifier') {
      return value.name === 'undefined' ? undefined : UNRESOLVED;
    }
    if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
      return value.quasis[0].value.cooked ?? UNRESOLVED;
    }
    if (value.type === 'UnaryExpression') {
      const argument = this.readValue(value.argument);
      if (typeof argument !== 'number') {
        return UNRESOLVED;
      }
      if (value.operator === '-') {
        return -argument;
      }
      return value.operator === '+' ? argument : UNRESOLVED;
    }
    if (value.type === 'ArrayExpression') {
      const elements: CsfValue[] = [];
      for (const element of value.elements) {
        if (!element) {
          elements.length++;
          continue;
        }
        const item = this.readValue(element.type === 'SpreadElement' ? element.argument : element);
        if (item === UNRESOLVED) {
          return UNRESOLVED;
        }
        if (element.type === 'SpreadElement') {
          if (!Array.isArray(item)) {
            return UNRESOLVED;
          }
          elements.push(...item);
        } else {
          elements.push(item);
        }
      }
      return elements;
    }
    if (value.type === 'ObjectExpression') {
      const entries: [string, CsfValue][] = [];
      for (const property of value.properties) {
        if (property.type === 'SpreadElement') {
          const spread = this.readValue(property.argument);
          if (typeof spread !== 'object' || spread === null || Array.isArray(spread)) {
            return UNRESOLVED;
          }
          entries.push(...Object.entries(spread));
          continue;
        }
        const key = staticKey(property);
        if (
          property.kind !== 'init' ||
          property.method ||
          key === undefined ||
          (key === '__proto__' && !property.computed)
        ) {
          return UNRESOLVED;
        }
        const item = this.readValue(property.value);
        if (item === UNRESOLVED) {
          return UNRESOLVED;
        }
        entries.push([key, item]);
      }
      return Object.fromEntries(entries);
    }
    return UNRESOLVED;
  }

  private resolveExpression(node: Node): Node | undefined {
    let value = unwrapExpression(node);
    const visited = new Set<Node>();
    while (isIdentifier(value) && !visited.has(value)) {
      visited.add(value);
      const binding = this.editor.scopes.bindingOf(value);
      if (!binding && value.name === 'undefined') {
        return value;
      }
      if (
        !binding?.constant ||
        binding.references.length !== 1 ||
        binding.references[0] !== value ||
        binding.node.type !== 'VariableDeclarator' ||
        binding.node.id.type !== 'Identifier' ||
        !binding.node.init
      ) {
        return undefined;
      }
      value = unwrapExpression(binding.node.init);
    }
    return value;
  }

  private inspect(
    path: readonly string[]
  ):
    | { ok: true; parent?: ParentObject; property?: Property }
    | { ok: false; code: CsfMutationDiagnosticCode; node: Node } {
    let parent: ParentObject = { root: this.root() };
    let property: Property | undefined;

    for (const [index, name] of path.entries()) {
      const lookup = lookupProperty(parent.root.properties, name);
      if (lookup.ok === false) {
        return lookup;
      }
      property = lookup.property;
      if (!property || index === path.length - 1) {
        return { ok: true, parent, property };
      }
      if (property.method) {
        return { ok: false, code: 'unsupported-member', node: property };
      }
      const value = this.resolveExpression(property.value);
      if (value?.type !== 'ObjectExpression') {
        return { ok: false, code: 'unsupported-member', node: property.value };
      }
      parent = { root: literalRoot(this.editor, value), node: value };
    }

    return { ok: true, parent, property };
  }

  /** Inserts members at a path whose parents may not exist yet; the caller has validated it. */
  private insert(path: readonly string[], members: MemberInsert[]) {
    let parent = this.root();
    const quote = this.editor.quote;
    for (const [index, name] of path.slice(0, -1).entries()) {
      const lookup = lookupProperty(parent.properties, name);
      if (lookup.ok === false) {
        throw new Error('CsfObject mutation preflight was invalidated');
      }
      if (!lookup.property) {
        const missing = path.slice(index, -1);
        // Comments travel with moved members; a line comment needs the object to span lines.
        const multiline = members.some((member) => member.text.includes('\n'));
        const block = (texts: string[]) =>
          multiline
            ? `{\n${texts.map((text) => `  ${text.split('\n').join('\n  ')},`).join('\n')}\n}`
            : `{ ${texts.join(', ')} }`;
        const nested = missing
          .slice(1)
          .reverse()
          .reduce(
            (inner, key) => block([`${printKey(key, quote)}: ${inner}`]),
            block(members.map((member) => member.text))
          );
        parent.append([{ key: name, value: nested, text: `${printKey(name, quote)}: ${nested}` }]);
        return;
      }
      const value = lookup.property.method
        ? undefined
        : this.resolveExpression(lookup.property.value);
      if (value?.type !== 'ObjectExpression') {
        throw new Error('CsfObject mutation preflight was invalidated');
      }
      parent = literalRoot(this.editor, value);
    }
    parent.append(members);
  }

  private anchor(): Node {
    return this.editor.program;
  }

  private commit() {
    this.host.commit();
  }

  private failure(
    code: CsfMutationDiagnosticCode,
    path: readonly string[],
    node: Node,
    message = `Cannot mutate ${path.join('.')} because the target contains ${code.replaceAll('-', ' ')}`
  ) {
    const span = node as Node & { start?: number; end?: number };
    const diagnostic: CsfMutationDiagnostic = {
      code,
      target: this.target,
      path: [...path],
      message,
      ...(typeof span.start === 'number' && span.end !== undefined && node !== this.editor.program
        ? { loc: locationOf(this.editor.code, span.start, span.end) }
        : {}),
    };
    this.reportDiagnostic(diagnostic);
    return { ok: false as const, changed: false as const, diagnostic };
  }

  private success(): CsfMutationResult {
    this.commit();
    this.#changed = true;
    this.markChanged();
    return { ok: true, changed: true };
  }
}

export const createCsfObject = (
  target: CsfObjectTarget,
  host: CsfObjectHost,
  prefix: readonly string[],
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject => new CsfObjectEditor(target, host, prefix, report, markChanged);

export { keySource };
