import { type NodePath, types as t } from 'storybook/internal/babel';

import { pathForNode, unwrapExpression } from './story-shape/index.ts';

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
  loc?: t.SourceLocation;
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
   * Read a copy of the Babel expression at a property path. Missing fields return `undefined`.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'] };").parse();
   * object.get(['tags'])?.type; // 'ArrayExpression'
   * object.get(['missing']); // undefined
   * ```
   */
  get(path: readonly string[]): t.Expression | undefined;
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
   * Set a plain value or Babel expression, creating missing parents. Accepts nested arrays and
   * objects; top-level expression-shaped objects are interpreted as AST nodes.
   *
   * @example
   * ```ts
   * const object = loadConfig('export default {};').parse();
   * object.set(['parameters', 'a11y'], { test: 'todo', enabled: true });
   * // { ok: true, changed: true }
   * object.getValue(['parameters']); // { a11y: { test: 'todo', enabled: true } }
   * ```
   */
  set(path: readonly string[], value: CsfValue | t.Expression): CsfMutationResult;
  /**
   * Replace a value using its live Babel expression. Reused nodes preserve their source formatting.
   * Return a new node, or `undefined` to leave the value unchanged. Do not mutate or retain the input
   * node: such changes bypass change tracking and diagnostics.
   *
   * @example
   * ```ts
   * const object = loadConfig("export default { tags: ['docs'] };").parse();
   * object.transform(['tags'], (value) =>
   *   t.arrayExpression([t.spreadElement(value), t.stringLiteral('autodocs')])
   * ); // { ok: true, changed: true }
   * object.getValue(['tags']); // ['docs', 'autodocs']
   * ```
   */
  transform(
    path: readonly string[],
    derive: (value: t.Expression) => t.Expression | undefined
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

const UNRESOLVED = Symbol('unresolved');

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;
type ObjectRoot = Pick<NodePath<t.ObjectExpression>, 'node' | 'scope' | 'buildCodeFrameError'> & {
  detached?: boolean;
};

type PropertyLookup =
  | { ok: true; property?: t.ObjectProperty | t.ObjectMethod }
  | { ok: false; code: CsfMutationDiagnosticCode; node: t.Node };

const staticKey = (member: t.ObjectMethod | t.ObjectProperty): string | undefined => {
  if (t.isStringLiteral(member.key)) {
    return member.key.value;
  }
  if (t.isNumericLiteral(member.key)) {
    return String(member.key.value);
  }
  if (t.isIdentifier(member.key) && !member.computed) {
    return member.key.name;
  }
  if (t.isTemplateLiteral(member.key) && member.key.expressions.length === 0) {
    return member.key.quasis[0]?.value.cooked ?? member.key.quasis[0]?.value.raw;
  }
  return undefined;
};

const keyNode = (name: string) =>
  t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name);

const unsafePath = (path: readonly string[]) => path.includes('__proto__');

const lookupProperty = (
  object: t.ObjectExpression,
  name: string,
  removing = false
): PropertyLookup => {
  const matches: (t.ObjectProperty | t.ObjectMethod)[] = [];
  let unknown: { code: CsfMutationDiagnosticCode; node: t.Node } | undefined;
  let unknownAfterMatch: { code: CsfMutationDiagnosticCode; node: t.Node } | undefined;

  for (const member of object.properties) {
    const key = t.isSpreadElement(member) ? undefined : staticKey(member);
    if (key === undefined) {
      unknown = {
        code: t.isSpreadElement(member) ? 'spread-field' : 'dynamic-key',
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
    if (!t.isObjectProperty(member) && !t.isObjectMethod(member, { kind: 'method' })) {
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

const propertyExpression = (
  property: t.ObjectProperty | t.ObjectMethod
): t.Expression | undefined => {
  if (t.isObjectProperty(property)) {
    return t.isExpression(property.value) ? property.value : undefined;
  }
  const value = t.functionExpression(
    null,
    property.params,
    property.body,
    property.generator,
    property.async
  );
  value.returnType = property.returnType;
  value.typeParameters = property.typeParameters;
  return value;
};

const isEvaluationInert = (node: t.Node): boolean => {
  const value = unwrapExpression(node);
  if (t.isTemplateLiteral(value)) {
    return value.expressions.length === 0;
  }
  if (t.isLiteral(value) || t.isFunctionExpression(value) || t.isArrowFunctionExpression(value)) {
    return true;
  }
  if (t.isUnaryExpression(value)) {
    return ['!', 'void', 'typeof'].includes(value.operator)
      ? isEvaluationInert(value.argument)
      : t.isNumericLiteral(unwrapExpression(value.argument));
  }
  if (t.isArrayExpression(value)) {
    return value.elements.every((element) => element === null || isEvaluationInert(element));
  }
  if (t.isObjectExpression(value)) {
    return value.properties.every(
      (property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        staticKey(property) !== undefined &&
        isEvaluationInert(property.value)
    );
  }
  return false;
};

class CsfObjectEditor implements CsfObject {
  #changed = false;

  constructor(
    readonly target: CsfObjectTarget,
    private readonly root: ObjectRoot,
    private readonly prefix: readonly string[],
    private readonly reportDiagnostic: ReportDiagnostic,
    private readonly markChanged: MarkChanged
  ) {}

  get changed() {
    return this.#changed;
  }

  get(path: readonly string[]): t.Expression | undefined {
    const value = this.getExpression(path);
    return value ? t.cloneNode(value, true) : undefined;
  }

  getValue(path: readonly string[]): CsfValue {
    const expression = this.getExpression(path);
    if (!expression) {
      return undefined;
    }
    const value = this.readValue(expression);
    if (value === UNRESOLVED) {
      this.failure('unsupported-value', path, expression);
      return undefined;
    }
    return value;
  }

  private getExpression(path: readonly string[]): t.Expression | undefined {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath) {
      return undefined;
    }
    const found = this.inspect(logicalPath);
    if (found.ok === false) {
      this.failure(found.code, path, found.node);
      return undefined;
    }
    return found.property && propertyExpression(found.property);
  }

  set(path: readonly string[], value: CsfValue | t.Expression): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0 || unsafePath(logicalPath)) {
      return this.failure('unsupported-member', path, this.root.node);
    }
    const inspected = this.inspect(logicalPath);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (t.isObjectProperty(inspected.property) && inspected.property.value === value) {
      return { ok: true, changed: false };
    }
    const expression =
      t.isNode(value) && t.isExpression(value) ? t.cloneNode(value, true) : t.valueToNode(value);
    if (inspected.property && inspected.parent) {
      this.replaceValue(inspected.property, inspected.parent, expression);
    } else {
      this.insert(logicalPath, t.objectProperty(keyNode(logicalPath.at(-1)!), expression));
    }
    return this.success();
  }

  transform(
    path: readonly string[],
    derive: (value: t.Expression) => t.Expression | undefined
  ): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0 || unsafePath(logicalPath)) {
      return this.failure('unsupported-member', path, this.root.node);
    }
    const inspected = this.inspect(logicalPath);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    const { property, parent } = inspected;
    const value = property && propertyExpression(property);
    if (!property || !parent || !value) {
      return { ok: true, changed: false };
    }
    const derived = derive(value);
    if (!derived || derived === value) {
      return { ok: true, changed: false };
    }
    this.replaceValue(property, parent, derived);
    return this.success();
  }

  remove(path: readonly string[]): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0 || unsafePath(logicalPath)) {
      return this.failure('unsupported-member', path, this.root.node);
    }
    const inspected = this.inspect(logicalPath);
    if (inspected.ok === false) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (!inspected.property || !inspected.parent) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(inspected.parent, logicalPath.at(-1)!, true);
    if (!removal.ok) {
      return this.failure(removal.code, path, removal.node);
    }
    inspected.parent.properties.splice(inspected.parent.properties.indexOf(inspected.property), 1);
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
      return this.failure('unsupported-member', !sourcePath ? from : to, this.root.node);
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
      return this.failure('cyclic-move', to, this.root.node);
    }

    const source = this.inspect(sourcePath);
    if (source.ok === false) {
      return this.failure(source.code, from, source.node);
    }
    if (!source.property || !source.parent) {
      return { ok: true, changed: false };
    }
    const removal = lookupProperty(source.parent, sourcePath.at(-1)!, true);
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

    const sourceParent = sourcePath.slice(0, -1);
    const destinationParent = destinationPath.slice(0, -1);
    if (
      sourceParent.length === destinationParent.length &&
      sourceParent.every((part, index) => destinationParent[index] === part)
    ) {
      if (t.isObjectProperty(source.property)) {
        source.property.shorthand = false;
      }
      source.property.key = keyNode(destinationPath.at(-1)!);
      source.property.computed = false;
      return this.success();
    }

    source.parent.properties.splice(source.parent.properties.indexOf(source.property), 1);
    if (t.isObjectProperty(source.property)) {
      source.property.shorthand = false;
    }
    source.property.key = keyNode(destinationPath.at(-1)!);
    source.property.computed = false;
    this.insert(destinationPath, source.property);
    this.removeEmptyParents(sourcePath);
    return this.success();
  }

  group(path: readonly string[], names: readonly string[]): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0 || unsafePath(logicalPath) || unsafePath(names)) {
      return this.failure('unsupported-member', path, this.root.node);
    }
    const group = logicalPath.at(-1)!;
    if (names.includes(group)) {
      return this.failure('cyclic-move', path, this.root.node);
    }
    let parent = this.root.node;
    if (logicalPath.length > 1) {
      const inspected = this.inspect(logicalPath.slice(0, -1));
      if (inspected.ok === false) {
        return this.failure(inspected.code, path, inspected.node);
      }
      if (!inspected.property) {
        return { ok: true, changed: false };
      }
      const value = t.isObjectProperty(inspected.property)
        ? this.resolveExpression(inspected.property.value)
        : undefined;
      if (!t.isObjectExpression(value)) {
        return this.failure('unsupported-member', path, inspected.property);
      }
      parent = value;
    }
    const moved = parent.properties.filter(
      (property): property is t.ObjectProperty | t.ObjectMethod =>
        !t.isSpreadElement(property) && names.includes(staticKey(property) ?? '')
    );
    if (moved.length === 0) {
      return { ok: true, changed: false };
    }
    for (const property of parent.properties) {
      if (t.isSpreadElement(property) || property.computed || staticKey(property) === undefined) {
        return this.failure(
          t.isSpreadElement(property) ? 'spread-field' : 'dynamic-key',
          path,
          property,
          `the configuration contains ${t.isSpreadElement(property) ? 'a spread property' : 'a computed property'}`
        );
      }
    }
    const sourceNames = new Set<string>();
    for (const property of moved) {
      const name = staticKey(property)!;
      if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
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
    const destination = lookupProperty(parent, group);
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
      const value = t.isObjectProperty(existing) ? unwrapExpression(existing.value) : undefined;
      if (!t.isObjectExpression(value)) {
        return this.failure(
          'unsupported-member',
          path,
          existing,
          `the existing ${group} value is not an object literal`
        );
      }
      for (const property of value.properties) {
        if (t.isSpreadElement(property) || property.computed || staticKey(property) === undefined) {
          return this.failure(
            t.isSpreadElement(property) ? 'spread-field' : 'dynamic-key',
            path,
            property,
            `the existing ${group} object contains ${t.isSpreadElement(property) ? 'a spread property' : 'a computed property'}`
          );
        }
        if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
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
          t.isSpreadElement(property) ? undefined : staticKey(property)
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
        if (!t.isObjectProperty(property) || !isEvaluationInert(property.value)) {
          return this.failure(
            'evaluation-order',
            path,
            property,
            `the ${name} option has a ${t.isObjectProperty(property) ? unwrapExpression(property.value).type : 'non-expression'} value whose relocation into the existing ${group} object could change expression evaluation order`
          );
        }
      }
      value.properties.unshift(...moved);
      const movedSet = new Set<t.ObjectMember | t.SpreadElement>(moved);
      parent.properties = parent.properties.filter((property) => !movedSet.has(property));
    } else {
      if (parent === this.root.node && this.root.detached) {
        const effectful = moved.find(
          (property) => !t.isObjectProperty(property) || !isEvaluationInert(property.value)
        );
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
      parent.properties.splice(
        first,
        moved.length,
        t.objectProperty(keyNode(group), t.objectExpression(moved))
      );
    }
    return this.success();
  }

  private replaceValue(
    property: t.ObjectProperty | t.ObjectMethod,
    parent: t.ObjectExpression,
    value: t.Expression
  ) {
    if (t.isObjectProperty(property)) {
      property.value = value;
      property.shorthand = false;
    } else if (t.isFunctionExpression(value) && !value.id) {
      property.params = value.params;
      property.body = value.body;
      property.async = value.async;
      property.generator = value.generator;
      property.returnType = value.returnType;
      property.typeParameters = value.typeParameters;
    } else {
      parent.properties.splice(
        parent.properties.indexOf(property),
        1,
        t.inheritsComments(t.objectProperty(property.key, value, property.computed), property)
      );
    }
  }

  private removeEmptyParents(path: readonly string[]) {
    for (let depth = path.length - 1; depth > 0; depth--) {
      const ancestor = this.inspect(path.slice(0, depth));
      if (ancestor.ok === false || !t.isObjectProperty(ancestor.property) || !ancestor.parent) {
        return;
      }
      const value = this.resolveExpression(ancestor.property.value);
      if (!t.isObjectExpression(value) || value.properties.length > 0) {
        return;
      }
      if (!lookupProperty(ancestor.parent, path[depth - 1], true).ok) {
        return;
      }
      ancestor.parent.properties.splice(ancestor.parent.properties.indexOf(ancestor.property), 1);
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

  private readValue(node: t.Node): CsfValue | typeof UNRESOLVED {
    const value = this.resolveExpression(node);
    if (t.isStringLiteral(value) || t.isNumericLiteral(value) || t.isBooleanLiteral(value)) {
      return value.value;
    }
    if (t.isNullLiteral(value)) {
      return null;
    }
    if (t.isIdentifier(value)) {
      return value.name === 'undefined' ? undefined : UNRESOLVED;
    }
    if (t.isTemplateLiteral(value) && value.expressions.length === 0) {
      return value.quasis[0].value.cooked ?? UNRESOLVED;
    }
    if (t.isUnaryExpression(value)) {
      const argument = this.readValue(value.argument);
      if (typeof argument !== 'number') {
        return UNRESOLVED;
      }
      if (value.operator === '-') {
        return -argument;
      }
      return value.operator === '+' ? argument : UNRESOLVED;
    }
    if (t.isArrayExpression(value)) {
      const elements: CsfValue[] = [];
      for (const element of value.elements) {
        if (!element) {
          elements.length++;
          continue;
        }
        const item = this.readValue(t.isSpreadElement(element) ? element.argument : element);
        if (item === UNRESOLVED) {
          return UNRESOLVED;
        }
        if (t.isSpreadElement(element)) {
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
    if (t.isObjectExpression(value)) {
      const entries: [string, CsfValue][] = [];
      for (const property of value.properties) {
        if (t.isSpreadElement(property)) {
          const spread = this.readValue(property.argument);
          if (typeof spread !== 'object' || spread === null || Array.isArray(spread)) {
            return UNRESOLVED;
          }
          entries.push(...Object.entries(spread));
          continue;
        }
        const key = staticKey(property);
        if (
          !t.isObjectProperty(property) ||
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

  private resolveExpression(node: t.Node): t.Node | undefined {
    const program = this.root.scope.getProgramParent().path;
    if (!program.isProgram()) {
      return undefined;
    }
    let value = unwrapExpression(node);
    const visited = new Set<t.Node>();
    while (t.isIdentifier(value) && !visited.has(value)) {
      visited.add(value);
      const reference = pathForNode(program, value);
      const binding = reference?.scope.getBinding(value.name);
      if (!binding && reference && value.name === 'undefined') {
        return value;
      }
      if (
        !binding?.constant ||
        binding.referencePaths.length !== 1 ||
        binding.referencePaths[0].node !== value ||
        !binding.path.isVariableDeclarator() ||
        !binding.path.node.init
      ) {
        return undefined;
      }
      value = unwrapExpression(binding.path.node.init);
    }
    return value;
  }

  private inspect(path: readonly string[]) {
    let object = this.root.node;
    let parent: t.ObjectExpression | undefined;
    let property: t.ObjectProperty | t.ObjectMethod | undefined;

    for (const [index, name] of path.entries()) {
      const lookup = lookupProperty(object, name);
      if (lookup.ok === false) {
        return lookup;
      }
      parent = object;
      property = lookup.property;
      if (!property || index === path.length - 1) {
        return { ok: true as const, parent, property };
      }
      if (!t.isObjectProperty(property)) {
        return { ok: false as const, code: 'unsupported-member' as const, node: property };
      }
      const value = this.resolveExpression(property.value);
      if (!t.isObjectExpression(value)) {
        return { ok: false as const, code: 'unsupported-member' as const, node: property.value };
      }
      object = value;
    }

    return { ok: true as const, parent, property };
  }

  private insert(path: readonly string[], property: t.ObjectProperty | t.ObjectMethod) {
    let object = this.root.node;
    for (const name of path.slice(0, -1)) {
      const lookup = lookupProperty(object, name);
      if (lookup.ok === false) {
        throw this.root.buildCodeFrameError('CsfObject mutation preflight was invalidated');
      }
      if (!lookup.property) {
        const child = t.objectExpression([]);
        object.properties.push(t.objectProperty(keyNode(name), child));
        object = child;
      } else {
        const value = t.isObjectProperty(lookup.property)
          ? this.resolveExpression(lookup.property.value)
          : undefined;
        if (!t.isObjectExpression(value)) {
          throw this.root.buildCodeFrameError('CsfObject mutation preflight was invalidated');
        }
        object = value;
      }
    }
    object.properties.push(property);
  }

  private failure(
    code: CsfMutationDiagnosticCode,
    path: readonly string[],
    node: t.Node,
    message = `Cannot mutate ${path.join('.')} because the target contains ${code.replaceAll('-', ' ')}`
  ) {
    const diagnostic: CsfMutationDiagnostic = {
      code,
      target: this.target,
      path: [...path],
      message,
      ...(node.loc ? { loc: node.loc } : {}),
    };
    this.reportDiagnostic(diagnostic);
    return { ok: false as const, changed: false as const, diagnostic };
  }

  private success(): CsfMutationResult {
    this.#changed = true;
    this.markChanged();
    return { ok: true, changed: true };
  }
}

export const createCsfObject = (
  target: CsfObjectTarget,
  root: ObjectRoot,
  prefix: readonly string[],
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject => new CsfObjectEditor(target, root, prefix, report, markChanged);
