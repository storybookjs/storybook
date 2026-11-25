import { logger } from 'storybook/internal/node-logger';

import type * as ts from 'typescript';

import type { Property } from '../types.ts';
import { resolvedSymbol, type AnalyzerContext } from './context.ts';
import {
  type BindingName,
  decoratorObjectArg,
  isAngularCoreOrUnresolved,
  objectProperty,
  parseBindingName,
  resolveReference,
  unwrap,
} from './decorators.ts';
import type { ClassMembers, MemberEntry } from './members.ts';

type IOBucket = 'inputs' | 'outputs';

interface HostDirectiveRef {
  declaration: ts.ClassDeclaration;
  inputs: BindingName[];
  outputs: BindingName[];
}

const MODEL_OUTPUT_SUFFIX = 'Change';

// Bounds how deeply spreads of `hostDirectives` arrays nest, which a self-spreading constant would
// otherwise recurse through forever.
const MAX_SPREAD_DEPTH = 10;

/**
 * Add the inputs and outputs a `@Component`/`@Directive` exposes through `hostDirectives`.
 *
 * They are not class members, so the member visitor never sees them. Angular inherits
 * `hostDirectives`, so `hosts` is the class followed by its bases, and the caller passes `members`
 * with the whole base chain already merged: a binding the class or a base declares itself then
 * takes precedence over one a host directive exposes under the same public name. Angular exposes
 * only the bindings a host lists, under the public name it gives them, so a bare directive
 * reference contributes nothing. `resolveMembers` reads a host directive's own surface, its bases
 * and its own host directives included.
 */
export function applyHostDirectives(
  ctx: AnalyzerContext,
  hosts: ts.ClassLikeDeclaration[],
  members: ClassMembers,
  resolveMembers: (declaration: ts.ClassDeclaration) => ClassMembers | undefined
): void {
  const hostName = hosts[0]?.name?.text ?? 'an anonymous class';
  for (const ref of hosts.flatMap((host) => readHostDirectives(ctx, host))) {
    if (!ref.inputs.length && !ref.outputs.length) {
      continue;
    }
    const exposed = resolveMembers(ref.declaration);
    if (!exposed) {
      continue;
    }
    const directiveName = ref.declaration.name?.text ?? 'an anonymous directive';
    const leaveOut = (binding: BindingName, kind: 'input' | 'output') =>
      logger.debug(
        `[angular-cm] ${hostName} host directive ${directiveName}.${binding.name} left out of docgen: no such ${kind}`
      );

    // A model's public input name, by the model's own name, for each model whose input half is
    // exposed; its output half pairs with it only under the matching `Change` name.
    const exposedModelInputs = new Map<string, string>();
    for (const binding of ref.inputs) {
      const entry = exposed.inputs.find((candidate) => isNamed(candidate, binding.name));
      if (!entry) {
        leaveOut(binding, 'input');
        continue;
      }
      const name = binding.alias ?? binding.name;
      if (expose(members, 'inputs', entry, name) && isModel(entry)) {
        exposedModelInputs.set(entry.value.name, name);
      }
    }

    for (const binding of ref.outputs) {
      const name = binding.alias ?? binding.name;
      const output = exposed.outputs.find(
        (candidate) => isNamed(candidate, binding.name) && !isModel(candidate)
      );
      if (output) {
        expose(members, 'outputs', output, name);
        continue;
      }
      const model = binding.name.endsWith(MODEL_OUTPUT_SUFFIX)
        ? exposed.outputs.find(
            (candidate) =>
              isModel(candidate) &&
              isNamed(candidate, binding.name.slice(0, -MODEL_OUTPUT_SUFFIX.length))
          )
        : undefined;
      if (!model) {
        leaveOut(binding, 'output');
        continue;
      }
      const pairedInput = exposedModelInputs.get(model.value.name);
      if (pairedInput !== undefined && name === `${pairedInput}${MODEL_OUTPUT_SUFFIX}`) {
        // The extractor pairs a model's halves by their shared bare name.
        expose(members, 'outputs', model, pairedInput);
      } else {
        expose(members, 'outputs', asPlainOutput(model), name);
      }
    }
  }
}

const isModel = (entry: MemberEntry<Property>): boolean =>
  entry.typeSource?.kind === 'signal' && entry.typeSource.signalKind === 'model';

const isNamed = (entry: MemberEntry<Property>, name: string): boolean =>
  !entry.isStatic && entry.value.name === name;

// A model's output half on its own, typed and shown as an `output()` of the model's value.
const asPlainOutput = (model: MemberEntry<Property>): MemberEntry<Property> => {
  const { initializer: _default, ...value } = model.value;
  return { ...model, typeSource: { kind: 'signal', signalKind: 'output' }, value };
};

// A model sits in `outputs` under its bare name, but a template binds its output as `<name>Change`.
const boundName = (entry: MemberEntry<Property>, bucket: IOBucket): string =>
  bucket === 'outputs' && isModel(entry)
    ? `${entry.value.name}${MODEL_OUTPUT_SUFFIX}`
    : entry.value.name;

/** Add `entry` to `members[bucket]` as `name`, unless that bucket already binds the same name. */
function expose(
  members: ClassMembers,
  bucket: IOBucket,
  entry: MemberEntry<Property>,
  name: string
): boolean {
  const added = { ...entry, value: { ...entry.value, name } };
  const bound = boundName(added, bucket);
  if (members[bucket].some((own) => boundName(own, bucket) === bound)) {
    return false;
  }
  members[bucket].push(added);
  return true;
}

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
  if (!list || !ts.isArrayLiteralExpression(list) || depth > MAX_SPREAD_DEPTH) {
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

function readBindings(ctx: AnalyzerContext, expression: ts.Expression | undefined): BindingName[] {
  const list = expression && resolveReference(ctx, expression);
  if (!list || !ctx.ts.isArrayLiteralExpression(list)) {
    return [];
  }
  return list.elements.flatMap((element) => {
    const value = resolveReference(ctx, element);
    const binding = value && ctx.ts.isStringLiteralLike(value) && parseBindingName(value.text);
    return binding ? [binding] : [];
  });
}

function directiveDeclaration(
  ctx: AnalyzerContext,
  expression: ts.Expression
): ts.ClassDeclaration | undefined {
  const target = unwrapForwardRef(ctx, unwrap(ctx, expression));
  if (!ctx.ts.isIdentifier(target) && !ctx.ts.isPropertyAccessExpression(target)) {
    return undefined;
  }
  return resolvedSymbol(ctx, target)?.declarations?.find(
    (candidate): candidate is ts.ClassDeclaration => ctx.ts.isClassDeclaration(candidate)
  );
}

// `forwardRef(() => Directive)` from `@angular/core`, for a directive declared later in the file.
function unwrapForwardRef(ctx: AnalyzerContext, expression: ts.Expression): ts.Expression {
  const { ts } = ctx;
  if (!ts.isCallExpression(expression) || expression.arguments.length !== 1) {
    return expression;
  }
  const callee = expression.expression;
  const [factory] = expression.arguments;
  const calleeName = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : undefined;
  const isForwardRef =
    calleeName !== undefined &&
    (resolvedSymbol(ctx, callee)?.name ?? calleeName) === 'forwardRef' &&
    isAngularCoreOrUnresolved(ctx, callee);
  if (!isForwardRef || !ts.isArrowFunction(factory) || ts.isBlock(factory.body)) {
    return expression;
  }
  return unwrap(ctx, factory.body);
}
