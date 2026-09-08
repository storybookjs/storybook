import { type NodePath, types as t } from 'storybook/internal/babel';

import { unwrapExpression } from './story-shape/index.ts';

export type CsfObjectTarget =
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
  | 'occupied-destination';

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

export interface CsfObject {
  readonly target: CsfObjectTarget;
  readonly changed: boolean;
  get(path: readonly string[]): t.Expression | undefined;
  set(path: readonly string[], value: t.Expression): CsfMutationResult;
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

type PropertyLookup =
  | { ok: true; property?: t.ObjectProperty }
  | { ok: false; code: CsfMutationDiagnosticCode; node: t.Node };

const staticKey = (member: t.ObjectMethod | t.ObjectProperty): string | undefined => {
  if (t.isStringLiteral(member.key)) {
    return member.key.value;
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

const lookupProperty = (object: t.ObjectExpression, name: string): PropertyLookup => {
  const matches: t.ObjectProperty[] = [];

  for (const member of object.properties) {
    if (t.isSpreadElement(member)) {
      return { ok: false, code: 'spread-field', node: member };
    }
    const key = staticKey(member);
    if (key === undefined) {
      return { ok: false, code: 'dynamic-key', node: member };
    }
    if (key !== name) {
      continue;
    }
    if (!t.isObjectProperty(member)) {
      return { ok: false, code: 'unsupported-member', node: member };
    }
    matches.push(member);
  }

  if (matches.length > 1) {
    return { ok: false, code: 'duplicate-field', node: matches[1] };
  }
  return { ok: true, property: matches[0] };
};

class CsfObjectEditor implements CsfObject {
  #changed = false;

  constructor(
    readonly target: CsfObjectTarget,
    private readonly root: NodePath<t.ObjectExpression>,
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
    if (!found.ok) {
      this.failure(found.code, path, found.node);
      return undefined;
    }
    return found.property && t.isExpression(found.property.value)
      ? found.property.value
      : undefined;
  }

  set(path: readonly string[], value: t.Expression): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0) {
      return this.failure('unsupported-member', path, this.root.node);
    }
    const inspected = this.inspect(logicalPath);
    if (!inspected.ok) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (inspected.property) {
      if (inspected.property.value === value) {
        return { ok: true, changed: false };
      }
      inspected.property.value = value;
    } else {
      this.insert(logicalPath, t.objectProperty(keyNode(logicalPath.at(-1)!), value));
    }
    return this.success();
  }

  remove(path: readonly string[]): CsfMutationResult {
    const logicalPath = this.normalizePath(path);
    if (!logicalPath || logicalPath.length === 0) {
      return this.failure('unsupported-member', path, this.root.node);
    }
    const inspected = this.inspect(logicalPath);
    if (!inspected.ok) {
      return this.failure(inspected.code, path, inspected.node);
    }
    if (!inspected.property || !inspected.parent) {
      return { ok: true, changed: false };
    }
    inspected.parent.properties.splice(inspected.parent.properties.indexOf(inspected.property), 1);
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
      destinationPath.length === 0
    ) {
      return this.failure('unsupported-member', !sourcePath ? from : to, this.root.node);
    }

    const source = this.inspect(sourcePath);
    if (!source.ok) {
      return this.failure(source.code, from, source.node);
    }
    if (!source.property || !source.parent) {
      return { ok: true, changed: false };
    }
    const destination = this.inspect(destinationPath);
    if (!destination.ok) {
      return this.failure(destination.code, to, destination.node);
    }
    if (destination.property) {
      return this.failure('occupied-destination', to, destination.property);
    }

    source.parent.properties.splice(source.parent.properties.indexOf(source.property), 1);
    source.property.key = keyNode(destinationPath.at(-1)!);
    source.property.computed = false;
    this.insert(destinationPath, source.property);
    return this.success();
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

  private inspect(path: readonly string[]) {
    let object = this.root.node;
    let parent: t.ObjectExpression | undefined;
    let property: t.ObjectProperty | undefined;

    for (const [index, name] of path.entries()) {
      const lookup = lookupProperty(object, name);
      if (!lookup.ok) {
        return lookup;
      }
      parent = object;
      property = lookup.property;
      if (!property || index === path.length - 1) {
        return { ok: true as const, parent, property };
      }
      const value = unwrapExpression(property.value);
      if (!t.isObjectExpression(value)) {
        return { ok: false as const, code: 'unsupported-member' as const, node: property.value };
      }
      object = value;
    }

    return { ok: true as const, parent, property };
  }

  private insert(path: readonly string[], property: t.ObjectProperty) {
    let object = this.root.node;
    for (const name of path.slice(0, -1)) {
      const lookup = lookupProperty(object, name);
      if (!lookup.ok) {
        throw this.root.buildCodeFrameError('CsfObject mutation preflight was invalidated');
      }
      if (!lookup.property) {
        const child = t.objectExpression([]);
        object.properties.push(t.objectProperty(keyNode(name), child));
        object = child;
      } else {
        object = unwrapExpression(lookup.property.value) as t.ObjectExpression;
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
  root: NodePath<t.ObjectExpression>,
  prefix: readonly string[],
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject => new CsfObjectEditor(target, root, prefix, report, markChanged);
