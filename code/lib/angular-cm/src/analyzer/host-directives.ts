import { logger } from 'storybook/internal/node-logger';

import type * as ts from 'typescript';

import type { Property } from '../types.ts';
import { resolvedSymbol, type AnalyzerContext } from './context.ts';
import { decoratorObjectArg, objectProperty } from './decorators.ts';
import type { ClassMembers, MemberEntry } from './members.ts';

type IOBucket = 'inputs' | 'outputs';

interface ExposedBinding {
  /** The host directive's own public name for the binding. */
  name: string;
  /** The name the host re-exposes it under, when it renames it. */
  alias?: string;
}

interface HostDirectiveRef {
  declaration: ts.ClassDeclaration;
  inputs: ExposedBinding[];
  outputs: ExposedBinding[];
}

const MODEL_OUTPUT_SUFFIX = 'Change';

// Bounds the variable-to-initializer chain, which a self-referencing constant would otherwise loop.
const MAX_REFERENCE_DEPTH = 10;

/**
 * Add the inputs and outputs a `@Component`/`@Directive` exposes through `hostDirectives`.
 *
 * They are not class members, so the member visitor never sees them. Angular exposes only the
 * bindings the host lists, under the public name the host gives them, so a bare directive reference
 * contributes nothing. `resolveMembers` is how a host directive's own surface is read, its bases
 * and its own host directives included.
 */
export function applyHostDirectives(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  members: ClassMembers,
  resolveMembers: (declaration: ts.ClassDeclaration) => ClassMembers | undefined
): void {
  for (const ref of readHostDirectives(ctx, classNode)) {
    if (!ref.inputs.length && !ref.outputs.length) {
      continue;
    }
    // A declaration file records no decorators or signal calls, so it has no IO to read.
    if (ref.declaration.getSourceFile().isDeclarationFile) {
      continue;
    }
    const exposed = resolveMembers(ref.declaration);
    if (!exposed) {
      continue;
    }
    const directiveName = ref.declaration.name?.text ?? 'an anonymous directive';
    exposeBindings(members, exposed, ref.inputs, 'inputs', directiveName, classNode);
    exposeBindings(members, exposed, ref.outputs, 'outputs', directiveName, classNode);
  }
}

function exposeBindings(
  members: ClassMembers,
  exposed: ClassMembers,
  bindings: ExposedBinding[],
  bucket: IOBucket,
  directiveName: string,
  classNode: ts.ClassLikeDeclaration
): void {
  for (const binding of bindings) {
    const match = findExposed(exposed, bucket, binding);
    const hostName = classNode.name?.text ?? 'an anonymous class';
    if (!match) {
      logger.debug(
        `[angular-cm] ${hostName} host directive ${directiveName}.${binding.name} left out of docgen: no such ${bucket.slice(0, -1)}`
      );
      continue;
    }
    const name = match.publicName(binding.alias ?? binding.name);
    if (name === undefined) {
      logger.debug(
        `[angular-cm] ${hostName} host directive ${directiveName}.${binding.name} left out of docgen: a model output re-exposed without a \`Change\` suffix`
      );
      continue;
    }
    // The host's own binding of the same public name is the one its docs describe.
    if (members[bucket].some((entry) => entry.value.name === name)) {
      continue;
    }
    members[bucket].push({
      ...match.entry,
      // Not a field of the host, so it must never merge with one by identity.
      declName: `${directiveName}#${match.entry.declName}`,
      value: { ...match.entry.value, name },
    });
  }
}

/**
 * Find the binding a host lists, by the host directive's public name.
 *
 * A `model()` is filed under its bare name in both buckets, while Angular lists its output half as
 * `<name>Change`; the match keeps the bare-name convention so the extractor still pairs the two.
 */
function findExposed(
  exposed: ClassMembers,
  bucket: IOBucket,
  binding: ExposedBinding
): { entry: MemberEntry<Property>; publicName: (name: string) => string | undefined } | undefined {
  const plain = exposed[bucket].find(
    (entry) => !entry.isStatic && entry.value.name === binding.name && !isModel(entry)
  );
  if (plain) {
    return { entry: plain, publicName: (name) => name };
  }
  if (bucket === 'inputs') {
    const model = exposed.inputs.find(
      (entry) => !entry.isStatic && entry.value.name === binding.name && isModel(entry)
    );
    return model && { entry: model, publicName: (name) => name };
  }
  if (!binding.name.endsWith(MODEL_OUTPUT_SUFFIX)) {
    return undefined;
  }
  const bareName = binding.name.slice(0, -MODEL_OUTPUT_SUFFIX.length);
  const model = exposed.outputs.find(
    (entry) => !entry.isStatic && entry.value.name === bareName && isModel(entry)
  );
  return (
    model && {
      entry: model,
      publicName: (name) =>
        name.endsWith(MODEL_OUTPUT_SUFFIX) ? name.slice(0, -MODEL_OUTPUT_SUFFIX.length) : undefined,
    }
  );
}

const isModel = (entry: MemberEntry<Property>): boolean =>
  entry.typeSource?.kind === 'signal' && entry.typeSource.signalKind === 'model';

function readHostDirectives(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration
): HostDirectiveRef[] {
  const refs: HostDirectiveRef[] = [];
  for (const decoratorName of ['Component', 'Directive']) {
    const metadata = decoratorObjectArg(ctx, classNode, decoratorName);
    const hostDirectives = metadata && objectProperty(ctx, metadata, 'hostDirectives');
    if (hostDirectives) {
      collectHostDirectives(ctx, hostDirectives, refs, 0);
    }
  }
  return refs;
}

// `hostDirectives` entries are a directive reference, or `{ directive, inputs, outputs }`. Either,
// the array itself, and its `inputs`/`outputs` arrays may sit behind a constant, which is how a
// directive shares one exposure config between the hosts that compose it.
function collectHostDirectives(
  ctx: AnalyzerContext,
  expression: ts.Expression,
  refs: HostDirectiveRef[],
  depth: number
): void {
  const { ts } = ctx;
  const list = resolveReference(ctx, expression);
  if (!list || !ts.isArrayLiteralExpression(list) || depth > MAX_REFERENCE_DEPTH) {
    return;
  }
  for (const element of list.elements) {
    if (ts.isSpreadElement(element)) {
      collectHostDirectives(ctx, element.expression, refs, depth + 1);
      continue;
    }
    const resolved = resolveReference(ctx, element);
    if (!resolved || !ts.isObjectLiteralExpression(resolved)) {
      // A bare directive reference exposes none of its bindings.
      continue;
    }
    const directive = objectProperty(ctx, resolved, 'directive');
    const declaration = directive && directiveDeclaration(ctx, directive);
    if (!declaration) {
      continue;
    }
    refs.push({
      declaration,
      inputs: readBindings(ctx, objectProperty(ctx, resolved, 'inputs')),
      outputs: readBindings(ctx, objectProperty(ctx, resolved, 'outputs')),
    });
  }
}

// Angular accepts `'name'` and `'name: alias'` here, and nothing else.
function readBindings(
  ctx: AnalyzerContext,
  expression: ts.Expression | undefined
): ExposedBinding[] {
  const list = expression && resolveReference(ctx, expression);
  if (!list || !ctx.ts.isArrayLiteralExpression(list)) {
    return [];
  }
  const bindings: ExposedBinding[] = [];
  for (const element of list.elements) {
    const value = resolveReference(ctx, element);
    if (!value || !ctx.ts.isStringLiteralLike(value)) {
      continue;
    }
    const [name, alias] = value.text.split(':').map((part) => part.trim());
    if (name) {
      bindings.push({ name, ...(alias ? { alias } : {}) });
    }
  }
  return bindings;
}

function directiveDeclaration(
  ctx: AnalyzerContext,
  expression: ts.Expression
): ts.ClassDeclaration | undefined {
  const { ts } = ctx;
  let target = unwrap(ctx, expression);
  // `forwardRef(() => Directive)`, for a directive declared later in the file.
  if (ts.isCallExpression(target) && target.arguments.length === 1) {
    const [factory] = target.arguments;
    if (ts.isArrowFunction(factory) && !ts.isBlock(factory.body)) {
      target = unwrap(ctx, factory.body);
    }
  }
  if (!ts.isIdentifier(target) && !ts.isPropertyAccessExpression(target)) {
    return undefined;
  }
  return resolvedSymbol(ctx, target)?.declarations?.find(
    (candidate): candidate is ts.ClassDeclaration => ts.isClassDeclaration(candidate)
  );
}

/** Follow a reference to a constant through to its initializer, as decorator metadata allows. */
function resolveReference(
  ctx: AnalyzerContext,
  expression: ts.Expression
): ts.Expression | undefined {
  const { ts } = ctx;
  let current = unwrap(ctx, expression);
  for (let depth = 0; depth < MAX_REFERENCE_DEPTH; depth++) {
    if (!ts.isIdentifier(current)) {
      return current;
    }
    const declaration = resolvedSymbol(ctx, current)?.valueDeclaration;
    if (!declaration || !ts.isVariableDeclaration(declaration)) {
      // Not a constant, e.g. a class: the reference is the value.
      return current;
    }
    if (!declaration.initializer) {
      return undefined;
    }
    current = unwrap(ctx, declaration.initializer);
  }
  return undefined;
}

// `as const`, `satisfies HostDirectiveConfig`, parentheses and `!` change nothing Angular reads.
function unwrap(ctx: AnalyzerContext, expression: ts.Expression): ts.Expression {
  const { ts } = ctx;
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}
