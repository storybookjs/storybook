import { type NodePath, types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile } from 'storybook/internal/csf-tools';
import {
  buildImportStatements,
  collectImportBindings,
  extractStoryJSDocInfo,
  keyOf,
  resolveComponentImport,
  unwrapExpression,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { resolve } from 'node:path';

import type {
  AngularComponentSnippetMeta,
  AngularDocgenPayload,
  SnippetEnum,
} from './build-docgen.ts';
import { parseStoryFile } from './resolve-component.ts';
import { buildHostComponentSnippet } from './story-docs-snippet.ts';
import {
  buildComponentOutletTemplate,
  buildTemplate,
  formatPropInTemplate,
  isValidIdentifier,
} from '../template-grammar.ts';

export interface BuildStoryDocsContext {
  /**
   * Resolves the docgen payload for a component id, `undefined` when docgen is unavailable. Must
   * not throw: the preset wrapper owns failure handling.
   */
  getDocgenPayload: (componentId: string) => Promise<AngularDocgenPayload | undefined>;
  resolvePath?: (importPath: string) => string;
}

export const buildStoryDocsPayload = async (
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext
): Promise<StoryDocsPayload | undefined> => {
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => resolve(process.cwd(), importPath));
  const parsed = parseStoryFile(resolvePath(storyImportPath), input.entry.title);
  if (!parsed) {
    return undefined;
  }
  const { source, csf } = parsed;

  const componentNode = csf._metaAnnotations.component;
  const docgenPayload = componentNode
    ? await context.getDocgenPayload(getComponentIdFromEntry(input.entry))
    : undefined;

  const componentName = componentNameOf(componentNode);
  const deps: StoryDocDeps = {
    csf,
    source,
    metaArgs: argsProperties(csf, csf._metaAnnotations.args),
    snippetMeta: docgenPayload?.angularComponentMeta,
    componentName,
    componentImport:
      componentName === undefined
        ? undefined
        : createImportStatement(componentName, csf, docgenPayload),
  };

  const stories: Record<string, StoryDoc> = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    stories[story.id] = buildStoryDoc(exportName, story, deps);
  }

  const titleName = input.entry.title.split('/').at(-1)!.replace(/\s+/g, '');
  return {
    id: getComponentIdFromEntry(input.entry),
    // The docgen payload knows the class name even when the story file imported it under an alias.
    name: docgenPayload?.name ?? componentName ?? titleName,
    path: storyImportPath,
    stories,
  };
};

/**
 * The import statement a docs consumer needs to use the component, as the story file writes it.
 *
 * A component declared inside the story file binds to no import and so contributes no statement. An
 * `@import` tag on the component class replaces the derived one, for components published under a
 * different specifier than the story file resolves through.
 */
const createImportStatement = (
  componentName: string,
  csf: CsfFile,
  docgenPayload: AngularDocgenPayload | undefined
): string | undefined => {
  const ref = resolveComponentImport(componentName, collectImportBindings(csf._file.path));
  const importOverride = docgenPayload?.jsDocTags?.import?.[0]?.trim();
  return buildImportStatements({ refs: [{ ...ref, importOverride }] }).join('\n') || undefined;
};

// Mirrors the resolver's reading of `meta.component`, keeping the payload named after the story
// file's component when docgen is unavailable.
const componentNameOf = (node: t.Node | undefined): string | undefined => {
  const identifier = node && t.isTSInstantiationExpression(node) ? node.expression : node;
  return identifier && t.isIdentifier(identifier) ? identifier.name : undefined;
};

interface StoryDocDeps {
  csf: CsfFile;
  source: string;
  metaArgs: ArgsRecord;
  snippetMeta: AngularComponentSnippetMeta | undefined;
  componentName: string | undefined;
  componentImport: string | undefined;
}

const buildStoryDoc = (
  exportName: string,
  story: CsfFile['_stories'][string],
  deps: StoryDocDeps
): StoryDoc => {
  const { csf, snippetMeta, componentName, componentImport } = deps;
  const name = story.name ?? storyNameFromExport(exportName);
  try {
    const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
    const annotations = csf._storyAnnotations[exportName] ?? {};
    const storyArgs = argsProperties(csf, annotations.args);
    const shape: StoryShape = {
      csf,
      exportName,
      annotations,
      args: { ...deps.metaArgs.properties, ...storyArgs.properties },
      argsReadable: deps.metaArgs.complete && storyArgs.complete,
      source: deps.source,
    };
    const snippet = snippetMeta
      ? renderStorySnippet(snippetMeta, shape, componentImport)
      : undefined;
    const warning =
      snippet === undefined
        ? undefined
        : incompleteSnippetReason(componentName ?? snippetMeta!.name, componentImport);

    return {
      id: story.id,
      name,
      ...(snippet === undefined ? {} : { snippet }),
      ...(warning === undefined ? {} : { warning }),
      ...(description ? { description } : {}),
      ...(summary === undefined ? {} : { summary }),
    };
  } catch (e) {
    const err = e instanceof Error ? e : undefined;
    return {
      id: story.id,
      name,
      error: { name: err?.name ?? 'Error', message: err?.message ?? String(e) },
    };
  }
};

/**
 * Why the host component in the snippet would not compile as written, or `undefined` when it would.
 *
 * A component the story file declares itself has no import to derive, so the snippet names it in
 * `imports` without bringing it into scope. The snippet still shows the bindings the story sets,
 * which is what a reader comes to a docs page for, so it is worth keeping with the caveat attached.
 */
const incompleteSnippetReason = (
  localName: string,
  componentImport: string | undefined
): string | undefined =>
  componentImport === undefined
    ? `${localName} is declared in the story file, so the snippet references it without importing it.`
    : undefined;

/** One story, as much of it as reading the markup it supplies needs. */
interface StoryShape {
  csf: CsfFile;
  exportName: string;
  annotations: Record<string, t.Node>;
  /** Meta args merged under story args, keyed by arg name. */
  args: Record<string, t.Node>;
  /** `false` when a spread or computed key makes the merged args unknowable statically. */
  argsReadable: boolean;
  source: string;
}

/**
 * Snippets show the markup a story supplies itself - through `template`, a `render` that returns
 * one, or the CSF2 function form - as written. Markup or args that cannot be read without running
 * the story yield no snippet at all, so the runtime source fallback stays authoritative rather
 * than a fabricated element misrepresenting what the story renders.
 */
const renderStorySnippet = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  componentImport: string | undefined
): string | undefined => {
  // The story file's local name is what the import binds, so an aliased import stays consistent
  // between the import statement, the `imports` array and the template.
  const localName = componentNameOf(shape.csf._metaAnnotations.component) ?? snippetMeta.name;
  const bindings = shape.argsReadable ? collectBindings(snippetMeta, shape) : undefined;
  const userMarkup = userTemplate(shape, bindings);
  if (userMarkup?.kind === 'unresolvable') {
    return undefined;
  }
  if (userMarkup === undefined && !snippetMeta.selector) {
    return buildHostComponentSnippet({
      template: buildComponentOutletTemplate(localName),
      componentName: localName,
      componentImport,
      viaComponentOutlet: true,
      outputs: [],
    });
  }
  if (userMarkup === undefined && bindings === undefined) {
    return undefined;
  }
  const template =
    userMarkup?.kind === 'literal'
      ? userMarkup.markup
      : buildTemplate(snippetMeta.selector!, {
          inputs: bindings!.inputs,
          outputs: bindings!.outputs,
        });
  // The host only needs handlers for the outputs the markup actually binds.
  const boundOutputs = snippetMeta.outputs.filter((name) => template.includes(`(${name})=`));

  return buildHostComponentSnippet({
    template,
    componentName: localName,
    componentImport,
    viaComponentOutlet: false,
    outputs: boundOutputs,
  });
};

/** Bindings the generated snippet would carry, which is also what `argsToTemplate` expands to. */
interface Bindings {
  inputs: { name: string; expression: string }[];
  outputs: string[];
}

const collectBindings = (snippetMeta: AngularComponentSnippetMeta, shape: StoryShape): Bindings => {
  const inputNames = new Set(snippetMeta.inputs);
  const inputs = Object.entries(shape.args)
    .filter(([argName]) => inputNames.has(argName))
    .map(([argName, node]) => ({
      name: argName,
      expression: evaluateArgExpression(node, shape.source, snippetMeta.enums),
    }));
  return { inputs, outputs: snippetMeta.outputs };
};

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
type TemplateResult =
  /** Read as markup, so the story is shown as written. */
  | { kind: 'literal'; markup: string }
  /** A `template` or `render` exists, but its markup needs the story to run. */
  | { kind: 'unresolvable' };

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
const userTemplate = (
  shape: StoryShape,
  bindings: Bindings | undefined
): TemplateResult | undefined => {
  const own = shapeTemplate(
    storyConfigObject(shape.csf, shape.exportName),
    shape.annotations,
    shape,
    bindings
  );
  if (own) {
    return own;
  }

  // CSF2: the story is the function, and Angular's idiom is to return `{ template }`.
  const csf2 = csf2Shape(shape);
  if (csf2) {
    const templateProperty = resolvedProperty(csf2.returned, 'template');
    if (templateProperty.kind === 'unresolvable') {
      return { kind: 'unresolvable' };
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
    return { kind: 'unresolvable' };
  }
  if (template.kind === 'value') {
    const own = templateFrom(declaredValue(shape.csf, template.node), shape, bindings, NO_SCOPE);
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
    return { kind: 'unresolvable' };
  }

  const fn = declaredValue(shape.csf, render.node);
  const returned = returnedObject(fn);
  if (!returned) {
    return { kind: 'unresolvable' };
  }
  const templateProperty = resolvedProperty(returned, 'template');
  return templateProperty.kind === 'unresolvable'
    ? { kind: 'unresolvable' }
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
    return markup === undefined ? { kind: 'unresolvable' } : { kind: 'literal', markup };
  }
  return { kind: 'unresolvable' };
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
    return shape.argsReadable ? literalText(shape.args[expression.name]) : undefined;
  }
  // A name the body declares has a render-time value this pass cannot know.
  if (scope.bodyDeclared.has(expression.name)) {
    return undefined;
  }
  const declared = declaredValue(shape.csf, expression);
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
  /** A spread may shadow or supply the property, or it is an accessor; the value is unknowable. */
  | { kind: 'unresolvable' };

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

const resolvedProperty = (object: t.ObjectExpression, key: string): AnnotationResolution => {
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
      : { kind: 'unresolvable' };
  }
  return { kind: 'value', node: found.property.value };
};

// A string-literal computed key has the exact runtime semantics of a plain string key.
const keyNameOf = (property: t.ObjectMethod | t.ObjectProperty): string | undefined => {
  if (t.isIdentifier(property.key) && !property.computed) {
    return property.key.name;
  }
  return t.isStringLiteral(property.key) ? property.key.value : undefined;
};

/**
 * The story's own config object literal: the export's initializer, the statement a re-export
 * resolved to, or the argument of a `meta.story(...)` factory call.
 */
const storyConfigObject = (csf: CsfFile, exportName: string): t.ObjectExpression | undefined => {
  const declared = csf._storyExports[exportName];
  const candidates = [
    t.isVariableDeclarator(declared) ? declared.init : declared,
    csf._storyStatements[exportName],
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

const isStoryFactoryCall = (call: t.CallExpression): boolean =>
  t.isMemberExpression(call.callee) &&
  t.isIdentifier(call.callee.property) &&
  ['story', 'extend'].includes(call.callee.property.name);

const metaConfigObject = (csf: CsfFile): t.ObjectExpression | undefined => {
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
      fn = declaredValue(shape.csf, unwrapExpression((fn.callee as t.MemberExpression).object));
    }
    const returned = returnedObject(fn);
    if (fn && returned) {
      return { fn, returned };
    }
  }
  return undefined;
};

const isBindCall = (call: t.CallExpression): boolean =>
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
const declaredValue = (csf: CsfFile, node: t.Node | undefined): t.Node | undefined => {
  if (!t.isIdentifier(node)) {
    return node;
  }
  const program: NodePath<t.Program> = csf._file.path;
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

interface ArgsRecord {
  properties: Record<string, t.Node>;
  complete: boolean;
}

/**
 * Named properties of an `args` object literal, and whether the record is statically complete.
 *
 * A spread whose source can be read in this file - `...Primary.args`, a factory story's
 * `...Primary.input.args`, or a constant object - is merged in with runtime order semantics, so
 * composed stories keep their snippet. A spread this pass cannot follow still marks the record
 * incomplete, because it can add or override args invisibly.
 */
const argsProperties = (
  csf: CsfFile,
  node: t.Node | undefined,
  expanding = new Set<t.Node>()
): ArgsRecord => {
  const properties: Record<string, t.Node> = {};
  if (node === undefined) {
    return { properties, complete: true };
  }
  const unwrapped = unwrapExpression(node);
  // An object already being expanded means the spreads cycle back into themselves.
  if (!t.isObjectExpression(unwrapped) || expanding.has(unwrapped)) {
    return { properties, complete: false };
  }

  expanding.add(unwrapped);
  let complete = true;
  for (const property of unwrapped.properties) {
    if (t.isSpreadElement(property)) {
      const spread = spreadArgsRecord(csf, property.argument, expanding);
      complete &&= spread.complete;
      Object.assign(properties, spread.properties);
      continue;
    }
    const key = t.isObjectProperty(property) ? keyNameOf(property) : undefined;
    if (!t.isObjectProperty(property) || key === undefined) {
      // An accessor or dynamic key can add or override args this pass cannot see.
      complete = false;
      continue;
    }
    properties[key] = property.value;
  }
  expanding.delete(unwrapped);
  return { properties, complete };
};

const spreadArgsRecord = (csf: CsfFile, expression: t.Node, expanding: Set<t.Node>): ArgsRecord => {
  const source = resolveSpreadSource(csf, expression, new Set());
  if (source.kind === 'nothing') {
    return { properties: {}, complete: true };
  }
  if (source.kind === 'unresolvable') {
    return { properties: {}, complete: false };
  }
  return argsProperties(csf, source.node, expanding);
};

type SpreadSource =
  | { kind: 'object'; node: t.ObjectExpression }
  /** Spreading `undefined` - a story without `args` - contributes nothing at runtime. */
  | { kind: 'nothing' }
  | { kind: 'unresolvable' };

/**
 * The object a spread in an args record draws from, followed as far as this file reaches: a
 * constant declared here, another story's `args` (with member-assigned CSF2 args honoured), or a
 * factory story's `.input`, which is the config object the factory call received. An imported
 * name, a call, or a computed member needs the story to run.
 */
const resolveSpreadSource = (csf: CsfFile, node: t.Node, followed: Set<t.Node>): SpreadSource => {
  const unwrapped = unwrapExpression(node);
  if (followed.has(unwrapped)) {
    return { kind: 'unresolvable' };
  }
  followed.add(unwrapped);

  if (t.isObjectExpression(unwrapped)) {
    return { kind: 'object', node: unwrapped };
  }
  if (t.isIdentifier(unwrapped)) {
    const declared = declaredValue(csf, unwrapped);
    return declared === unwrapped || declared === undefined
      ? { kind: 'unresolvable' }
      : resolveSpreadSource(csf, declared, followed);
  }
  if (
    !t.isMemberExpression(unwrapped) ||
    unwrapped.computed ||
    !t.isIdentifier(unwrapped.property)
  ) {
    return { kind: 'unresolvable' };
  }

  const key = unwrapped.property.name;
  const storyName =
    t.isIdentifier(unwrapped.object) && csf._storyAnnotations[unwrapped.object.name]
      ? unwrapped.object.name
      : undefined;
  if (storyName !== undefined) {
    const isFactory = csf._stories[storyName]?.__stats?.factory === true;
    if (key === 'input' && isFactory) {
      const config = storyConfigObject(csf, storyName);
      return config ? { kind: 'object', node: config } : { kind: 'unresolvable' };
    }
    if (key === 'args' && !isFactory) {
      const args = resolveAnnotation(
        storyConfigObject(csf, storyName),
        csf._storyAnnotations[storyName],
        'args'
      );
      if (args.kind === 'missing') {
        return { kind: 'nothing' };
      }
      return args.kind === 'value'
        ? resolveSpreadSource(csf, args.node, followed)
        : { kind: 'unresolvable' };
    }
    return { kind: 'unresolvable' };
  }

  const object = resolveSpreadSource(csf, unwrapped.object, followed);
  if (object.kind !== 'object') {
    return { kind: 'unresolvable' };
  }
  const property = resolvedProperty(object.node, key);
  if (property.kind === 'missing') {
    return { kind: 'nothing' };
  }
  return property.kind === 'value'
    ? resolveSpreadSource(csf, property.node, followed)
    : { kind: 'unresolvable' };
};

const EVAL_FAILED = Symbol('story-docs-eval-failed');

// An arg no static evaluation could reduce to a value falls back to its source text. Every
// expression is escaped for the attribute position it lands in: the double-quote delimiter and
// text Angular's lexer would decode as a character reference survive the round-trip unchanged.
const evaluateArgExpression = (node: t.Node, source: string, enums: SnippetEnum[]): string => {
  const unwrapped = unwrapExpression(node);
  const value = evaluateNode(unwrapped, enums);
  if (value !== EVAL_FAILED) {
    return escapeAttributeExpression(printExpressionValue(value, new Set()));
  }
  const text =
    unwrapped.start != null && unwrapped.end != null
      ? source.slice(unwrapped.start, unwrapped.end)
      : undefined;
  return escapeAttributeExpression(text ?? 'undefined');
};

// Angular expression strings support backslash escapes, so quoting stays lossless.
const quoteExpressionString = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// Renders an evaluated arg as a template expression, in the same shape the runtime generator
// prints, but losslessly for strings carrying quotes.
const printExpressionValue = (value: unknown, seen: Set<unknown>): string => {
  if (typeof value === 'string') {
    return quoteExpressionString(value);
  }
  if (typeof value !== 'object' || value === null) {
    return `${value}`;
  }
  if (seen.has(value)) {
    return quoteExpressionString('[Circular]');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((element) => printExpressionValue(element ?? null, seen)).join(', ')}]`;
  }
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(
      ([key, entryValue]) =>
        `${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printExpressionValue(entryValue, seen)}`
    );
  return `{${entries.join(', ')}}`;
};

const escapeAttributeExpression = (expression: string): string =>
  expression.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

const evaluateNode = (node: t.Node, enums: SnippetEnum[]): unknown => {
  const unwrapped = unwrapExpression(node);
  if (
    t.isStringLiteral(unwrapped) ||
    t.isNumericLiteral(unwrapped) ||
    t.isBooleanLiteral(unwrapped)
  ) {
    return unwrapped.value;
  }
  if (t.isNullLiteral(unwrapped)) {
    return null;
  }
  if (t.isIdentifier(unwrapped) && unwrapped.name === 'undefined') {
    return undefined;
  }
  if (
    t.isUnaryExpression(unwrapped) &&
    unwrapped.operator === '-' &&
    t.isNumericLiteral(unwrapped.argument)
  ) {
    return -unwrapped.argument.value;
  }
  if (t.isTemplateLiteral(unwrapped) && unwrapped.expressions.length === 0) {
    return unwrapped.quasis[0]?.value.cooked ?? EVAL_FAILED;
  }
  if (t.isArrayExpression(unwrapped)) {
    const values: unknown[] = [];
    for (const element of unwrapped.elements) {
      if (element === null || t.isSpreadElement(element)) {
        return EVAL_FAILED;
      }
      const value = evaluateNode(element, enums);
      if (value === EVAL_FAILED) {
        return EVAL_FAILED;
      }
      values.push(value);
    }
    return values;
  }
  if (t.isObjectExpression(unwrapped)) {
    const value: Record<string, unknown> = {};
    for (const property of unwrapped.properties) {
      if (!t.isObjectProperty(property)) {
        return EVAL_FAILED;
      }
      const key = keyOf(property);
      if (key === null) {
        return EVAL_FAILED;
      }
      const propertyValue = evaluateNode(property.value, enums);
      if (propertyValue === EVAL_FAILED) {
        return EVAL_FAILED;
      }
      value[key] = propertyValue;
    }
    return value;
  }
  // `Enum.Member`: the analyzer collects referenced enums, so the member's value - what the
  // runtime generator would see - is recoverable statically.
  if (
    t.isMemberExpression(unwrapped) &&
    !unwrapped.computed &&
    t.isIdentifier(unwrapped.object) &&
    t.isIdentifier(unwrapped.property)
  ) {
    const objectName = unwrapped.object.name;
    const propertyName = unwrapped.property.name;
    const member = enums
      .find((enumeration) => enumeration.name === objectName)
      ?.members.find((candidate) => candidate.name === propertyName);
    return member?.value ?? EVAL_FAILED;
  }
  return EVAL_FAILED;
};
