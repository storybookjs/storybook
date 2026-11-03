// Reads the markup a story supplies itself - `template`, a `render` that returns one, or the CSF2
// function form - so a snippet shows the story as written. Which members the story and its meta hold
// is the shared CSF pass in `story-shape`, spreads and names already followed.
import type {
  CsfFile,
  ESTree as E,
  ESTreeNode as Node,
  ResolvedMembers,
} from 'storybook/internal/csf-tools';
import {
  importedName,
  isCanonicalCsf2BindCall,
  isStringLiteral,
  oneLineTextOf,
  staticKey,
  templateParts,
  type TemplateParts,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import { evaluateArgLiteral } from './story-docs-args.ts';
import type { PropCode } from './story-docs-prop-code.ts';
import { propCode } from './story-docs-prop-code.ts';
import { formatPropInTemplate } from '../template-grammar.ts';

/** One story, as much of it as reading the markup it supplies needs. */
export interface StoryShape {
  csf: CsfFile;
  exportName: string;
  /** The story's own config members, spreads and names followed. */
  members: ResolvedMembers;
  /** The meta's config members, spreads and names followed. */
  metaMembers: ResolvedMembers;
  /** Meta args merged under story args, keyed by arg name. */
  args: Record<string, Node>;
  /** Source text of everything hiding args from this pass; empty when the merged args are known. */
  unresolvedArgs: string[];
  /** Those of `unresolvedArgs` that hide which args there are, rather than one arg's value. */
  hidingArgs: string[];
}

export { oneLineTextOf };

/** Bindings the generated snippet would carry, which is also what `argsToTemplate` expands to. */
export interface Bindings {
  inputs: { name: string; expression: string }[];
  outputs: string[];
}

// One `argsToTemplate` site, materialized after Angular identifies its surrounding element.
export interface TemplateExpansion {
  marker: string;
  inputAttributes: string[];
  outputAttributes: { name: string; markup: string }[];
}

export interface ArgsExpansion extends TemplateExpansion {
  /** Whether the expansion binds an arg of this name, were the story to set it. */
  allows: (name: string) => boolean;
}

/** One `${name}` that interpolates an arg, which the markup holds as its text. */
export interface TextInterpolation {
  /** What stands for the text in `markedMarkup`. */
  marker: string;
  arg: string;
  text: string;
}

/** Which arg names a binding list covers, mirroring `argsToTemplate`'s own options. */
interface BindingFilter {
  include?: readonly string[];
  exclude?: readonly string[];
}

/**
 * The property and event bindings on their own, without the surrounding element.
 *
 * This is what `argsToTemplate(args)` expands to at runtime, except that values are inlined rather
 * than referenced by name, so the result stands alone without the story's `props: args`.
 */
const bindingAttributes = (
  { inputs, outputs }: Bindings,
  filter: BindingFilter,
  representedArgs: Set<string>
): Omit<ArgsExpansion, 'marker'> => {
  const allowed = (name: string) =>
    filter.include ? filter.include.includes(name) : !filter.exclude?.includes(name);
  const representedInputs = inputs.filter(({ name }) => allowed(name));
  const representedOutputs = outputs.filter(allowed);
  representedInputs.forEach(({ name }) => representedArgs.add(name));
  representedOutputs.forEach((name) => representedArgs.add(name));
  return {
    allows: allowed,
    inputAttributes: representedInputs.map(({ name, expression }) => `[${name}]="${expression}"`),
    outputAttributes: representedOutputs.map((name) => ({
      name,
      markup: `(${name})="${formatPropInTemplate(name)}($event)"`,
    })),
  };
};

/** What a `template` turned out to hold. */
export type TemplateResult =
  /**
   * Read as markup, so the story is shown as written. `representedArgs` names the args whose values
   * the markup already contains.
   */
  | {
      kind: 'literal';
      markup: string;
      /** `markup` with each arg it interpolates as the marker of one of `texts`. */
      markedMarkup: string;
      representedArgs: readonly string[];
      expansions: readonly ArgsExpansion[];
      texts: readonly TextInterpolation[];
    }
  /**
   * A `template` or `render` exists, but its markup needs the story to run. `source` is that
   * expression as written, so the story can say which one it fell back from; it is absent when a
   * config-level member already reported the same cause.
   */
  | { kind: 'unresolvable'; source?: string };

/** What the function owning a template literal binds, deciding how `${name}` resolves. */
interface FunctionScope {
  /** Local parameter names mapped to the story arg each one destructures. */
  argBindings: ReadonlyMap<string, string>;
  /** Every parameter-local name, including bindings whose value cannot be mapped to one arg. */
  parameterNames: ReadonlySet<string>;
  /** Names its body declares; their value at render time is not statically knowable. */
  bodyDeclared: ReadonlySet<string>;
  /**
   * Names `argsToTemplate` may expand, each mapped to the arg names its value does not carry: the
   * whole args parameter excludes nothing, a rest binding excludes what was destructured off it.
   */
  argsExpansions: ReadonlyMap<string, readonly string[]>;
  /** Names among `argBindings` with a default, which they hold while the arg is unset. */
  defaulted: ReadonlyMap<string, Node>;
}

const NO_SCOPE: FunctionScope = {
  defaulted: new Map(),
  argBindings: new Map(),
  parameterNames: new Set(),
  bodyDeclared: new Set(),
  argsExpansions: new Map(),
};

/**
 * Markup the story supplies itself, falling back to the meta's.
 *
 * Returns `undefined` when neither declares one, which is the plain `{ args }` story the generated
 * bindings are built for.
 */
export const userTemplate = (
  shape: StoryShape,
  bindings: Bindings | undefined
): TemplateResult | undefined => {
  const own = shapeTemplate(shape.members, shape, bindings);
  if (own) {
    return own;
  }

  // CSF2: the story is the function, and Angular's idiom is to return `{ template }`.
  const csf2 = csf2Shape(shape);
  if (csf2) {
    const templateProperty = resolvedProperty(csf2.returned, 'template');
    if (templateProperty.kind === 'unresolvable') {
      return { kind: 'unresolvable', source: oneLineTextOf(csf2.returned) };
    }
    const fromCsf2 = templateFrom(
      templateProperty.kind === 'value' ? templateProperty.node : undefined,
      shape,
      bindings,
      functionScope(csf2.fn)
    );
    if (fromCsf2) {
      return fromCsf2;
    }
  }

  return shapeTemplate(shape.metaMembers, shape, bindings);
};

/** The template one config level declares, directly or through a `render` that returns one. */
const shapeTemplate = (
  members: ResolvedMembers,
  shape: StoryShape,
  bindings: Bindings | undefined
): TemplateResult | undefined => {
  const template = resolvedMember(members, 'template');
  if (template.kind === 'unresolvable') {
    return {
      kind: 'unresolvable',
      ...(template.node ? { source: oneLineTextOf(template.node) } : {}),
    };
  }
  if (template.kind === 'value') {
    const own = templateFrom(declaredValue(shape, template.node), shape, bindings, NO_SCOPE);
    if (own) {
      return own;
    }
  }

  const render = resolvedMember(members, 'render');
  if (render.kind === 'missing') {
    return undefined;
  }
  // A story whose `render` exists but cannot be read must not inherit the meta's markup, which is
  // for code the story never runs.
  if (render.kind === 'unresolvable') {
    return { kind: 'unresolvable', ...(render.node ? { source: oneLineTextOf(render.node) } : {}) };
  }

  const fn = declaredValue(shape, render.node);
  const returned = returnedObject(fn);
  if (!returned) {
    return { kind: 'unresolvable', source: `render: ${oneLineTextOf(render.node)}` };
  }
  const templateProperty = resolvedProperty(returned, 'template');
  return templateProperty.kind === 'unresolvable'
    ? { kind: 'unresolvable', source: `render: ${oneLineTextOf(render.node)}` }
    : templateFrom(
        templateProperty.kind === 'value' ? templateProperty.node : undefined,
        shape,
        bindings,
        functionScope(fn)
      );
};

const templateFrom = (
  node: Node | undefined,
  shape: StoryShape,
  bindings: Bindings | undefined,
  scope: FunctionScope
): TemplateResult | undefined => {
  if (
    node === undefined ||
    isNullLiteral(node) ||
    (node.type === 'Identifier' && node.name === 'undefined')
  ) {
    return undefined;
  }
  if (isStringLiteral(node)) {
    return literalTemplate(node.value, new Set(), [], []);
  }
  const parts = templateParts(node);
  if (parts) {
    const representedArgs = new Set<string>();
    const expansions: ArgsExpansion[] = [];
    const texts: TextInterpolation[] = [];
    const markup = interpolate(parts, shape, bindings, scope, representedArgs, expansions, texts);
    return markup === undefined
      ? { kind: 'unresolvable', source: oneLineTextOf(node) }
      : literalTemplate(markup, representedArgs, expansions, texts);
  }
  return { kind: 'unresolvable', source: oneLineTextOf(node) };
};

const literalTemplate = (
  markedMarkup: string,
  representedArgs: ReadonlySet<string>,
  expansions: readonly ArgsExpansion[],
  texts: readonly TextInterpolation[]
): Extract<TemplateResult, { kind: 'literal' }> => ({
  kind: 'literal',
  markup: texts.reduce(
    (markup, { marker, text }) => markup.replace(marker, () => text),
    markedMarkup
  ),
  markedMarkup,
  representedArgs: [...representedArgs],
  expansions,
  texts,
});

/** Markup a template literal holds once every `${…}` in it has been substituted. */
const interpolate = (
  { quasis, expressions }: TemplateParts,
  shape: StoryShape,
  bindings: Bindings | undefined,
  scope: FunctionScope,
  representedArgs: Set<string>,
  expansions: ArgsExpansion[],
  texts: TextInterpolation[]
): string | undefined => {
  let markup = quasis[0] ?? '';
  const unique = (marker: string) => {
    while (markup.includes(marker) || quasis.some((quasi) => quasi.includes(marker))) {
      marker += '-x';
    }
    return marker;
  };

  for (const [index, expression] of expressions.entries()) {
    const substituted = substituteExpression(
      expression,
      shape,
      bindings,
      scope,
      representedArgs,
      unique(`data-storybook-args-to-template-${index}`),
      expansions,
      unique(`__storybook_arg_text_${index}__`),
      texts
    );
    if (substituted === undefined) {
      return undefined;
    }
    markup += substituted + (quasis[index + 1] ?? '');
  }

  return markup;
};

/**
 * Text a `${…}` inside a template contributes, or `undefined` when it needs the story to run.
 *
 * `argsToTemplate(args)` is the idiom every Angular docs example uses, and it expands to exactly
 * the bindings this generator already emits - so a template built around it is fully readable
 * rather than opaque. Values are inlined instead of referenced by name, which drops the story's
 * `props: args` requirement and leaves the snippet standing on its own.
 *
 * An interpolated name substitutes the story's arg only when the render function actually binds
 * that name from its parameters; otherwise it is the module-level declaration the runtime would
 * read, followed the same way `template: HOISTED` is.
 */
const substituteExpression = (
  expression: Node,
  shape: StoryShape,
  bindings: Bindings | undefined,
  scope: FunctionScope,
  representedArgs: Set<string>,
  marker: string,
  expansions: ArgsExpansion[],
  textMarker: string,
  texts: TextInterpolation[]
): string | undefined => {
  if (expression.type === 'CallExpression' && isImportedArgsToTemplate(expression, shape)) {
    // Only the args parameter (whole, or as a rest binding) has a knowable expansion; a derived
    // object expands to whatever the story computes at runtime.
    const argument = expression.arguments[0];
    const excluded =
      argument?.type === 'Identifier' ? scope.argsExpansions.get(argument.name) : undefined;
    if (!bindings || excluded === undefined) {
      return undefined;
    }
    const filter = bindingFilterOf(expression.arguments[1]);
    if (filter === undefined) {
      return undefined;
    }
    // Destructured-off names are absent from the rest object, so they cannot expand from it.
    const withRest = { ...filter, exclude: [...(filter.exclude ?? []), ...excluded] };
    const allowed = filter.include
      ? { ...withRest, include: filter.include.filter((name) => !excluded.includes(name)) }
      : withRest;
    expansions.push({ marker, ...bindingAttributes(bindings, allowed, representedArgs) });
    return marker;
  }

  if (expression.type !== 'Identifier') {
    return undefined;
  }
  const argName = scope.argBindings.get(expression.name);
  if (argName !== undefined) {
    const text = shape.unresolvedArgs.length === 0 ? literalText(shape.args[argName]) : undefined;
    if (text === undefined) {
      return undefined;
    }
    representedArgs.add(argName);
    texts.push({ marker: textMarker, arg: argName, text });
    return textMarker;
  }
  if (scope.parameterNames.has(expression.name)) {
    return undefined;
  }
  // A name the body declares has a render-time value this pass cannot know.
  if (scope.bodyDeclared.has(expression.name)) {
    return undefined;
  }
  const declared = declaredValue(shape, expression);
  if (declared === undefined || declared === expression) {
    return undefined;
  }
  // A constant may hold markup of its own in a template literal.
  const parts = templateParts(declared);
  return parts?.expressions.length === 0 ? parts.quasis[0] : literalText(declared);
};

const ARGS_TO_TEMPLATE_MODULES = new Set(['@storybook/angular', '@storybook/angular-vite']);

const isImportedArgsToTemplate = (call: E.CallExpression, shape: StoryShape): boolean => {
  if (call.callee.type !== 'Identifier') {
    return false;
  }
  const binding = shape.csf.editor.scopes.bindingOf(call.callee);
  const specifier = binding?.node;
  const declaration = binding?.declaration;
  if (specifier?.type !== 'ImportSpecifier' || declaration?.type !== 'ImportDeclaration') {
    return false;
  }
  return (
    importedName(specifier.imported) === 'argsToTemplate' &&
    ARGS_TO_TEMPLATE_MODULES.has(declaration.source.value)
  );
};

/** Filter for `argsToTemplate` options, or `undefined` when the options need the story to run. */
const bindingFilterOf = (options: Node | undefined): BindingFilter | undefined => {
  if (options === undefined) {
    return {};
  }
  const unwrapped = unwrapExpression(options);
  if (
    unwrapped.type !== 'ObjectExpression' ||
    unwrapped.properties.some((property) => property.type === 'SpreadElement')
  ) {
    return undefined;
  }

  const filter: BindingFilter = {};
  for (const key of ['include', 'exclude'] as const) {
    const node = resolvedProperty(unwrapped, key);
    if (node.kind === 'unresolvable') {
      return undefined;
    }
    if (node.kind === 'value') {
      const names = stringArray(node.node);
      if (names === undefined) {
        return undefined;
      }
      filter[key] = names;
    }
  }
  return filter;
};

/** String array literal, for `argsToTemplate`'s `include` / `exclude` options. */
const stringArray = (node: Node | undefined): string[] | undefined =>
  node?.type === 'ArrayExpression' && node.elements.every(isStringLiteral)
    ? node.elements.map((element) => (element as E.StringLiteral).value)
    : undefined;

/** Text an interpolated arg contributes, for slot content like `<span>${footer}</span>`. */
const literalText = (node: Node | undefined): string | undefined => {
  const unwrapped = node && unwrapExpression(node);
  if (unwrapped?.type !== 'Literal') {
    return undefined;
  }
  const { value } = unwrapped;
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
};

const isNullLiteral = (node: Node): boolean =>
  node.type === 'Literal' && node.value === null && !('regex' in node) && !('bigint' in node);

type AnnotationResolution =
  | { kind: 'value'; node: Node }
  | { kind: 'missing' }
  | { kind: 'unresolvable'; node?: Node };

type PropertyResolution =
  | Exclude<AnnotationResolution, { kind: 'unresolvable' }>
  | { kind: 'unresolvable'; node: Node };

/**
 * A named member of a resolved config record.
 *
 * The record already applied every spread it could read in source order, so a present member is the
 * value the story really ends up with - unless the record marks it shadowed, meaning something this
 * pass could not read runs after the write and may replace it. A member the record does not have is
 * only knowably absent when the record is complete.
 */
export const resolvedMember = (members: ResolvedMembers, key: string): AnnotationResolution => {
  const node = members.properties[key];
  if (node !== undefined) {
    return members.shadowed.includes(key)
      ? { kind: 'unresolvable', node }
      : { kind: 'value', node };
  }
  return members.unresolved.length > 0 ? { kind: 'unresolvable' } : { kind: 'missing' };
};

/** A named property of an object literal, for options a call site writes out inline. */
export const resolvedProperty = (object: E.ObjectExpression, key: string): PropertyResolution => {
  let found: E.ObjectProperty | undefined;
  let opaqueAfter: E.ObjectExpression['properties'][number] | undefined;
  object.properties.forEach((property) => {
    if (property.type === 'SpreadElement') {
      opaqueAfter = property;
      return;
    }
    const name = staticKey(property);
    if (name === key) {
      found = property;
      opaqueAfter = undefined;
    } else if (name === undefined) {
      opaqueAfter = property;
    }
  });

  if (!found) {
    return opaqueAfter ? { kind: 'unresolvable', node: opaqueAfter } : { kind: 'missing' };
  }
  if (opaqueAfter) {
    return { kind: 'unresolvable', node: opaqueAfter };
  }
  if (found.method || found.kind !== 'init') {
    return isPlainMethod(found)
      ? { kind: 'value', node: found }
      : { kind: 'unresolvable', node: found };
  }
  return { kind: 'value', node: found.value };
};

const isPlainMethod = (node: Node | undefined): node is E.ObjectProperty & { value: E.Function } =>
  node?.type === 'Property' &&
  node.method &&
  node.kind === 'init' &&
  node.value.type === 'FunctionExpression' &&
  !node.value.generator;

const functionOf = (node: Node | undefined): E.Function | E.ArrowFunctionExpression | undefined => {
  if (isPlainMethod(node)) {
    return node.value;
  }
  return node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression' ||
    node?.type === 'FunctionDeclaration'
    ? node
    : undefined;
};

/**
 * Object literal a story or `render` function returns.
 *
 * Only a single-exit body is readable: any statement that could return earlier (a conditional, a
 * loop) means the markup depends on which branch the story takes at runtime.
 */
const returnedObject = (node: Node | undefined): E.ObjectExpression | undefined => {
  const fn = functionOf(node);
  if (!fn?.body) {
    return undefined;
  }

  if (fn.body.type !== 'BlockStatement') {
    const unwrapped = unwrapExpression(fn.body);
    return unwrapped.type === 'ObjectExpression' ? unwrapped : undefined;
  }

  const statements = fn.body.body;
  const last = statements.at(-1);
  if (last?.type !== 'ReturnStatement' || !last.argument) {
    return undefined;
  }
  const singleExit = statements
    .slice(0, -1)
    .every(
      (statement) =>
        statement.type === 'VariableDeclaration' || statement.type === 'ExpressionStatement'
    );
  if (!singleExit) {
    return undefined;
  }
  const unwrapped = unwrapExpression(last.argument);
  return unwrapped.type === 'ObjectExpression' ? unwrapped : undefined;
};

/**
 * What a story's render hands its template under one prop name: the `arg` it holds unchanged, so
 * the prop follows the controls, or the `code` it holds instead. A prop with both holds the code
 * only while the arg is unset.
 */
export interface RenderedProp {
  arg?: string;
  code?: Node;
  /** The code where it reads args and the snippet can carry it; see {@link propCode}. */
  computed?: PropCode;
}

export type RenderedProps = (name: string) => RenderedProp | undefined;

const ARGS_AS_PROPS: RenderedProps = (name) => ({ arg: name });

/**
 * The props of the story's `render` or CSF2 function, or `undefined` when they need the story to
 * run. A story with neither renders with the default `(args) => ({ props: args })`.
 */
export const renderedProps = (shape: StoryShape): RenderedProps | undefined => {
  const csf2 = csf2Shape(shape);
  const render = [shape.members, shape.metaMembers]
    .map((members) => resolvedMember(members, 'render'))
    .find((resolution) => resolution.kind !== 'missing');
  if (!csf2 && !render) {
    return ARGS_AS_PROPS;
  }
  const declared =
    csf2?.fn ?? (render?.kind === 'value' ? declaredValue(shape, render.node) : undefined);
  const fn = functionOf(declared);
  const returned = csf2?.returned ?? returnedObject(declared);
  const props = returned && resolvedProperty(returned, 'props');
  if (!fn || !props || props.kind === 'unresolvable') {
    return undefined;
  }
  const scope = functionScope(fn);
  const value = props.kind === 'value' ? unwrapExpression(props.node) : undefined;
  const properties: (E.ObjectProperty | { type: 'SpreadElement'; argument: Node })[] =
    value === undefined
      ? []
      : value.type === 'ObjectExpression'
        ? value.properties
        : [{ type: 'SpreadElement', argument: value }];

  // The args a spread passes on under their own name: all but those destructured off before it.
  let spreadExcept: readonly string[] | undefined;
  const named = new Map<string, RenderedProp>();
  for (const property of properties) {
    if (property.type === 'SpreadElement') {
      const except =
        property.argument.type === 'Identifier'
          ? scope.argsExpansions.get(property.argument.name)
          : undefined;
      if (except === undefined) {
        return undefined;
      }
      spreadExcept = spreadExcept?.filter((name) => except.includes(name)) ?? except;
      // The spread replaces a prop written before it, while the arg of that name is set.
      for (const [name, { arg, code }] of named) {
        if (except.includes(name) || arg === name) {
          continue;
        }
        if (!code) {
          return undefined;
        }
        named.set(name, { arg: name, code });
      }
      continue;
    }
    const name = property.computed ? undefined : staticKey(property);
    if (name === undefined) {
      return undefined;
    }
    const plain = !property.method && property.kind === 'init';
    const arg = plain ? argRead(property.value, scope) : undefined;
    const defaulted = plain ? defaultedRead(property.value, scope) : undefined;
    if (arg !== undefined) {
      named.set(name, { arg });
      continue;
    }
    if (defaulted) {
      named.set(name, defaulted);
      continue;
    }
    const code = property.method || property.kind !== 'init' ? property : property.value;
    const computed = plain
      ? propCode(fn, unwrapExpression(property.value), scope, shape.csf.editor, shape.args)
      : undefined;
    named.set(name, computed ? { code, computed } : { code });
  }

  return (name) =>
    named.get(name) ?? (spreadExcept && !spreadExcept.includes(name) ? { arg: name } : undefined);
};

/** The arg an expression reads and passes on unchanged: `label`, `args.label` or `args['label']`. */
const argRead = (node: Node, scope: FunctionScope): string | undefined => {
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type === 'Identifier') {
    return scope.defaulted.has(unwrapped.name) ? undefined : scope.argBindings.get(unwrapped.name);
  }
  if (unwrapped.type !== 'MemberExpression' || unwrapped.object.type !== 'Identifier') {
    return undefined;
  }
  const except = scope.argsExpansions.get(unwrapped.object.name);
  const name =
    !unwrapped.computed && unwrapped.property.type === 'Identifier'
      ? unwrapped.property.name
      : isStringLiteral(unwrapped.property)
        ? unwrapped.property.value
        : undefined;
  return name !== undefined && except && !except.includes(name) ? name : undefined;
};

// An arg destructured with a literal default, which the prop holds while the arg is unset.
const defaultedRead = (node: Node, scope: FunctionScope): RenderedProp | undefined => {
  const unwrapped = unwrapExpression(node);
  const code = unwrapped.type === 'Identifier' ? scope.defaulted.get(unwrapped.name) : undefined;
  return code && evaluateArgLiteral(code, []) !== undefined
    ? { arg: scope.argBindings.get((unwrapped as E.IdentifierReference).name), code }
    : undefined;
};

/** The CSF2 function story and the object it returns, for `export const S = () => ({ template })`. */
const csf2Shape = (shape: StoryShape): { fn: Node; returned: E.ObjectExpression } | undefined => {
  const declared = shape.csf._storyExports[shape.exportName];
  const candidates: (Node | undefined | null)[] =
    declared?.type === 'VariableDeclarator'
      ? [declared.init]
      : // `export { S }` records no declarator; the statement is the initializer it resolved to.
        [declared, shape.csf._storyStatements[shape.exportName]];

  for (const candidate of candidates) {
    let fn = candidate ? unwrapExpression(candidate) : undefined;
    // `Template.bind({})` renders Template; the bound copy shares its body.
    if (fn && isCanonicalCsf2BindCall(fn)) {
      fn = declaredValue(shape, fn.callee.object);
    }
    const returned = returnedObject(fn);
    if (fn && returned) {
      return { fn, returned };
    }
  }
  return undefined;
};

/** What a render function binds, as far as it can be enumerated statically. */
const functionScope = (node: Node | undefined): FunctionScope => {
  const fn = functionOf(node?.type === 'Property' ? node.value : node);
  if (!fn) {
    return NO_SCOPE;
  }

  const [firstParam] = fn.params;
  const argsPattern = firstParam?.type === 'AssignmentPattern' ? firstParam.left : firstParam;
  const parameterNames = new Set<string>();
  fn.params.forEach((param) => collectPatternNames(param, parameterNames));
  const argBindings = new Map<string, string>();
  const defaulted = new Map<string, Node>();
  const bindArgs = (pattern: E.ObjectPattern) => {
    for (const property of pattern.properties) {
      if (property.type !== 'Property' || property.computed) {
        continue;
      }
      const argName = staticKey(property);
      const local =
        property.value.type === 'AssignmentPattern' ? property.value.left : property.value;
      if (argName !== undefined && local.type === 'Identifier') {
        argBindings.set(local.name, argName);
        if (property.value.type === 'AssignmentPattern') {
          defaulted.set(local.name, property.value.right);
        }
      }
    }
  };
  if (argsPattern?.type === 'ObjectPattern') {
    bindArgs(argsPattern);
  }

  const bodyDeclared = new Set<string>();
  if (fn.body?.type === 'BlockStatement') {
    for (const statement of fn.body.body) {
      if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          collectPatternNames(declarator.id, bodyDeclared);
          // `const { label } = args;` binds the arg as destructuring the parameter does.
          if (
            statement.kind === 'const' &&
            declarator.id.type === 'ObjectPattern' &&
            argsPattern?.type === 'Identifier' &&
            declarator.init?.type === 'Identifier' &&
            declarator.init.name === argsPattern.name
          ) {
            bindArgs(declarator.id);
          }
        }
      }
    }
  }

  const argsExpansions = new Map<string, readonly string[]>();
  if (argsPattern?.type === 'Identifier') {
    argsExpansions.set(argsPattern.name, []);
  } else if (argsPattern?.type === 'ObjectPattern') {
    const destructured: string[] = [];
    let rest: string | undefined;
    let knownKeys = true;
    for (const property of argsPattern.properties) {
      if (property.type === 'RestElement' && property.argument.type === 'Identifier') {
        rest = property.argument.name;
      } else if (property.type === 'Property') {
        const key = property.computed ? undefined : staticKey(property);
        if (key !== undefined) {
          destructured.push(key);
        } else {
          knownKeys = false;
        }
      }
    }
    if (rest !== undefined && knownKeys) {
      argsExpansions.set(rest, destructured);
    }
  }

  return { argBindings, parameterNames, bodyDeclared, argsExpansions, defaulted };
};

const collectPatternNames = (pattern: Node, into: Set<string>): void => {
  if (pattern.type === 'Identifier') {
    into.add(pattern.name);
  } else if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      collectPatternNames(
        property.type === 'RestElement' ? property.argument : property.value,
        into
      );
    }
  } else if (pattern.type === 'ArrayPattern') {
    pattern.elements.forEach((element) => element && collectPatternNames(element, into));
  } else if (pattern.type === 'AssignmentPattern') {
    collectPatternNames(pattern.left, into);
  } else if (pattern.type === 'RestElement') {
    collectPatternNames(pattern.argument, into);
  }
};

/**
 * An annotation value, following a bare name back to what it was declared as in this file.
 *
 * `template: HOISTED_TEMPLATE` is markup the story really did write, so refusing to look through
 * the name would replace it with a fabricated element. An imported name has no initializer here,
 * so it stays an identifier and no snippet is generated.
 */
const declaredValue = (
  shape: StoryShape,
  node: Node | undefined,
  followed = new Set<Node>()
): Node | undefined => {
  if (node?.type === 'MemberExpression') {
    return declaredMember(shape, node, followed) ?? node;
  }
  if (node?.type !== 'Identifier') {
    return node;
  }
  const binding = shape.csf.editor.scopes.program.bindings.get(node.name);
  // A reassigned binding's value at render time is not its initializer.
  if (!binding?.constant) {
    return node;
  }
  const declaration = binding.node;
  if (declaration.type === 'VariableDeclarator') {
    return declaration.init ?? node;
  }
  return declaration.type === 'FunctionDeclaration' ? declaration : node;
};

// `render: Primary.render` is what the other story wrote, unless something assigns to it later or
// it leads back to itself.
const declaredMember = (
  shape: StoryShape,
  node: E.MemberExpression,
  followed: Set<Node>
): Node | undefined => {
  const { object, property } = node;
  if (
    followed.has(node) ||
    node.computed ||
    object.type !== 'Identifier' ||
    property.type !== 'Identifier'
  ) {
    return undefined;
  }
  followed.add(node);
  const { editor } = shape.csf;
  const binding = editor.scopes.program.bindings.get(object.name);
  const written = binding?.references.some((reference) => {
    const member = editor.parentOf(reference);
    const assignment = member && editor.parentOf(member);
    return (
      member?.type === 'MemberExpression' &&
      member.object === reference &&
      assignment?.type === 'AssignmentExpression' &&
      assignment.left === member &&
      (member.computed ||
        (member.property.type === 'Identifier' && member.property.name === property.name))
    );
  });
  const declared = declaredValue(shape, object);
  const literal = declared && declared !== object ? unwrapExpression(declared) : undefined;
  if (written || literal?.type !== 'ObjectExpression') {
    return undefined;
  }
  const member = resolvedProperty(literal, property.name);
  return member.kind === 'value' ? declaredValue(shape, member.node, followed) : undefined;
};
