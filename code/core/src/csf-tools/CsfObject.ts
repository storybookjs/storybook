import { type NodePath, types as t } from 'storybook/internal/babel';

import { pathForNode, unwrapExpression } from './story-shape/index.ts';

export type CsfObjectTarget =
  | { kind: 'config' }
  | { kind: 'meta' }
  | { kind: 'story'; exportName: string; localName: string }
  | {
      kind: 'story-annotation';
      exportName: string;
      localName: string;
      annotation: 'parameters' | 'story';
    };

export type CsfMutationDiagnosticCode =
  | 'unsupported-initializer'
  | 'ambiguous-binding'
  | 'duplicate-field'
  | 'spread-field'
  | 'dynamic-key'
  | 'unsupported-member'
  | 'occupied-destination'
  | 'cyclic-move';

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
  readonly target: CsfObjectTarget;
  readonly changed: boolean;
  get(path: readonly string[]): t.Expression | undefined;
  /** Set a literal value or Babel expression. Expression-shaped objects are treated as AST nodes. */
  set(path: readonly string[], value: CsfValue | t.Expression): CsfMutationResult;
  /**
   * Replaces the value at `path` with the result of `derive`, which receives the value's live AST
   * node. Nodes reused by the derived value keep their original source, so a value-transforming
   * relocation prints as written instead of being pretty-printed.
   *
   * `derive` must return a new node, or `undefined` to keep the current value. It must not mutate
   * its argument or retain it beyond the call: a mutation made through the live node happens
   * outside this editor, so it is reported by neither `changed` nor a diagnostic.
   */
  transform(
    path: readonly string[],
    derive: (value: t.Expression) => t.Expression | undefined
  ): CsfMutationResult;
  remove(path: readonly string[]): CsfMutationResult;
  rename(path: readonly string[], name: string): CsfMutationResult;
  move(from: readonly string[], to: readonly string[]): CsfMutationResult;
}

export interface CsfObjectOptions {
  meta?: boolean;
  stories?: boolean;
  annotations?: readonly ('parameters' | 'story')[];
}

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;
type ObjectRoot = Pick<NodePath<t.ObjectExpression>, 'node' | 'scope' | 'buildCodeFrameError'>;

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

const lookupProperty = (object: t.ObjectExpression, name: string): PropertyLookup => {
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
  const unproven = unknownAfterMatch ?? (matches.length === 0 ? unknown : undefined);
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
    const logicalPath = this.normalizePath(path);
    if (!logicalPath) {
      return undefined;
    }
    const found = this.inspect(logicalPath);
    if (found.ok === false) {
      this.failure(found.code, path, found.node);
      return undefined;
    }
    const value = found.property && propertyExpression(found.property);
    return value ? t.cloneNode(value, true) : undefined;
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
      const value = this.resolveObject(ancestor.property.value);
      if (!t.isObjectExpression(value) || value.properties.length > 0) {
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

  private resolveObject(node: t.Node): t.ObjectExpression | undefined {
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
    return t.isObjectExpression(value) ? value : undefined;
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
      const value = this.resolveObject(property.value);
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
          ? this.resolveObject(lookup.property.value)
          : undefined;
        if (!t.isObjectExpression(value)) {
          throw this.root.buildCodeFrameError('CsfObject mutation preflight was invalidated');
        }
        object = value;
      }
    }
    object.properties.push(property);
  }

  private failure(code: CsfMutationDiagnosticCode, path: readonly string[], node: t.Node) {
    const diagnostic: CsfMutationDiagnostic = {
      code,
      target: this.target,
      path: [...path],
      message: `Cannot mutate ${path.join('.')} because the target contains ${code.replaceAll('-', ' ')}`,
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
