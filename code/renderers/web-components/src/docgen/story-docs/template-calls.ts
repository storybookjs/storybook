import { types as t } from 'storybook/internal/babel';
import type {
  ImportBinding,
  ReferenceContext,
  ReferenceModule,
} from 'storybook/internal/csf-tools';
import { collectImportBindings, keyOf, unwrapExpression } from 'storybook/internal/csf-tools';

import { evaluateArgValue } from './arg-values.ts';

/** A module whose code a template is cut from, and the names it imports. */
export interface TemplateModule {
  bindings: Map<string, ImportBinding>;
  code: string;
  program: t.Program;
  resolveModule: (specifier: string) => TemplateModule | undefined;
}

/** The scope an expression is read in: what each name it can see holds. */
export interface Frame {
  module: TemplateModule;
  names: Map<string, Binding>;
}

/**
 * What a name holds while a template is written.
 *
 * - `arg`: one arg, or a value inside it; `fallback` is the default a parameter gives it.
 * - `args`: the args object, with the `entries` a call wrote over it as in `{ ...args, size: 50 }`
 *   and without the `omitted` ones a rest pattern left out; one that is not `open` holds only its
 *   entries.
 * - `value`: a literal.
 * - `code`: an expression of the frame it was written in.
 * - `blocked`: a value no hole stands for.
 */
export type Binding =
  | { kind: 'arg'; name: string; path: string[]; fallback?: Fallback }
  | { kind: 'args'; entries: Map<string, Binding>; omitted: Set<string>; open: boolean }
  | { kind: 'value'; value: unknown }
  | { kind: 'code'; expression: t.Expression; frame: Frame }
  | { kind: 'blocked' };

export type Fallback = Extract<Binding, { kind: 'value' | 'code' }>;

/** The html of a lit template, and the frame its expressions are read in. */
export interface Markup {
  quasis: string[];
  expressions: t.Expression[];
  frame: Frame;
}

const LIT_SOURCES = [
  'lit',
  'lit-html',
  'lit-element',
  'lit/index.js',
  'lit/html.js',
  'lit-html/lit-html.js',
  'lit-element/lit-element.js',
  '@lion/core',
];
const MAX_DEPTH = 8;
const MAX_MODULES = 64;
const BLOCKED: Binding = { kind: 'blocked' };
const UNDEFINED: Binding = { kind: 'value', value: undefined };

const modules = new WeakMap<t.Program, TemplateModule>();

export function templateModule(
  { program, filePath }: ReferenceModule,
  resolve: ReferenceContext['resolveModule']
): TemplateModule {
  const known = modules.get(program.node);
  if (known) {
    return known;
  }
  const open = (specifier: string) => {
    // A TypeScript module is imported by the name of the `.js` file it compiles to.
    const found =
      resolve?.(filePath, specifier) ??
      (/^\.{1,2}\/.*\.[cm]?jsx?$/.test(specifier)
        ? resolve?.(filePath, specifier.replace(/\.[cm]?jsx?$/, ''))
        : undefined);
    return found && templateModule(found, resolve);
  };
  const module: TemplateModule = {
    bindings: collectImportBindings(program),
    code: (program.hub as unknown as { file: { code: string } }).file.code,
    program: program.node,
    resolveModule: open,
  };
  modules.set(program.node, module);
  return module;
}

/** The frame of a render function, whose first parameter holds the args. */
export function renderFrame(
  render: t.Function,
  module: TemplateModule
): { frame: Frame; returned: t.Expression } | undefined {
  const frame: Frame = { module, names: new Map() };
  const [first] = render.params;
  const param = t.isAssignmentPattern(first) ? first.left : first;
  const args: Binding = { kind: 'args', entries: new Map(), omitted: new Set(), open: true };
  if (param && !(t.isLVal(param) && bindPattern(param, args, frame))) {
    return undefined;
  }
  const returned = returnedIn(render, frame);
  return returned && { frame, returned };
}

/** What an expression holds, when it is a name or a member of one that a frame binds. */
export function resolveBinding(expression: t.Node, frame: Frame): Binding | undefined {
  const node = unwrapExpression(expression);
  if (t.isIdentifier(node)) {
    const binding = frame.names.get(node.name);
    if (binding?.kind !== 'code') {
      return binding;
    }
    // A name for an arg of the calling template reads that arg.
    const through = resolveBinding(binding.expression, binding.frame);
    return through?.kind === 'arg' || through?.kind === 'args' ? through : binding;
  }
  if (!t.isMemberExpression(node)) {
    return undefined;
  }
  const object = resolveBinding(node.object, frame);
  const property =
    !node.computed && t.isIdentifier(node.property)
      ? node.property.name
      : node.computed && t.isStringLiteral(node.property)
        ? node.property.value
        : undefined;
  if (object?.kind === 'args') {
    return property === undefined ? BLOCKED : memberOf(object, property);
  }
  if (object?.kind === 'arg') {
    return property === undefined || object.fallback
      ? undefined
      : { kind: 'arg', name: object.name, path: [...object.path, property] };
  }
  return object?.kind === 'blocked' ? BLOCKED : undefined;
}

/**
 * The lit template an expression is: one written in place, a name for one, or a call of a function
 * that returns one, read with its parameters bound to what the call passes.
 */
export function resolveMarkup(expression: t.Node, frame: Frame, depth = 0): Markup | undefined {
  const node = unwrapExpression(expression);
  if (depth > MAX_DEPTH) {
    return undefined;
  }
  if (t.isTaggedTemplateExpression(node)) {
    return t.isIdentifier(node.tag) && isLitHtml(node.tag.name, frame)
      ? {
          quasis: node.quasi.quasis.map((quasi) => quasi.value.raw),
          expressions: node.quasi.expressions.filter((item): item is t.Expression =>
            t.isExpression(item)
          ),
          frame,
        }
      : undefined;
  }
  if (t.isIdentifier(node)) {
    const binding = frame.names.get(node.name);
    return binding?.kind === 'code'
      ? resolveMarkup(binding.expression, binding.frame, depth + 1)
      : undefined;
  }
  if (!t.isCallExpression(node) || !t.isIdentifier(node.callee)) {
    return undefined;
  }
  if (frame.names.has(node.callee.name)) {
    return undefined;
  }
  const declared = functionOf(frame.module, node.callee.name);
  const fn = declared && unwrapExpression(declared.node);
  if (!declared || !t.isFunction(fn) || fn.async || fn.generator) {
    return undefined;
  }
  const called = bindCall(fn, node.arguments, frame, declared.module);
  const returned = called && returnedIn(fn, called);
  return called && returned ? resolveMarkup(returned, called, depth + 1) : undefined;
}

/** The name a callee was exported as, such as `spread` for `import { spread as s }`. */
export const calleeName = (callee: t.Node, frame: Frame): string | undefined =>
  t.isIdentifier(callee) && !frame.names.has(callee.name)
    ? (frame.module.bindings.get(callee.name)?.importName ?? callee.name)
    : undefined;

// The expression a function returns, after the constants its body declares are bound in its frame.
function returnedIn(fn: t.Function, frame: Frame): t.Expression | undefined {
  if (t.isExpression(fn.body)) {
    return fn.body;
  }
  const statements = fn.body.body;
  const last = statements.at(-1);
  if (!t.isReturnStatement(last) || !last.argument) {
    return undefined;
  }
  for (const statement of statements.slice(0, -1)) {
    if (!t.isVariableDeclaration(statement, { kind: 'const' })) {
      return undefined;
    }
    for (const { id, init } of statement.declarations) {
      const value = init && runOnce(bindingOf(init, frame), id, fn, 2);
      if (!value || !t.isLVal(id) || !bindPattern(id, value, frame)) {
        return undefined;
      }
    }
  }
  return last.argument;
}

function bindCall(
  fn: t.Function,
  passed: t.CallExpression['arguments'],
  caller: Frame,
  module: TemplateModule
): Frame | undefined {
  const frame: Frame = { module, names: new Map() };
  for (const [index, param] of fn.params.entries()) {
    const argument = passed[index];
    if (t.isRestElement(param) || (argument && !t.isExpression(argument))) {
      return undefined;
    }
    const [target, fallback] = t.isAssignmentPattern(param)
      ? [param.left, param.right]
      : [param, undefined];
    const passes = argument ? runOnce(bindingOf(argument, caller), target, fn, 1) : UNDEFINED;
    const value = withDefault(passes, fallback, frame);
    if (!value || !t.isLVal(target) || !bindPattern(target, value, frame)) {
      return undefined;
    }
  }
  return frame;
}

// Code is written wherever its name is read, which runs a call in it once per read: a name read
// twice cannot stand for one, unless the call is for html. `once` is how often the name is written
// when read once, which counts its declaration in the body.
function runOnce(binding: Binding, name: t.Node, fn: t.Function, once: number): Binding {
  return binding.kind === 'code' &&
    t.isIdentifier(name) &&
    runsCall(binding.expression) &&
    !resolveMarkup(binding.expression, binding.frame) &&
    countReads(fn.body, name.name) > once
    ? BLOCKED
    : binding;
}

const runsCall = (node: t.Node): boolean =>
  t.isCallExpression(node) ||
  t.isNewExpression(node) ||
  t.isAwaitExpression(node) ||
  t.isAssignmentExpression(node) ||
  t.isUpdateExpression(node) ||
  (!t.isFunction(node) && children(node).some(runsCall));

const countReads = (node: t.Node, name: string): number =>
  t.isIdentifier(node, { name })
    ? 1
    : children(node).reduce((count, child) => count + countReads(child, name), 0);

/** The nodes inside a node, without the names of the members and keys it writes. */
export const children = (node: t.Node): t.Node[] =>
  t.VISITOR_KEYS[node.type]!.flatMap((key) => {
    const named = !('computed' in node && node.computed) && ['property', 'key'].includes(key);
    const child = (node as unknown as Record<string, unknown>)[key];
    return named ? [] : [child].flat().filter((item): item is t.Node => t.isNode(item));
  });

// What an expression holds for the name it is passed or assigned to.
function bindingOf(expression: t.Expression, frame: Frame): Binding {
  const binding = resolveBinding(expression, frame);
  if (binding && binding.kind !== 'code') {
    return binding;
  }
  const node = unwrapExpression(expression);
  if (t.isObjectExpression(node)) {
    return recordOf(node, frame) ?? { kind: 'code', expression, frame };
  }
  const value = t.isFunction(node) ? undefined : evaluateArgValue(node);
  if (value?.kind === 'unset') {
    return UNDEFINED;
  }
  return value?.kind === 'value' && (value.value === null || typeof value.value !== 'object')
    ? { kind: 'value', value: value.value }
    : (binding ?? { kind: 'code', expression, frame });
}

// `{ ...args, size: 50 }`: the args with what is written after them, which is what the object holds.
function recordOf(object: t.ObjectExpression, frame: Frame): Binding | undefined {
  const [first, ...rest] = object.properties;
  const spread = t.isSpreadElement(first) ? resolveBinding(first.argument, frame) : undefined;
  if (t.isSpreadElement(first) && spread?.kind !== 'args') {
    return undefined;
  }
  const base = spread?.kind === 'args' ? spread : undefined;
  const entries = new Map(base?.entries);
  const omitted = new Set(base?.omitted);
  for (const property of base ? rest : object.properties) {
    const key = t.isObjectProperty(property) && !property.computed ? keyOf(property) : null;
    if (!t.isObjectProperty(property) || key === null || !t.isExpression(property.value)) {
      return undefined;
    }
    entries.set(key, bindingOf(property.value, frame));
    omitted.delete(key);
  }
  return { kind: 'args', entries, omitted, open: base?.open ?? false };
}

function memberOf(args: Extract<Binding, { kind: 'args' }>, key: string): Binding {
  return (
    args.entries.get(key) ??
    (args.open && !args.omitted.has(key) ? { kind: 'arg', name: key, path: [] } : UNDEFINED)
  );
}

// A default stands in only for `undefined`, which a value read out of the args may be.
function withDefault(
  value: Binding,
  fallback: t.Expression | undefined,
  frame: Frame
): Binding | undefined {
  if (!fallback || value.kind === 'args') {
    return value;
  }
  const standIn = bindingOf(fallback, frame);
  if (value.kind === 'value') {
    return value.value === undefined ? standIn : value;
  }
  return value.kind === 'arg' &&
    value.path.length === 0 &&
    !value.fallback &&
    (standIn.kind === 'value' || standIn.kind === 'code')
    ? { ...value, fallback: standIn }
    : undefined;
}

function bindPattern(pattern: t.LVal, value: Binding, frame: Frame): boolean {
  if (t.isIdentifier(pattern)) {
    frame.names.set(pattern.name, value);
    return true;
  }
  if (!t.isObjectPattern(pattern)) {
    return false;
  }
  const taken: string[] = [];
  return pattern.properties.every((property) => {
    if (t.isRestElement(property)) {
      return (
        value.kind === 'args' &&
        bindPattern(
          property.argument,
          {
            ...value,
            entries: new Map([...value.entries].filter(([key]) => !taken.includes(key))),
            omitted: new Set([...value.omitted, ...taken]),
          },
          frame
        )
      );
    }
    const key = property.computed ? null : keyOf(property);
    if (key === null) {
      return false;
    }
    taken.push(key);
    const [target, fallback] = t.isAssignmentPattern(property.value)
      ? [property.value.left, property.value.right]
      : [property.value, undefined];
    const member: Binding | undefined =
      value.kind === 'args'
        ? memberOf(value, key)
        : value.kind === 'arg' && !value.fallback
          ? { kind: 'arg', name: value.name, path: [...value.path, key] }
          : undefined;
    const bound = member && withDefault(member, fallback, frame);
    return !!bound && t.isLVal(target) && bindPattern(target, bound, frame);
  });
}

const isLitHtml = (name: string, frame: Frame): boolean => {
  const binding = frame.names.has(name) ? undefined : frame.module.bindings.get(name);
  const exported = binding && litExport(frame.module, binding, new Set());
  return exported === 'html' || exported === 'default';
};

/**
 * The imports of a module, with `html` and `nothing` as imports from `lit` wherever they are lit's:
 * from another of its entry points, or from a module of the project that exports them again.
 */
export function litBindings(module: TemplateModule): Map<string, ImportBinding> {
  const bindings = new Map(module.bindings);
  for (const [local, binding] of module.bindings) {
    const importName = ['html', 'nothing'].includes(binding.importName)
      ? litExport(module, binding, new Set())
      : undefined;
    if (importName) {
      bindings.set(local, { importId: 'lit', importName });
    }
  }
  return bindings;
}

// The name lit exports what an import binds as, also when a module of the project exports it again.
function litExport(
  from: TemplateModule,
  { importId, importName }: ImportBinding,
  seen: Set<t.Program>
): string | undefined {
  if (LIT_SOURCES.includes(importId)) {
    return importName;
  }
  const module = from.resolveModule(importId);
  if (!module || seen.has(module.program) || seen.size > MAX_MODULES) {
    return undefined;
  }
  seen.add(module.program);
  const local = localOf(module, importName);
  if (local) {
    const imported = module.bindings.get(local);
    return imported && litExport(module, imported, seen);
  }
  for (const next of exportsFrom(module, importName)) {
    const found = litExport(module, next, seen);
    if (found) {
      return found;
    }
  }
  return undefined;
}

// The function `name` holds, also as another name for it: `const Template = ButtonMarkup`.
function functionOf(
  module: TemplateModule,
  name: string,
  depth = 0
): ReturnType<typeof declarationOf> {
  const declared = declarationOf(module, name);
  const node = declared && unwrapExpression(declared.node);
  return declared && t.isIdentifier(node) && depth < MAX_DEPTH
    ? functionOf(declared.module, node.name, depth + 1)
    : declared;
}

// The function or constant a module declares or imports under `name`, and the module it is in.
function declarationOf(
  module: TemplateModule,
  name: string,
  seen = new Set<t.Program>()
): { node: t.Node; module: TemplateModule } | undefined {
  for (const statement of module.program.body) {
    const declaration =
      t.isExportNamedDeclaration(statement) || t.isExportDefaultDeclaration(statement)
        ? statement.declaration
        : statement;
    if (t.isFunctionDeclaration(declaration) && declaration.id?.name === name) {
      return { node: declaration, module };
    }
    if (t.isVariableDeclaration(declaration, { kind: 'const' })) {
      const found = declaration.declarations.find(({ id }) => t.isIdentifier(id, { name }));
      if (found?.init) {
        return { node: found.init, module };
      }
    }
  }
  const binding = module.bindings.get(name);
  return binding && exportOf(module, binding, seen);
}

function exportOf(
  from: TemplateModule,
  { importId, importName }: ImportBinding,
  seen: Set<t.Program>
): { node: t.Node; module: TemplateModule } | undefined {
  const module = from.resolveModule(importId);
  if (!module || seen.has(module.program) || seen.size > MAX_MODULES) {
    return undefined;
  }
  seen.add(module.program);
  const local = localOf(module, importName);
  if (local) {
    return declarationOf(module, local, seen);
  }
  if (importName === 'default') {
    const exported = module.program.body.find((statement) =>
      t.isExportDefaultDeclaration(statement)
    )?.declaration;
    return exported && t.isFunction(unwrapExpression(exported))
      ? { node: exported, module }
      : undefined;
  }
  for (const next of exportsFrom(module, importName)) {
    const found = exportOf(module, next, seen);
    if (found) {
      return found;
    }
  }
  return undefined;
}

// The local name a module exports as `name`, as a declaration or in `export { local as name }`.
function localOf(module: TemplateModule, name: string): string | undefined {
  for (const statement of module.program.body) {
    if (t.isExportDefaultDeclaration(statement) && name === 'default') {
      const { declaration } = statement;
      return t.isIdentifier(declaration)
        ? declaration.name
        : t.isFunctionDeclaration(declaration)
          ? declaration.id?.name
          : undefined;
    }
    if (!t.isExportNamedDeclaration(statement) || statement.source) {
      continue;
    }
    const { declaration } = statement;
    const declared = t.isFunctionDeclaration(declaration)
      ? [declaration.id?.name]
      : t.isVariableDeclaration(declaration)
        ? declaration.declarations.map(({ id }) => (t.isIdentifier(id) ? id.name : undefined))
        : [];
    if (declared.includes(name)) {
      return name;
    }
    const specifier = statement.specifiers.find(
      (item) => t.isExportSpecifier(item) && exportedName(item) === name
    );
    if (t.isExportSpecifier(specifier)) {
      return specifier.local.name;
    }
  }
  return undefined;
}

// The modules `name` may be exported from again: `export { name } from` and `export * from`.
function exportsFrom(module: TemplateModule, name: string): ImportBinding[] {
  const named: ImportBinding[] = [];
  const all: ImportBinding[] = [];
  for (const statement of module.program.body) {
    if (t.isExportAllDeclaration(statement)) {
      all.push({ importId: statement.source.value, importName: name });
    } else if (t.isExportNamedDeclaration(statement) && statement.source) {
      const specifier = statement.specifiers.find(
        (item) => t.isExportSpecifier(item) && exportedName(item) === name
      );
      if (t.isExportSpecifier(specifier)) {
        named.push({ importId: statement.source.value, importName: specifier.local.name });
      }
    }
  }
  return [...named, ...all];
}

const exportedName = ({ exported }: t.ExportSpecifier) =>
  t.isIdentifier(exported) ? exported.name : exported.value;
