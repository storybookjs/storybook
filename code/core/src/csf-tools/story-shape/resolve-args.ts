// Follows the references a story hides its args behind: a spread of a constant, of a sibling story,
// or of something another module owns, and an arg value written as a name rather than a value.
import { generate, type NodePath, types as t } from 'storybook/internal/babel';

import { type ImportRef } from './import-statements.ts';
import { collectImportBindings, importedName, isTypeSpecifier } from './imports.ts';
import { keyOf, unwrapExpression } from './utils.ts';

/** Members of an object, and what reading it statically could not account for. */
export interface ResolvedMembers {
  /** Member name → value node. */
  properties: Record<string, t.Node>;
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

/** Source text of a node, for naming an expression a static pass could not read. */
export const sourceOf = (node: t.Node): string =>
  generate(node, { concise: true, comments: false }).code;

const complete = (properties: Record<string, t.Node> = {}): ResolvedMembers => ({
  properties,
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
): ResolvedMembers => membersOf(object, ctx, new Set(), true);

/**
 * An `args` record, absorbing every spread the context can follow.
 *
 * Unlike {@link resolveObjectMembers} every member has to reduce to a printable value, so a method
 * shorthand is reported rather than kept.
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
    return membersOf(unwrapped, ctx, new Set(), false);
  }
  // `args: shared` names its record instead of writing one, which reads the same as spreading it.
  const referenced = resolveReference(ctx, unwrapped, node.start ?? undefined, new Set());
  return referenced ?? { properties: {}, unresolved: [`args: ${sourceOf(unwrapped)}`] };
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

const membersOf = (
  object: t.ObjectExpression,
  ctx: ReferenceContext,
  visited: Set<string>,
  keepMethods: boolean
): ResolvedMembers => {
  const properties: Record<string, t.Node> = {};
  const unresolved: string[] = [];

  for (const property of object.properties) {
    if (t.isSpreadElement(property)) {
      const spread = spreadMembers(ctx, property, visited);
      if (spread === undefined || spread.unresolved.length > 0) {
        unresolved.push(sourceOf(property));
        continue;
      }
      Object.assign(properties, spread.properties);
      continue;
    }

    // A dynamic key, an accessor or a value only calling it produces can supply or shadow any
    // member at runtime.
    const opaqueMethod =
      t.isObjectMethod(property) &&
      (!keepMethods || property.kind !== 'method' || property.generator);
    const key = opaqueMethod ? null : keyOf(property);
    if (key === null) {
      unresolved.push(sourceOf(property));
      continue;
    }
    properties[key] = t.isObjectMethod(property) ? property : property.value;
  }

  return { properties, unresolved };
};

/** The object a spread copies from, whether it is written out or named. */
const spreadMembers = (
  ctx: ReferenceContext,
  spread: t.SpreadElement,
  visited: Set<string>
): ResolvedMembers | undefined => {
  const argument = unwrapExpression(spread.argument);
  return t.isObjectExpression(argument)
    ? membersOf(argument, ctx, visited, true)
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

  let { members } = located;
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
    members = membersOf(unwrapped, located.ctx, visited, true);
  }

  return located.external ? externalized(members, located.ctx) : members;
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
  return { properties, unresolved: members.unresolved };
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

  if (!binding.constant || !t.isVariableDeclarator(binding.path.node)) {
    return undefined;
  }
  if (position !== undefined && (binding.path.node.start ?? Number.POSITIVE_INFINITY) > position) {
    return undefined;
  }

  const init = binding.path.node.init;
  const declared = init ? declaredMembers(ctx, init, position, visited) : { members: complete() };
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
      unresolved: [...declared.members.unresolved, ...assigned.unresolved],
    },
  };
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
    return { members: membersOf(unwrapped, ctx, visited, true) };
  }

  const factory = factoryCall(unwrapped);
  if (factory === undefined) {
    // A function story carries no config of its own; a CSF2 assignment is still readable.
    return { members: complete() };
  }

  const config = factory.config ? membersOf(factory.config, ctx, visited, true) : complete();
  if (factory.method === 'story') {
    return { members: config, accessor: 'input' };
  }

  const parent = bindingMembers(ctx, factory.parent, position, visited);
  if (parent === undefined || parent.kind === 'namespace' || parent.accessor !== 'input') {
    return undefined;
  }
  return {
    members: {
      properties: mergedAnnotations(parent.members.properties, config.properties),
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
  parent: Record<string, t.Node>,
  child: Record<string, t.Node>
): Record<string, t.Node> => {
  const merged = { ...parent, ...child };

  for (const key of MERGED_ANNOTATIONS) {
    const from = parent[key];
    const over = child[key];
    if (
      from === undefined ||
      over === undefined ||
      !t.isExpression(from) ||
      !t.isExpression(over)
    ) {
      continue;
    }
    merged[key] = t.objectExpression([t.spreadElement(from), t.spreadElement(over)]);
  }

  return merged;
};

/** A CSF factory call, which holds its config behind `input` rather than as its own members. */
const factoryCall = (
  node: t.Node
): { method: 'story' | 'extend'; parent: string; config?: t.ObjectExpression } | undefined => {
  if (
    !t.isCallExpression(node) ||
    !t.isMemberExpression(node.callee) ||
    node.callee.computed ||
    !t.isIdentifier(node.callee.property) ||
    !t.isIdentifier(node.callee.object)
  ) {
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
): ResolvedMembers => {
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
            members: membersOf(declaration, ctx, visited, true),
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

/** An arg value read through to the definition it names, and what printing it still depends on. */
export interface ResolvedArgValue {
  /** Node to print in place of what was written. */
  node: t.Node;
  /** Imports the printed node needs to resolve where the snippet lands. */
  imports: ImportRef[];
  /** Source text of every name the printed node depends on that no import can supply. */
  unresolved: string[];
}

/**
 * The value an arg node stands for, following a name to the definition it refers to.
 *
 * A name the story file declares resolves to the value it was declared with, since that name means
 * nothing where the snippet lands. A name another module owns stays as written and reports the
 * import that makes it resolve. Names a larger expression reaches for are reported the same way,
 * except that a locally declared one can only be named, not substituted into the expression.
 */
export const resolveArgValue = (node: t.Node, ctx: ReferenceContext): ResolvedArgValue => {
  const unresolved: string[] = [];
  const resolved = inlineSpreads(
    followValue(unwrapExpression(node), ctx, new Set()),
    ctx,
    unresolved
  );
  const bindings = collectImportBindings(ctx.program);
  const imports: ImportRef[] = [];

  for (const name of freeNames(resolved)) {
    const imported = bindings.get(name);
    if (imported) {
      imports.push({
        localImportName: name,
        importId: imported.importId,
        importName: imported.importName,
        ...(imported.importName === '*' ? { namespace: name } : {}),
      });
      continue;
    }
    if (ctx.program.scope.getBinding(name)) {
      unresolved.push(name);
    }
  }

  return { node: resolved, imports, unresolved };
};

/**
 * Whether printing a node needs no name from the scope it was written in.
 *
 * This is the bar a value copied out of another module has to clear, since the names that module
 * declares and imports mean nothing where the snippet lands.
 */
export const isSelfContained = (node: t.Node): boolean => freeNames(node).size === 0;

/**
 * Writes out the spreads inside a value, so an arg holding an object shows what that object holds.
 *
 * A spread this pass cannot read leaves its object exactly as written: printing part of it would
 * claim the value is something it is not, where printing the source at least shows the story.
 */
const inlineSpreads = (node: t.Node, ctx: ReferenceContext, unresolved: string[]): t.Node => {
  // A value with nothing to pull in is returned as it was parsed, so it keeps the story's own
  // formatting rather than being reprinted from a rebuilt tree.
  if (!hasNamedSpread(node)) {
    return node;
  }

  if (t.isArrayExpression(node)) {
    return t.arrayExpression(
      node.elements.map((element) =>
        element && t.isExpression(element)
          ? (inlineSpreads(element, ctx, unresolved) as t.Expression)
          : element
      )
    );
  }

  if (!t.isObjectExpression(node)) {
    return node;
  }
  if (!node.properties.some((property) => t.isSpreadElement(property))) {
    return objectFrom(node.properties, ctx, unresolved) ?? node;
  }

  const members = membersOf(node, ctx, new Set(), false);
  if (members.unresolved.length > 0) {
    unresolved.push(...members.unresolved);
    return node;
  }
  return (
    objectFrom(
      Object.entries(members.properties).map(([key, value]) =>
        t.objectProperty(
          t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key),
          value as t.Expression
        )
      ),
      ctx,
      unresolved
    ) ?? node
  );
};

/**
 * Whether a value spreads something it names rather than something written out on the spot.
 *
 * Only a named spread is worth writing out: `{ ...{ a: 1 }, b: 2 }` already says what it holds, so
 * rewriting it would reprint the story's own source for no gain.
 */
const hasNamedSpread = (node: t.Node): boolean => {
  if (t.isArrayExpression(node)) {
    return node.elements.some(
      (element) => element !== null && t.isExpression(element) && hasNamedSpread(element)
    );
  }
  return (
    t.isObjectExpression(node) &&
    node.properties.some((property) =>
      t.isSpreadElement(property)
        ? !t.isObjectExpression(unwrapExpression(property.argument))
        : t.isObjectProperty(property) &&
          t.isExpression(property.value) &&
          hasNamedSpread(property.value)
    )
  );
};

/** An object literal with every member value's own spreads written out, when they all can be. */
const objectFrom = (
  properties: t.ObjectExpression['properties'],
  ctx: ReferenceContext,
  unresolved: string[]
): t.ObjectExpression | undefined => {
  const rebuilt: t.ObjectExpression['properties'] = [];
  for (const property of properties) {
    if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
      return undefined;
    }
    rebuilt.push(
      t.objectProperty(
        property.key,
        inlineSpreads(property.value, ctx, unresolved) as t.Expression,
        property.computed
      )
    );
  }
  return t.objectExpression(rebuilt);
};

/** Reads a bare name through to the value it was declared with, as far as the chain goes. */
const followValue = (node: t.Node, ctx: ReferenceContext, seen: Set<string>): t.Node => {
  if (!t.isIdentifier(node) || seen.has(node.name)) {
    return node;
  }
  const binding = ctx.program.scope.getBinding(node.name);
  if (
    !binding ||
    binding.kind === 'module' ||
    !binding.constant ||
    !t.isVariableDeclarator(binding.path.node) ||
    !binding.path.node.init
  ) {
    return node;
  }
  seen.add(node.name);
  return followValue(unwrapExpression(binding.path.node.init), ctx, seen);
};

/**
 * Names an expression reaches for from outside itself.
 *
 * Property keys and member accesses name nothing, and a name the expression declares itself resolves
 * within it, so none of those are reported.
 */
const freeNames = (node: t.Node): Set<string> => {
  const declared = new Set<string>();
  const skipped = new Set<t.Node>();
  const candidates: t.Identifier[] = [];

  const declare = (target: t.Node | null | undefined) => {
    if (t.isIdentifier(target)) {
      declared.add(target.name);
      skipped.add(target);
      return;
    }
    if (target) {
      t.traverseFast(target, (inner) => {
        if (t.isIdentifier(inner)) {
          declared.add(inner.name);
          skipped.add(inner);
        }
      });
    }
  };

  t.traverseFast(node, (current) => {
    if (t.isObjectProperty(current) || t.isObjectMethod(current)) {
      if (!current.computed) {
        skipped.add(current.key);
      }
    }
    if (t.isMemberExpression(current) && !current.computed) {
      skipped.add(current.property);
    }
    if (t.isFunction(current)) {
      current.params.forEach(declare);
    }
    if (t.isVariableDeclarator(current)) {
      declare(current.id);
    }
    if (t.isIdentifier(current)) {
      candidates.push(current);
    }
  });

  return new Set(
    candidates
      .filter((identifier) => !skipped.has(identifier) && !declared.has(identifier.name))
      .map((identifier) => identifier.name)
  );
};
