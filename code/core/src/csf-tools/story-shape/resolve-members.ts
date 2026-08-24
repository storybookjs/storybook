// Follows the references a story hides its config behind: a spread of a constant, of a sibling
// story, or of something another module owns, applying every write in the order it runs.
import { generate, type NodePath, types as t } from 'storybook/internal/babel';

import { importedName, isTypeSpecifier } from './imports.ts';
import { isCanonicalCsf2BindCall, isCsfFactoryCall, keyOf, unwrapExpression } from './utils.ts';

/** Members of an object, and what reading it statically could not account for. */
export interface ResolvedMembers {
  /** Member name → value node, as of the last write this pass could read. */
  properties: Record<string, t.Node>;
  /**
   * Names whose value an `unresolved` entry written after them may replace at runtime. A member
   * absent from `properties` is only knowably absent when `unresolved` is empty.
   */
  shadowed: string[];
  /** Source text of every member `properties` could not absorb; empty exactly when complete. */
  unresolved: string[];
}

/** A module a reference reaches into, parsed and paired with the path it was read from. */
export interface ReferenceModule {
  program: NodePath<t.Program>;
  /** Absolute path `program` was parsed from; the base every import specifier resolves against. */
  filePath: string;
}

/** Everything following a reference beyond the object it starts at needs. */
export interface ReferenceContext extends ReferenceModule {
  /**
   * Parses the module an import specifier names. Callers that read a single file leave it unset,
   * which confines resolution to that file.
   */
  resolveModule?: (fromFile: string, specifier: string) => ReferenceModule | undefined;
  /**
   * Rewrites a value read out of another module into one that stands on its own, since the name it
   * was written as means nothing where the snippet lands. Returning `undefined` rejects the value,
   * leaving the reference that reached it unresolved.
   */
  externalize?: (node: t.Node) => t.Node | undefined;
}

/** The half of a {@link ReferenceContext} that is not specific to one story file. */
export type StoryReferenceResolver = Pick<ReferenceContext, 'resolveModule' | 'externalize'>;

/** How arg resolution leaves the story file; without it only the story file itself is read. */
export interface StoryReferences extends StoryReferenceResolver {
  /** Absolute path of the story file, which every import specifier resolves against. */
  filePath: string;
}

/** Source text of a node, for naming an expression a static pass could not read. */
export const sourceOf = (node: t.Node): string =>
  generate(node, { concise: true, comments: false }).code;

const complete = (properties: Record<string, t.Node> = {}): ResolvedMembers => ({
  properties,
  shadowed: [],
  unresolved: [],
});

/**
 * Members of an object literal, absorbing every spread the context can follow.
 *
 * A method shorthand keeps its member, since its key is as knowable as any other; a getter, setter
 * or generator does not, because reading it runs code.
 */
export const resolveObjectMembers = (
  object: t.ObjectExpression,
  ctx: ReferenceContext
): ResolvedMembers => membersOf(object, ctx, new Set());

/**
 * An `args` record, absorbing every spread the context can follow.
 *
 * Unlike {@link resolveObjectMembers} every member has to reduce to a printable value, so a method
 * is reported rather than kept, wherever a spread copied it from.
 */
export const resolveArgsRecord = (
  node: t.Node | undefined,
  ctx: ReferenceContext
): ResolvedMembers => {
  if (node === undefined) {
    return complete();
  }
  const unwrapped = unwrapExpression(node);
  if (t.isObjectExpression(unwrapped)) {
    return asArgsRecord(membersOf(unwrapped, ctx, new Set()));
  }
  // `args: shared` names its record instead of writing one, which reads the same as spreading it.
  const referenced = resolveReference(ctx, unwrapped, node.start ?? undefined, new Set());
  return referenced
    ? asArgsRecord(referenced)
    : { properties: {}, shadowed: [], unresolved: [`args: ${sourceOf(unwrapped)}`] };
};

const asArgsRecord = (members: ResolvedMembers): ResolvedMembers => {
  const methods = Object.entries(members.properties).filter(([, node]) => t.isObjectMethod(node));
  if (methods.length === 0) {
    return members;
  }
  const properties = { ...members.properties };
  const unresolved = [...members.unresolved];
  for (const [key, node] of methods) {
    delete properties[key];
    unresolved.push(sourceOf(node));
  }
  return {
    properties,
    shadowed: members.shadowed.filter((key) => key in properties),
    unresolved,
  };
};

/**
 * The members a module-level binding holds, following the spreads and references it is composed of.
 *
 * For a CSF factory story the members are the ones behind `input`, matching how the factory exposes
 * the config it was called with. `undefined` when the binding cannot be read at all.
 */
export const resolveBindingMembers = (
  ctx: ReferenceContext,
  name: string
): ResolvedMembers | undefined => {
  const bound = bindingMembers(ctx, name, undefined, new Set());
  return bound === undefined || bound.kind === 'namespace' ? undefined : bound.members;
};

/**
 * The value a member chain names, paired with the module whose scope its names resolve against.
 *
 * Unlike {@link resolveObjectMembers} the value is returned as written rather than read into
 * members, so a chain landing on a name, as `internal.config.component` reaching the class an
 * Angular story documents does, can be followed further by the caller. `undefined` when the chain
 * leaves what this pass can read, and for a bare identifier, which names no member.
 */
export const resolveReferencedValue = (
  ctx: ReferenceContext,
  expression: t.Node
): { node: t.Node; ctx: ReferenceContext } | undefined => {
  const chain = memberChain(expression);
  if (!chain || chain.path.length === 0) {
    return undefined;
  }

  const visited = new Set<string>();
  const located = locate(ctx, chain, undefined, visited);
  if (!located || located.path.length === 0) {
    return undefined;
  }

  let members = located.members;
  const scope = located.ctx;
  for (const [index, key] of located.path.entries()) {
    // A key shadowed by a later unreadable write may hold something else at runtime; a key this
    // pass never saw written to is knowably absent only once nothing here was left unresolved.
    if (members.shadowed.includes(key)) {
      return undefined;
    }
    const value = members.properties[key];
    if (value === undefined) {
      return undefined;
    }
    if (index === located.path.length - 1) {
      return { node: value, ctx: scope };
    }
    const unwrapped = unwrapExpression(value);
    if (!t.isObjectExpression(unwrapped)) {
      return undefined;
    }
    members = membersOf(unwrapped, scope, visited);
  }

  return undefined;
};

const membersOf = (
  object: t.ObjectExpression,
  ctx: ReferenceContext,
  visited: Set<string>
): ResolvedMembers => {
  const properties: Record<string, t.Node> = {};
  const unresolved: string[] = [];
  const shadowed = new Set<string>();

  // A write this pass cannot read may replace any member already written, but a member written
  // after it wins at runtime, so only the keys known so far become uncertain.
  const shadowKnownMembers = (source: string) => {
    unresolved.push(source);
    for (const key of Object.keys(properties)) {
      shadowed.add(key);
    }
  };

  for (const property of object.properties) {
    if (t.isSpreadElement(property)) {
      const spread = spreadMembers(ctx, property, visited);
      if (spread === undefined || spread.unresolved.length > 0) {
        shadowKnownMembers(sourceOf(property));
        continue;
      }
      for (const [key, value] of Object.entries(spread.properties)) {
        properties[key] = value;
        // The spread source already knows which module wrote this value, if it crossed a module
        // boundary to get it; otherwise it is whatever the spread itself reads as.
        shadowed.delete(key);
      }
      continue;
    }

    const key = keyOf(property);
    if (key === null) {
      // A dynamic key can supply or shadow any member at runtime.
      shadowKnownMembers(sourceOf(property));
      continue;
    }
    if (t.isObjectMethod(property) && (property.kind !== 'method' || property.generator)) {
      // An accessor or generator replaces exactly the member it names, with a value only running
      // the story produces.
      delete properties[key];
      shadowed.delete(key);
      unresolved.push(sourceOf(property));
      continue;
    }
    properties[key] = t.isObjectMethod(property) ? property : property.value;
    shadowed.delete(key);
  }

  return { properties, shadowed: [...shadowed], unresolved };
};

/** The object a spread copies from, whether it is written out or named. */
const spreadMembers = (
  ctx: ReferenceContext,
  spread: t.SpreadElement,
  visited: Set<string>
): ResolvedMembers | undefined => {
  const argument = unwrapExpression(spread.argument);
  return t.isObjectExpression(argument)
    ? membersOf(argument, ctx, visited)
    : resolveReference(ctx, argument, spread.start ?? undefined, visited);
};

/** A member chain of statically-known keys, like `HeaderStories.LoggedIn.input.args`. */
const memberChain = (node: t.Node): { root: string; path: string[] } | undefined => {
  const path: string[] = [];
  let current = unwrapExpression(node);
  while (t.isMemberExpression(current)) {
    const key =
      t.isIdentifier(current.property) && !current.computed
        ? current.property.name
        : t.isStringLiteral(current.property)
          ? current.property.value
          : undefined;
    if (key === undefined) {
      return undefined;
    }
    path.unshift(key);
    current = unwrapExpression(current.object);
  }
  return t.isIdentifier(current) ? { root: current.name, path } : undefined;
};

/**
 * The object a reference names, as of `position` in the file it is written in, or the module's final
 * state when `position` is `undefined` (which is what a reference from another file sees).
 *
 * `undefined` whenever the value at that moment cannot be pinned down: the binding is declared after
 * the reference runs, something mutates it in between, or the chain leaves what this pass can read.
 */
const resolveReference = (
  ctx: ReferenceContext,
  expression: t.Node,
  position: number | undefined,
  visited: Set<string>
): ResolvedMembers | undefined => {
  const chain = memberChain(expression);
  if (!chain) {
    return undefined;
  }

  // Reading a reference can lead back to itself, as `{ args: { ...Self.args } }` does. The guard
  // spans the whole read, since the object a chain lands on is only known once it is descended.
  const key = `ref:${ctx.filePath}#${chain.root}.${chain.path.join('.')}`;
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);
  try {
    return unguardedResolveReference(ctx, chain, position, visited);
  } finally {
    visited.delete(key);
  }
};

const unguardedResolveReference = (
  ctx: ReferenceContext,
  chain: { root: string; path: string[] },
  position: number | undefined,
  visited: Set<string>
): ResolvedMembers | undefined => {
  const located = locate(ctx, chain, position, visited);
  if (!located) {
    return undefined;
  }

  let members = located.members;
  const scope = located.ctx;
  for (const [index, key] of located.path.entries()) {
    if (members.unresolved.length > 0) {
      return undefined;
    }
    const value = members.properties[key];
    if (value === undefined) {
      // Spreading a member the object does not have copies nothing; reading through one throws.
      return index === located.path.length - 1 ? complete() : undefined;
    }
    const unwrapped = unwrapExpression(value);
    if (!t.isObjectExpression(unwrapped)) {
      return undefined;
    }
    members = membersOf(unwrapped, scope, visited);
  }

  return located.external ? externalized(members, scope) : members;
};

interface LocatedMembers {
  members: ResolvedMembers;
  /** Context the member value nodes belong to, which is what their own references resolve against. */
  ctx: ReferenceContext;
  /** Keys still to read, after any accessor the binding hides its members behind. */
  path: string[];
  /** Whether reaching the members crossed a module boundary. */
  external: boolean;
}

const locate = (
  ctx: ReferenceContext,
  chain: { root: string; path: string[] },
  position: number | undefined,
  visited: Set<string>
): LocatedMembers | undefined => {
  const binding = bindingMembers(ctx, chain.root, position, visited);
  if (!binding) {
    return undefined;
  }

  if (binding.kind === 'namespace') {
    const [exportName, ...path] = chain.path;
    if (exportName === undefined) {
      return undefined;
    }
    const exported = bindingMembers(binding.ctx, exportName, undefined, visited);
    if (exported === undefined || exported.kind === 'namespace') {
      return undefined;
    }
    const located = withAccessor(exported, path);
    return located === undefined ? undefined : { ...located, external: true };
  }

  const located = withAccessor(binding, chain.path);
  return located === undefined ? undefined : { ...located, external: binding.external };
};

/**
 * Strips the accessor a CSF factory keeps its config behind, so `Primary.input.args` reads the
 * config while a bare `...Primary` does not: spreading the factory object copies its methods, not
 * the config they close over.
 */
const withAccessor = (
  binding: Extract<BoundMembers, { kind: 'members' }>,
  path: string[]
): Omit<LocatedMembers, 'external'> | undefined => {
  if (binding.accessor === undefined) {
    return { members: binding.members, ctx: binding.ctx, path };
  }
  return path[0] === binding.accessor
    ? { members: binding.members, ctx: binding.ctx, path: path.slice(1) }
    : undefined;
};

const externalized = (
  members: ResolvedMembers,
  ctx: ReferenceContext
): ResolvedMembers | undefined => {
  if (!ctx.externalize) {
    return members;
  }
  const properties: Record<string, t.Node> = {};
  for (const [key, node] of Object.entries(members.properties)) {
    const value = ctx.externalize(node);
    if (value === undefined) {
      return undefined;
    }
    properties[key] = value;
  }
  return {
    properties,
    shadowed: members.shadowed,
    unresolved: members.unresolved,
  };
};

type BoundMembers =
  | {
      kind: 'members';
      members: ResolvedMembers;
      ctx: ReferenceContext;
      external: boolean;
      /** Accessor the members sit behind, for a CSF factory story whose config lives on `input`. */
      accessor?: 'input';
    }
  | { kind: 'namespace'; ctx: ReferenceContext };

const bindingMembers = (
  ctx: ReferenceContext,
  name: string,
  position: number | undefined,
  visited: Set<string>
): BoundMembers | undefined => {
  const key = `${ctx.filePath}#${name}`;
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);
  try {
    return unguardedBindingMembers(ctx, name, position, visited);
  } finally {
    visited.delete(key);
  }
};

const unguardedBindingMembers = (
  ctx: ReferenceContext,
  name: string,
  position: number | undefined,
  visited: Set<string>
): BoundMembers | undefined => {
  const binding = ctx.program.scope.getBinding(name);
  if (!binding) {
    return undefined;
  }

  if (binding.kind === 'module') {
    return importedBinding(ctx, binding.path, visited);
  }

  if (!binding.constant) {
    return undefined;
  }

  const declared = declaredBindingMembers(ctx, binding.path.node, position, visited);
  if (declared === undefined) {
    return undefined;
  }

  const assigned = assignedMembers(ctx, name, position);

  return {
    kind: 'members',
    ctx,
    external: false,
    ...(declared.accessor ? { accessor: declared.accessor } : {}),
    members: {
      properties: { ...declared.members.properties, ...assigned.properties },
      shadowed: declared.members.shadowed.filter((key) => !(key in assigned.properties)),
      unresolved: [...declared.members.unresolved, ...assigned.unresolved],
    },
  };
};

const declaredBindingMembers = (
  ctx: ReferenceContext,
  node: t.Node,
  position: number | undefined,
  visited: Set<string>
): { members: ResolvedMembers; accessor?: 'input' } | undefined => {
  if (t.isFunctionDeclaration(node)) {
    // Hoisted, so it is readable at any position; the CSF2 form gives it members by assignment.
    return { members: complete() };
  }
  if (!t.isVariableDeclarator(node)) {
    return undefined;
  }
  if (position !== undefined && (node.start ?? Number.POSITIVE_INFINITY) > position) {
    return undefined;
  }
  return node.init ? declaredMembers(ctx, node.init, position, visited) : { members: complete() };
};

/** Members an initializer declares, plus the accessor a CSF factory keeps them behind. */
const declaredMembers = (
  ctx: ReferenceContext,
  init: t.Expression,
  position: number | undefined,
  visited: Set<string>
): { members: ResolvedMembers; accessor?: 'input' } | undefined => {
  const unwrapped = unwrapExpression(init);

  if (t.isObjectExpression(unwrapped)) {
    return { members: membersOf(unwrapped, ctx, visited) };
  }

  const factory = factoryCall(unwrapped);
  if (factory === undefined && (t.isFunction(unwrapped) || isCanonicalCsf2BindCall(unwrapped))) {
    return { members: complete() };
  }
  if (factory === undefined) {
    return {
      members: { properties: {}, shadowed: [], unresolved: [sourceOf(unwrapped)] },
    };
  }

  const config = factory.config ? membersOf(factory.config, ctx, visited) : complete();
  if (factory.method === 'story') {
    return { members: config, accessor: 'input' };
  }

  const parent = bindingMembers(ctx, factory.parent, position, visited);
  // A parent another module owns would mix nodes whose names resolve elsewhere into a record read
  // as local, so it is reported instead of merged.
  if (
    parent === undefined ||
    parent.kind === 'namespace' ||
    parent.accessor !== 'input' ||
    parent.external
  ) {
    return undefined;
  }
  const merged = mergedAnnotations(parent.members, config);
  return {
    members: {
      properties: merged.properties,
      shadowed: [
        ...parent.members.shadowed.filter((key) => !(key in config.properties)),
        ...config.shadowed,
      ],
      unresolved: [...parent.members.unresolved, ...config.unresolved],
    },
    accessor: 'input',
  };
};

/** Annotations `extend` merges per key rather than replacing outright. */
const MERGED_ANNOTATIONS = ['args', 'argTypes', 'parameters', 'globals'];

/**
 * Config members an `extend` call ends up with.
 *
 * `extend` composes annotations rather than spreading the object, so a record the parent and the
 * child both declare keeps the parent's entries the child does not name. The merge is expressed as
 * an object of two spreads so that resolving it reads both sides the same way any other spread is
 * read, whether each side is written out or named.
 */
const mergedAnnotations = (
  parent: Pick<ResolvedMembers, 'properties'>,
  child: Pick<ResolvedMembers, 'properties'>
): { properties: Record<string, t.Node> } => {
  const properties = { ...parent.properties, ...child.properties };

  for (const key of MERGED_ANNOTATIONS) {
    const from = parent.properties[key];
    const over = child.properties[key];
    if (
      from === undefined ||
      over === undefined ||
      !t.isExpression(from) ||
      !t.isExpression(over)
    ) {
      continue;
    }
    properties[key] = t.objectExpression([t.spreadElement(from), t.spreadElement(over)]);
  }

  return { properties };
};

/** A CSF factory call, which holds its config behind `input` rather than as its own members. */
const factoryCall = (
  node: t.Node
): { method: 'story' | 'extend'; parent: string; config?: t.ObjectExpression } | undefined => {
  if (!isCsfFactoryCall(node)) {
    return undefined;
  }
  const method = node.callee.property.name;
  if (method !== 'story' && method !== 'extend') {
    return undefined;
  }
  const [argument] = node.arguments;
  const config = argument && unwrapExpression(argument);
  if (argument !== undefined && (config === undefined || !t.isObjectExpression(config))) {
    return undefined;
  }
  return {
    method,
    parent: node.callee.object.name,
    ...(config && t.isObjectExpression(config) ? { config } : {}),
  };
};

/**
 * Members a top-level `Name.key = value` assignment adds, which is the CSF2 annotation form.
 *
 * Only assignments that have already run at `position` count. An assignment reaching deeper than one
 * level is reported rather than applied: it changes an object this pass reads by reference, so the
 * record stays usable while saying that something inside it moved.
 */
const assignedMembers = (
  ctx: ReferenceContext,
  name: string,
  position: number | undefined
): {
  properties: Record<string, t.Node>;
  unresolved: string[];
} => {
  const properties: Record<string, t.Node> = {};
  const unresolved: string[] = [];

  for (const statement of ctx.program.node.body) {
    if (!t.isExpressionStatement(statement) || !t.isAssignmentExpression(statement.expression)) {
      continue;
    }
    const assignment = statement.expression;
    let target: t.Node = assignment.left;
    let depth = 0;
    let outermost: string | undefined;
    while (t.isMemberExpression(target)) {
      depth += 1;
      outermost =
        t.isIdentifier(target.property) && !target.computed
          ? target.property.name
          : t.isStringLiteral(target.property)
            ? target.property.value
            : undefined;
      target = target.object;
    }
    if (depth === 0 || !t.isIdentifier(target) || target.name !== name) {
      continue;
    }
    if (position !== undefined && (assignment.start ?? 0) > position) {
      continue;
    }
    if (depth > 1 || outermost === undefined || assignment.operator !== '=') {
      unresolved.push(sourceOf(assignment));
      continue;
    }
    properties[outermost] = assignment.right;
  }

  return { properties, unresolved };
};

const importedBinding = (
  ctx: ReferenceContext,
  specifierPath: NodePath<t.Node>,
  visited: Set<string>
): BoundMembers | undefined => {
  const specifier = specifierPath.node;
  const declaration = specifierPath.parent;
  if (
    !t.isImportDeclaration(declaration) ||
    declaration.importKind === 'type' ||
    !(
      t.isImportSpecifier(specifier) ||
      t.isImportDefaultSpecifier(specifier) ||
      t.isImportNamespaceSpecifier(specifier)
    ) ||
    isTypeSpecifier(specifier)
  ) {
    return undefined;
  }

  const target = resolveTargetModule(ctx, declaration.source.value);
  if (!target) {
    return undefined;
  }

  if (t.isImportNamespaceSpecifier(specifier)) {
    return { kind: 'namespace', ctx: target };
  }

  const exportName = t.isImportDefaultSpecifier(specifier)
    ? 'default'
    : importedName(specifier.imported);
  return exportedBinding(target, exportName, visited);
};

const resolveTargetModule = (
  ctx: ReferenceContext,
  specifier: string
): ReferenceContext | undefined => {
  const target = ctx.resolveModule?.(ctx.filePath, specifier);
  return target ? { ...ctx, ...target } : undefined;
};

/** The binding a module's export name reaches, following a re-export to the module that owns it. */
const exportedBinding = (
  ctx: ReferenceContext,
  exportName: string,
  visited: Set<string>
): BoundMembers | undefined => {
  const asExternal = (bound: BoundMembers | undefined) =>
    bound === undefined || bound.kind === 'namespace' ? bound : { ...bound, external: true };

  for (const statement of ctx.program.node.body) {
    if (t.isExportDefaultDeclaration(statement) && exportName === 'default') {
      const declaration = unwrapExpression(statement.declaration);
      if (t.isIdentifier(declaration)) {
        return asExternal(bindingMembers(ctx, declaration.name, undefined, visited));
      }
      return t.isObjectExpression(declaration)
        ? {
            kind: 'members',
            ctx,
            external: true,
            members: membersOf(declaration, ctx, visited),
          }
        : undefined;
    }

    if (!t.isExportNamedDeclaration(statement) || statement.exportKind === 'type') {
      continue;
    }
    const specifier = statement.specifiers.find(
      (candidate): candidate is t.ExportSpecifier =>
        t.isExportSpecifier(candidate) &&
        candidate.exportKind !== 'type' &&
        importedName(candidate.exported) === exportName
    );
    if (!specifier) {
      continue;
    }
    if (!statement.source) {
      return asExternal(bindingMembers(ctx, specifier.local.name, undefined, visited));
    }
    const target = resolveTargetModule(ctx, statement.source.value);
    return target ? exportedBinding(target, specifier.local.name, visited) : undefined;
  }

  // `export const X = …` binds `X` in module scope, so the local lookup is the export.
  return exportName === 'default'
    ? undefined
    : asExternal(bindingMembers(ctx, exportName, undefined, visited));
};
