// Reads the markup a story supplies itself - `template`, a `render` that returns one, or the CSF2
// function form - with runtime object semantics, so a snippet shows the story as written.
import { generate, type NodePath, types as t } from 'storybook/internal/babel';
import type { CsfFile } from 'storybook/internal/csf-tools';
import { unwrapExpression } from 'storybook/internal/csf-tools';

import { formatPropInTemplate } from '../template-grammar.ts';

/** One story, as much of it as reading the markup it supplies needs. */
export interface StoryShape {
  csf: CsfFile;
  exportName: string;
  annotations: Record<string, t.Node>;
  /** Meta args merged under story args, keyed by arg name. */
  args: Record<string, t.Node>;
  /** Source text of everything hiding args from this pass; empty when the merged args are known. */
  unresolvedArgs: string[];
}

/** Source text of a node, for naming an expression this pass could not read. */
export const sourceOf = (node: t.Node): string =>
  generate(node, { concise: true, comments: false }).code;

// A spread at the config level carries args as invisibly as one inside `args`.
export const unresolvableConfigMembers = (config: t.ObjectExpression | undefined): string[] =>
  (config?.properties ?? []).filter(isOpaqueMember).map(sourceOf);

/** Bindings the generated snippet would carry, which is also what `argsToTemplate` expands to. */
export interface Bindings {
  inputs: { name: string; expression: string }[];
  outputs: string[];
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
const bindingAttributes = ({ inputs, outputs }: Bindings, filter: BindingFilter): string[] => {
  const allowed = (name: string) =>
    filter.include ? filter.include.includes(name) : !filter.exclude?.includes(name);
  return [
    ...inputs
      .filter(({ name }) => allowed(name))
      .map(({ name, expression }) => `[${name}]="${expression}"`),
    ...outputs.filter(allowed).map((name) => `(${name})="${formatPropInTemplate(name)}($event)"`),
  ];
};

/** What a `template` turned out to hold. */
export type TemplateResult =
  /** Read as markup, so the story is shown as written. */
  | { kind: 'literal'; markup: string }
  /**
   * A `template` or `render` exists, but its markup needs the story to run. `source` is that
   * expression as written, so the story can say which one it fell back from; it is absent when a
   * config-level member already reported the same cause.
   */
  | { kind: 'unresolvable'; source?: string };

/** What the function owning a template literal binds, deciding how `${name}` resolves. */
interface FunctionScope {
  /** Names bound from the function's parameters; they resolve to story args. */
  paramNames: ReadonlySet<string>;
  /** Names its body declares; their value at render time is not statically knowable. */
  bodyDeclared: ReadonlySet<string>;
  /**
   * Names `argsToTemplate` may expand, each mapped to the arg names its value does not carry: the
   * whole args parameter excludes nothing, a rest binding excludes what was destructured off it.
   */
  argsExpansions: ReadonlyMap<string, readonly string[]>;
}

const NO_SCOPE: FunctionScope = {
  paramNames: new Set(),
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
  const own = shapeTemplate(storyConfigObject(shape), shape.annotations, shape, bindings);
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

  return shapeTemplate(metaConfigObject(shape.csf), shape.csf._metaAnnotations, shape, bindings);
};

/** The template one config level declares, directly or through a `render` that returns one. */
const shapeTemplate = (
  config: t.ObjectExpression | undefined,
  annotations: Record<string, t.Node>,
  shape: StoryShape,
  bindings: Bindings | undefined
): TemplateResult | undefined => {
  const template = resolveAnnotation(config, annotations, 'template');
  if (template.kind === 'unresolvable') {
    return { kind: 'unresolvable', ...(template.node ? { source: sourceOf(template.node) } : {}) };
  }
  if (template.kind === 'value') {
    const own = templateFrom(declaredValue(shape, template.node), shape, bindings, NO_SCOPE);
    if (own) {
      return own;
    }
  }

  const render = resolveAnnotation(config, annotations, 'render');
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
  node: t.Node | undefined,
  shape: StoryShape,
  bindings: Bindings | undefined,
  scope: FunctionScope
): TemplateResult | undefined => {
  if (
    node === undefined ||
    t.isNullLiteral(node) ||
    (t.isIdentifier(node) && node.name === 'undefined')
  ) {
    return undefined;
  }
  if (t.isStringLiteral(node)) {
    return { kind: 'literal', markup: node.value };
  }
  if (t.isTemplateLiteral(node)) {
    const markup = interpolate(node, shape, bindings, scope);
    return markup === undefined
      ? { kind: 'unresolvable', source: sourceOf(node) }
      : { kind: 'literal', markup };
  }
  return { kind: 'unresolvable', source: sourceOf(node) };
};

/** Markup a template literal holds once every `${…}` in it has been substituted. */
const interpolate = (
  node: t.TemplateLiteral,
  shape: StoryShape,
  bindings: Bindings | undefined,
  scope: FunctionScope
): string | undefined => {
  let markup = node.quasis[0]?.value.cooked ?? '';

  for (const [index, expression] of node.expressions.entries()) {
    const substituted = substituteExpression(expression, shape, bindings, scope);
    if (substituted === undefined) {
      return undefined;
    }
    markup += substituted + (node.quasis[index + 1]?.value.cooked ?? '');
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
  expression: t.Node,
  shape: StoryShape,
  bindings: Bindings | undefined,
  scope: FunctionScope
): string | undefined => {
  if (
    t.isCallExpression(expression) &&
    t.isIdentifier(expression.callee) &&
    expression.callee.name === 'argsToTemplate'
  ) {
    // Only the args parameter (whole, or as a rest binding) has a knowable expansion; a derived
    // object expands to whatever the story computes at runtime.
    const argument = expression.arguments[0];
    const excluded = t.isIdentifier(argument) ? scope.argsExpansions.get(argument.name) : undefined;
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
    return bindingAttributes(bindings, allowed).join(' ');
  }

  if (!t.isIdentifier(expression)) {
    return undefined;
  }
  if (scope.paramNames.has(expression.name)) {
    return shape.unresolvedArgs.length === 0 ? literalText(shape.args[expression.name]) : undefined;
  }
  // A name the body declares has a render-time value this pass cannot know.
  if (scope.bodyDeclared.has(expression.name)) {
    return undefined;
  }
  const declared = declaredValue(shape, expression);
  return declared === expression ? undefined : literalText(declared);
};

/** Filter for `argsToTemplate` options, or `undefined` when the options need the story to run. */
const bindingFilterOf = (options: t.Node | undefined): BindingFilter | undefined => {
  if (options === undefined) {
    return {};
  }
  const unwrapped = unwrapExpression(options);
  if (!t.isObjectExpression(unwrapped) || unwrapped.properties.some(t.isSpreadElement)) {
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
const stringArray = (node: t.Node | undefined): string[] | undefined =>
  t.isArrayExpression(node) && node.elements.every((element) => t.isStringLiteral(element))
    ? node.elements.map((element) => (element as t.StringLiteral).value)
    : undefined;

/** Text an interpolated arg contributes, for slot content like `<span>${footer}</span>`. */
const literalText = (node: t.Node | undefined): string | undefined => {
  const unwrapped = node && unwrapExpression(node);
  if (t.isStringLiteral(unwrapped)) {
    return unwrapped.value;
  }
  return t.isNumericLiteral(unwrapped) || t.isBooleanLiteral(unwrapped)
    ? String(unwrapped.value)
    : undefined;
};

/** How one annotation resolved against its config object. */
type AnnotationResolution =
  | { kind: 'value'; node: t.Node }
  | { kind: 'missing' }
  /**
   * A spread may shadow or supply the property, or it is an accessor; the value is unknowable.
   * `node` is the accessor itself; a spread cause carries no node, the config-member scan names it.
   */
  | { kind: 'unresolvable'; node?: t.Node };

/**
 * A named property of a config object, with runtime object semantics: the last occurrence wins, a
 * spread written after it (or standing in for a missing one) makes the value unknowable, and a
 * getter/setter/generator is not a value at all. Falls back to the parser's annotation record when
 * the config is not a plain object literal (CSF2 functions, re-exports).
 */
const resolveAnnotation = (
  config: t.ObjectExpression | undefined,
  annotations: Record<string, t.Node>,
  key: string
): AnnotationResolution => {
  const annotated = annotations[key];
  if (!config) {
    return annotated === undefined ? { kind: 'missing' } : { kind: 'value', node: annotated };
  }
  const own = resolvedProperty(config, key);
  // An annotation node the literal does not contain is a `Story.render = ...` member assignment,
  // which runs after the declaration and wins over everything in the literal.
  if (annotated !== undefined && annotated !== (own.kind === 'value' ? own.node : undefined)) {
    return { kind: 'value', node: annotated };
  }
  return own;
};

// A spread or a dynamically-keyed member can supply or shadow any property at runtime.
const isOpaqueMember = (property: t.ObjectExpression['properties'][number]): boolean =>
  t.isSpreadElement(property) ||
  ((t.isObjectProperty(property) || t.isObjectMethod(property)) &&
    keyNameOf(property) === undefined);

export const resolvedProperty = (object: t.ObjectExpression, key: string): AnnotationResolution => {
  let found: { index: number; property: t.ObjectMethod | t.ObjectProperty } | undefined;
  object.properties.forEach((property, index) => {
    if (
      (t.isObjectProperty(property) || t.isObjectMethod(property)) &&
      keyNameOf(property) === key
    ) {
      found = { index, property };
    }
  });

  if (!found) {
    return object.properties.some(isOpaqueMember) ? { kind: 'unresolvable' } : { kind: 'missing' };
  }
  if (
    object.properties.some((property, index) => index > found!.index && isOpaqueMember(property))
  ) {
    return { kind: 'unresolvable' };
  }
  if (t.isObjectMethod(found.property)) {
    return found.property.kind === 'method' && !found.property.generator
      ? { kind: 'value', node: found.property }
      : { kind: 'unresolvable', node: found.property };
  }
  return { kind: 'value', node: found.property.value };
};

// A string-literal computed key has the exact runtime semantics of a plain string key.
export const keyNameOf = (property: t.ObjectMethod | t.ObjectProperty): string | undefined => {
  if (t.isIdentifier(property.key) && !property.computed) {
    return property.key.name;
  }
  return t.isStringLiteral(property.key) ? property.key.value : undefined;
};

/**
 * The story's own config object literal: the export's initializer, the statement a re-export
 * resolved to, or the argument of a `meta.story(...)` factory call.
 */
export const storyConfigObject = (
  shape: Pick<StoryShape, 'csf' | 'exportName'>
): t.ObjectExpression | undefined => {
  const declared = shape.csf._storyExports[shape.exportName];
  const candidates = [
    t.isVariableDeclarator(declared) ? declared.init : declared,
    shape.csf._storyStatements[shape.exportName],
  ];
  for (const candidate of candidates) {
    const unwrapped = candidate ? unwrapExpression(candidate) : undefined;
    if (unwrapped && t.isObjectExpression(unwrapped)) {
      return unwrapped;
    }
    if (unwrapped && t.isCallExpression(unwrapped) && isStoryFactoryCall(unwrapped)) {
      const argument = unwrapped.arguments[0];
      const config = argument && unwrapExpression(argument);
      if (config && t.isObjectExpression(config)) {
        return config;
      }
    }
  }
  return undefined;
};

export const isStoryFactoryCall = (call: t.CallExpression): boolean =>
  t.isMemberExpression(call.callee) &&
  t.isIdentifier(call.callee.property) &&
  ['story', 'extend'].includes(call.callee.property.name);

export const metaConfigObject = (csf: CsfFile): t.ObjectExpression | undefined => {
  const node = csf._metaNode;
  return node && t.isObjectExpression(node) ? node : undefined;
};

/**
 * Object literal a story or `render` function returns.
 *
 * Only a single-exit body is readable: any statement that could return earlier (a conditional, a
 * loop) means the markup depends on which branch the story takes at runtime.
 */
const returnedObject = (fn: t.Node | undefined): t.ObjectExpression | undefined => {
  const isPlainMethod = t.isObjectMethod(fn) && fn.kind === 'method' && !fn.generator;
  if (
    !t.isArrowFunctionExpression(fn) &&
    !t.isFunctionExpression(fn) &&
    !t.isFunctionDeclaration(fn) &&
    !isPlainMethod
  ) {
    return undefined;
  }

  if (!t.isBlockStatement(fn.body)) {
    const unwrapped = unwrapExpression(fn.body);
    return t.isObjectExpression(unwrapped) ? unwrapped : undefined;
  }

  const statements = fn.body.body;
  const last = statements.at(-1);
  if (!t.isReturnStatement(last) || !last.argument) {
    return undefined;
  }
  const singleExit = statements
    .slice(0, -1)
    .every((statement) => t.isVariableDeclaration(statement) || t.isExpressionStatement(statement));
  if (!singleExit) {
    return undefined;
  }
  const unwrapped = unwrapExpression(last.argument);
  return t.isObjectExpression(unwrapped) ? unwrapped : undefined;
};

/** The CSF2 function story and the object it returns, for `export const S = () => ({ template })`. */
const csf2Shape = (shape: StoryShape): { fn: t.Node; returned: t.ObjectExpression } | undefined => {
  const declared = shape.csf._storyExports[shape.exportName];
  const candidates: (t.Node | undefined | null)[] = t.isVariableDeclarator(declared)
    ? [declared.init]
    : // `export { S }` records no declarator; the statement is the initializer it resolved to.
      [declared, shape.csf._storyStatements[shape.exportName]];

  for (const candidate of candidates) {
    let fn = candidate ? unwrapExpression(candidate) : undefined;
    // `Template.bind({})` renders Template; the bound copy shares its body.
    if (fn && t.isCallExpression(fn) && isBindCall(fn)) {
      fn = declaredValue(shape, unwrapExpression((fn.callee as t.MemberExpression).object));
    }
    const returned = returnedObject(fn);
    if (fn && returned) {
      return { fn, returned };
    }
  }
  return undefined;
};

export const isBindCall = (call: t.CallExpression): boolean =>
  t.isMemberExpression(call.callee) && t.isIdentifier(call.callee.property, { name: 'bind' });

/** What a render function binds, as far as it can be enumerated statically. */
const functionScope = (fn: t.Node | undefined): FunctionScope => {
  if (
    !t.isArrowFunctionExpression(fn) &&
    !t.isFunctionExpression(fn) &&
    !t.isFunctionDeclaration(fn) &&
    !t.isObjectMethod(fn)
  ) {
    return NO_SCOPE;
  }

  const paramNames = new Set<string>();
  const collect = (pattern: t.Node): void => {
    if (t.isIdentifier(pattern)) {
      paramNames.add(pattern.name);
    } else if (t.isObjectPattern(pattern)) {
      for (const property of pattern.properties) {
        if (t.isRestElement(property)) {
          collect(property.argument);
        } else {
          collect(property.value);
        }
      }
    } else if (t.isArrayPattern(pattern)) {
      pattern.elements.forEach((element) => element && collect(element));
    } else if (t.isAssignmentPattern(pattern)) {
      collect(pattern.left);
    } else if (t.isRestElement(pattern)) {
      collect(pattern.argument);
    }
  };
  fn.params.forEach(collect);

  const bodyDeclared = new Set<string>();
  if (t.isBlockStatement(fn.body)) {
    for (const statement of fn.body.body) {
      if (t.isVariableDeclaration(statement)) {
        for (const declarator of statement.declarations) {
          collectPatternNames(declarator.id, bodyDeclared);
        }
      }
    }
  }

  const argsExpansions = new Map<string, readonly string[]>();
  const [firstParam] = fn.params;
  if (t.isIdentifier(firstParam)) {
    argsExpansions.set(firstParam.name, []);
  } else if (t.isObjectPattern(firstParam)) {
    const destructured: string[] = [];
    let rest: string | undefined;
    for (const property of firstParam.properties) {
      if (t.isRestElement(property) && t.isIdentifier(property.argument)) {
        rest = property.argument.name;
      } else if (t.isObjectProperty(property)) {
        const key = keyNameOf(property);
        if (key !== undefined) {
          destructured.push(key);
        }
      }
    }
    if (rest !== undefined) {
      argsExpansions.set(rest, destructured);
    }
  }

  return { paramNames, bodyDeclared, argsExpansions };
};

const collectPatternNames = (pattern: t.Node, into: Set<string>): void => {
  if (t.isIdentifier(pattern)) {
    into.add(pattern.name);
  } else if (t.isObjectPattern(pattern)) {
    for (const property of pattern.properties) {
      collectPatternNames(t.isRestElement(property) ? property.argument : property.value, into);
    }
  } else if (t.isArrayPattern(pattern)) {
    pattern.elements.forEach((element) => element && collectPatternNames(element, into));
  } else if (t.isAssignmentPattern(pattern)) {
    collectPatternNames(pattern.left, into);
  } else if (t.isRestElement(pattern)) {
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
const declaredValue = (shape: StoryShape, node: t.Node | undefined): t.Node | undefined => {
  if (!t.isIdentifier(node)) {
    return node;
  }
  const program: NodePath<t.Program> = shape.csf._file.path;
  const binding = program.scope.getBinding(node.name);
  // A reassigned binding's value at render time is not its initializer.
  if (!binding?.constant) {
    return node;
  }
  const declaration = binding.path.node;
  if (t.isVariableDeclarator(declaration)) {
    return declaration.init ?? node;
  }
  return t.isFunctionDeclaration(declaration) ? declaration : node;
};
