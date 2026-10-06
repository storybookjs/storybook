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
  sourceOf,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

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
}

export { sourceOf };

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
): Omit<TemplateExpansion, 'marker'> => {
  const allowed = (name: string) =>
    filter.include ? filter.include.includes(name) : !filter.exclude?.includes(name);
  const representedInputs = inputs.filter(({ name }) => allowed(name));
  const representedOutputs = outputs.filter(allowed);
  representedInputs.forEach(({ name }) => representedArgs.add(name));
  representedOutputs.forEach((name) => representedArgs.add(name));
  return {
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
      representedArgs: readonly string[];
      expansions: readonly TemplateExpansion[];
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
}

const NO_SCOPE: FunctionScope = {
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
      return { kind: 'unresolvable', source: sourceOf(csf2.returned) };
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
    return { kind: 'unresolvable', ...(template.node ? { source: sourceOf(template.node) } : {}) };
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
    return { kind: 'unresolvable', ...(render.node ? { source: sourceOf(render.node) } : {}) };
  }

  const fn = declaredValue(shape, render.node);
  const returned = returnedObject(fn);
  if (!returned) {
    return { kind: 'unresolvable', source: `render: ${sourceOf(render.node)}` };
  }
  const templateProperty = resolvedProperty(returned, 'template');
  return templateProperty.kind === 'unresolvable'
    ? { kind: 'unresolvable', source: `render: ${sourceOf(render.node)}` }
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
    return literalTemplate(node.value, new Set(), []);
  }
  const parts = templateParts(node);
  if (parts) {
    const representedArgs = new Set<string>();
    const expansions: TemplateExpansion[] = [];
    const markup = interpolate(parts, shape, bindings, scope, representedArgs, expansions);
    return markup === undefined
      ? { kind: 'unresolvable', source: sourceOf(node) }
      : literalTemplate(markup, representedArgs, expansions);
  }
  return { kind: 'unresolvable', source: sourceOf(node) };
};

const literalTemplate = (
  markup: string,
  representedArgs: ReadonlySet<string>,
  expansions: readonly TemplateExpansion[]
): Extract<TemplateResult, { kind: 'literal' }> => ({
  kind: 'literal',
  markup,
  representedArgs: [...representedArgs],
  expansions,
});

interface TemplateParts {
  quasis: string[];
  expressions: Node[];
}

// `String.raw` is the identity tag: it hands back the text between the backticks, so a template
// wearing it is as readable as a plain one. No other tag transforms its input predictably.
export const templateParts = (node: Node): TemplateParts | undefined => {
  if (node.type === 'TemplateLiteral') {
    return {
      quasis: node.quasis.map((quasi) => quasi.value.cooked ?? ''),
      expressions: node.expressions,
    };
  }
  if (node.type !== 'TaggedTemplateExpression' || !isStringRawTag(node.tag)) {
    return undefined;
  }
  return {
    quasis: node.quasi.quasis.map((quasi) => quasi.value.raw),
    expressions: node.quasi.expressions,
  };
};

const isStringRawTag = (tag: E.Expression): boolean =>
  tag.type === 'MemberExpression' &&
  !tag.computed &&
  tag.object.type === 'Identifier' &&
  tag.object.name === 'String' &&
  tag.property.type === 'Identifier' &&
  tag.property.name === 'raw';

/** Markup a template literal holds once every `${…}` in it has been substituted. */
const interpolate = (
  { quasis, expressions }: TemplateParts,
  shape: StoryShape,
  bindings: Bindings | undefined,
  scope: FunctionScope,
  representedArgs: Set<string>,
  expansions: TemplateExpansion[]
): string | undefined => {
  let markup = quasis[0] ?? '';

  for (const [index, expression] of expressions.entries()) {
    let marker = `data-storybook-args-to-template-${index}`;
    while (markup.includes(marker) || quasis.some((quasi) => quasi.includes(marker))) {
      marker += '-x';
    }
    const substituted = substituteExpression(
      expression,
      shape,
      bindings,
      scope,
      representedArgs,
      marker,
      expansions
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
  expansions: TemplateExpansion[]
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
    if (text !== undefined) {
      representedArgs.add(argName);
    }
    return text;
  }
  if (scope.parameterNames.has(expression.name)) {
    return undefined;
  }
  // A name the body declares has a render-time value this pass cannot know.
  if (scope.bodyDeclared.has(expression.name)) {
    return undefined;
  }
  const declared = declaredValue(shape, expression);
  return declared === expression ? undefined : literalText(declared);
};

const ARGS_TO_TEMPLATE_MODULES = new Set(['@storybook/angular', '@storybook/angular-vite']);

const isImportedArgsToTemplate = (call: E.CallExpression, shape: StoryShape): boolean => {
  if (call.callee.type !== 'Identifier') {
    return false;
  }
  const binding = shape.csf._editor.scopes.bindingOf(call.callee);
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
    const name = keyNameOf(property);
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

// A string-literal computed key has the exact runtime semantics of a plain string key.
export const keyNameOf = (property: E.ObjectProperty | E.BindingProperty): string | undefined => {
  if (property.key.type === 'Identifier' && !property.computed) {
    return property.key.name;
  }
  return isStringLiteral(property.key) ? property.key.value : undefined;
};

// `render() {}` stores its function in `value`, which is what reading its body needs.
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
  if (argsPattern?.type === 'ObjectPattern') {
    for (const property of argsPattern.properties) {
      if (property.type !== 'Property' || property.computed) {
        continue;
      }
      const argName = keyNameOf(property);
      const local =
        property.value.type === 'AssignmentPattern' ? property.value.left : property.value;
      if (argName !== undefined && local.type === 'Identifier') {
        argBindings.set(local.name, argName);
      }
    }
  }

  const bodyDeclared = new Set<string>();
  if (fn.body?.type === 'BlockStatement') {
    for (const statement of fn.body.body) {
      if (statement.type === 'VariableDeclaration') {
        for (const declarator of statement.declarations) {
          collectPatternNames(declarator.id, bodyDeclared);
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
        const key = property.computed ? undefined : keyNameOf(property);
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

  return { argBindings, parameterNames, bodyDeclared, argsExpansions };
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
const declaredValue = (shape: StoryShape, node: Node | undefined): Node | undefined => {
  if (node?.type !== 'Identifier') {
    return node;
  }
  const binding = shape.csf._editor.scopes.program.bindings.get(node.name);
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
