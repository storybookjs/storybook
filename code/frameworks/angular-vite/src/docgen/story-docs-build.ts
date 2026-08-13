import { generate, type NodePath, types as t } from 'storybook/internal/babel';
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
import { parseStoryFile, resolveStoryImport } from './resolve-component.ts';
import type { HostComponentSnippet, HostComponentSnippetInput } from './story-docs-snippet.ts';
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
  /** Resolves an import specifier from a story file to a file path, `undefined` when it does not. */
  resolveImport?: (fromFile: string, specifier: string) => string | undefined;
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
  const storyFilePath = resolvePath(storyImportPath);
  const parsed = parseStoryFile(storyFilePath, input.entry.title);
  if (!parsed) {
    return undefined;
  }
  const { source, csf } = parsed;

  const componentNode = csf._metaAnnotations.component;
  const docgenPayload = componentNode
    ? await context.getDocgenPayload(getComponentIdFromEntry(input.entry))
    : undefined;

  const spreadContext: SpreadArgsContext = {
    csf,
    filePath: storyFilePath,
    enums: docgenPayload?.angularComponentMeta?.enums ?? [],
    resolveImport: context.resolveImport ?? resolveStoryImport,
  };
  const resolveArgs = (node: t.Node | undefined) =>
    argsProperties(node, createSpreadArgsResolver(spreadContext));

  const componentName = componentNameOf(componentNode);
  const importBindings = collectImportBindings(csf._file.path);
  const deps: StoryDocDeps = {
    csf,
    source,
    resolveArgs,
    metaArgs: resolveArgs(csf._metaAnnotations.args),
    snippetMeta: docgenPayload?.angularComponentMeta,
    componentName,
    componentImport:
      componentName === undefined
        ? undefined
        : createImportStatement(componentName, importBindings, docgenPayload),
    metaNgModules: ngModulesFromDecorators(csf._metaAnnotations.decorators, componentName),
    importBindings,
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
  importBindings: ReturnType<typeof collectImportBindings>,
  docgenPayload: AngularDocgenPayload | undefined
): string | undefined => {
  const ref = resolveComponentImport(componentName, importBindings);
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
  resolveArgs: (node: t.Node | undefined) => ArgsRecord;
  metaArgs: ArgsRecord;
  snippetMeta: AngularComponentSnippetMeta | undefined;
  componentName: string | undefined;
  componentImport: string | undefined;
  metaNgModules: StoryNgModules;
  importBindings: ReturnType<typeof collectImportBindings>;
}

interface StoryNgModules {
  names: string[];
  declaresComponent: boolean;
}

// The decorator is matched by its conventional local name: resolving the import binding would only
// rule out a foreign function that happens to be called `moduleMetadata`, which does not arise.
const ngModulesFromDecorators = (
  decorators: t.Node | undefined,
  componentName: string | undefined
): StoryNgModules => {
  const result: StoryNgModules = { names: [], declaresComponent: false };
  const list = decorators === undefined ? undefined : unwrapExpression(decorators);
  if (!list || !t.isArrayExpression(list)) {
    return result;
  }
  for (const element of list.elements) {
    if (!element || t.isSpreadElement(element)) {
      continue;
    }
    const call = unwrapExpression(element);
    if (!t.isCallExpression(call) || !t.isIdentifier(call.callee, { name: 'moduleMetadata' })) {
      continue;
    }
    const [metadataArg] = call.arguments;
    const metadata =
      metadataArg && t.isExpression(metadataArg) ? unwrapExpression(metadataArg) : undefined;
    if (!metadata || !t.isObjectExpression(metadata)) {
      continue;
    }
    for (const property of metadata.properties) {
      if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
        continue;
      }
      const key = keyOf(property);
      const value = unwrapExpression(property.value);
      if ((key !== 'imports' && key !== 'declarations') || !t.isArrayExpression(value)) {
        continue;
      }
      for (const item of value.elements) {
        if (!item || t.isSpreadElement(item)) {
          continue;
        }
        const entry = unwrapExpression(item);
        if (!t.isIdentifier(entry)) {
          continue;
        }
        if (key === 'imports') {
          if (entry.name !== componentName && !result.names.includes(entry.name)) {
            result.names.push(entry.name);
          }
        } else if (entry.name === componentName) {
          result.declaresComponent = true;
        }
      }
    }
  }
  return result;
};

// A story that declares the component itself wires it without a module the snippet could name, so
// the builder's warning path stays the honest output.
const storyNgModules = (
  storyDecorators: t.Node | undefined,
  { metaNgModules, componentName, importBindings }: StoryDocDeps
): HostComponentSnippetInput['ngModules'] => {
  const story = ngModulesFromDecorators(storyDecorators, componentName);
  if (metaNgModules.declaresComponent || story.declaresComponent) {
    return undefined;
  }
  const names = [...new Set([...metaNgModules.names, ...story.names])];
  // A module bound to no import is glue local to the story file, which a reader cannot obtain, so
  // it does not count as a module the snippet can claim.
  const refs = names
    .map((name) => resolveComponentImport(name, importBindings))
    .filter((ref) => ref.importId);
  if (refs.length === 0) {
    return undefined;
  }
  return {
    names: refs.map((ref) => ref.componentName),
    importStatements: buildImportStatements({ refs }),
  };
};

const buildStoryDoc = (
  exportName: string,
  story: CsfFile['_stories'][string],
  deps: StoryDocDeps
): StoryDoc => {
  const { csf, snippetMeta } = deps;
  const name = story.name ?? storyNameFromExport(exportName);
  try {
    const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
    const annotations = csf._storyAnnotations[exportName] ?? {};
    const storyArgs = deps.resolveArgs(annotations.args);
    const shape: StoryShape = {
      csf,
      exportName,
      annotations,
      args: { ...deps.metaArgs.properties, ...storyArgs.properties },
      unresolvedArgs: [
        ...deps.metaArgs.unresolved,
        ...unresolvableConfigMembers(metaConfigObject(csf)),
        ...storyArgs.unresolved,
        ...unresolvableConfigMembers(storyConfigObject({ csf, exportName })),
        ...deepAssignmentSources(csf, exportName),
      ],
      source: deps.source,
    };
    const rendered = snippetMeta
      ? renderStorySnippet(snippetMeta, shape, annotations.decorators, deps)
      : undefined;

    return {
      id: story.id,
      name,
      ...(rendered === undefined ? {} : { snippet: rendered.snippet }),
      ...(rendered?.warning === undefined ? {} : { warning: rendered.warning }),
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

/** One story, as much of it as reading the markup it supplies needs. */
interface StoryShape {
  csf: CsfFile;
  exportName: string;
  annotations: Record<string, t.Node>;
  /** Meta args merged under story args, keyed by arg name. */
  args: Record<string, t.Node>;
  /** Source text of everything hiding args from this pass; empty when the merged args are known. */
  unresolvedArgs: string[];
  source: string;
}

/** Source text of a node, for naming an expression this pass could not read. */
const sourceOf = (node: t.Node): string => generate(node, { concise: true, comments: false }).code;

/** Says which source text a static pass could not read, so a reader can see what is missing. */
const unresolvedWarning = (unresolved: readonly string[]): string =>
  `Incomplete snippet: ${[...new Set(unresolved)]
    .map((source) => `\`${source}\``)
    .join(', ')} could not be resolved statically.`;

// A spread at the config level carries args just as invisibly as one inside `args`.
const unresolvableConfigMembers = (config: t.ObjectExpression | undefined): string[] =>
  (config?.properties ?? []).filter(isOpaqueMember).map(sourceOf);

// `Story.args = {...}` is read through the parser's annotations; only a deeper mutation like
// `Story.args.label = ...` changes args this pass cannot see.
const deepAssignmentSources = (csf: CsfFile, name: string): string[] => {
  const sources: string[] = [];
  for (const statement of csf._file.path.node.body) {
    if (!t.isExpressionStatement(statement) || !t.isAssignmentExpression(statement.expression)) {
      continue;
    }
    let target: t.Node = statement.expression.left;
    let depth = 0;
    while (t.isMemberExpression(target)) {
      depth += 1;
      target = target.object;
    }
    if (depth >= 2 && t.isIdentifier(target) && target.name === name) {
      sources.push(sourceOf(statement.expression));
    }
  }
  return sources;
};

/**
 * Snippets show the markup a story supplies itself - through `template`, a `render` that returns
 * one, or the CSF2 function form - as written. Markup or args that cannot be read without running
 * the story fall back to the component-derived bindings: a snippet that fell back is still useful,
 * but silently shipping it would leave a consumer no way to know its example is partial, so the
 * story carries a `warning` naming the source text this pass could not read.
 */
const renderStorySnippet = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  storyDecorators: t.Node | undefined,
  deps: StoryDocDeps
): HostComponentSnippet => {
  const { componentImport } = deps;
  // The story file's local name is what the import binds, so an aliased import stays consistent
  // between the import statement, the `imports` array and the template.
  const localName = componentNameOf(shape.csf._metaAnnotations.component) ?? snippetMeta.name;
  const ngModules = snippetMeta.standalone ? undefined : storyNgModules(storyDecorators, deps);
  const bindings = collectBindings(snippetMeta, shape);
  // Hidden args would expand `argsToTemplate` into markup that looks complete, so the markup is
  // read without bindings then and falls back with a warning instead.
  const userMarkup = userTemplate(shape, shape.unresolvedArgs.length === 0 ? bindings : undefined);

  const host = (template: string, viaComponentOutlet: boolean, outputs: string[]) =>
    buildHostComponentSnippet({
      template,
      componentName: localName,
      componentImport,
      viaComponentOutlet,
      standalone: snippetMeta.standalone,
      ngModules,
      outputs,
    });

  if (userMarkup?.kind === 'literal') {
    // The story is shown exactly as it was written, so nothing about it is missing; the host only
    // needs handlers for the outputs the markup actually binds.
    const boundOutputs = snippetMeta.outputs.filter((name) =>
      userMarkup.markup.includes(`(${name})=`)
    );
    return host(userMarkup.markup, false, boundOutputs);
  }

  const markupSources = userMarkup?.source === undefined ? [] : [userMarkup.source];
  // The outlet form shows no args at all, so naming the args that could not be read would say
  // nothing about what is missing from it.
  const rendered = snippetMeta.selector
    ? withUnresolved(
        host(buildTemplate(snippetMeta.selector, bindings), false, snippetMeta.outputs),
        [...markupSources, ...shape.unresolvedArgs]
      )
    : withUnresolved(host(buildComponentOutletTemplate(localName), true, []), markupSources);
  return rendered;
};

const withUnresolved = (
  rendered: HostComponentSnippet,
  unresolved: readonly string[]
): HostComponentSnippet => {
  if (unresolved.length === 0) {
    return rendered;
  }
  const warning = [rendered.warning, unresolvedWarning(unresolved)]
    .filter((part) => part !== undefined)
    .join('\n');
  return { snippet: rendered.snippet, warning };
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
const userTemplate = (
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
      : { kind: 'unresolvable', node: found.property };
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
const storyConfigObject = (
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
      fn = declaredValue(shape, unwrapExpression((fn.callee as t.MemberExpression).object));
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

interface ArgsRecord {
  properties: Record<string, t.Node>;
  complete: boolean;
  /** Source text of every member `properties` could not absorb; empty exactly when complete. */
  unresolved: string[];
}

/** Named properties of an `args` object literal, and whether the record is statically complete. */
const argsProperties = (node: t.Node | undefined, resolveSpread?: SpreadResolver): ArgsRecord => {
  const properties: Record<string, t.Node> = {};
  if (node === undefined) {
    return { properties, complete: true, unresolved: [] };
  }
  const unwrapped = unwrapExpression(node);
  if (!t.isObjectExpression(unwrapped)) {
    return { properties, complete: false, unresolved: [`args: ${sourceOf(unwrapped)}`] };
  }

  const unresolved: string[] = [];
  for (const property of unwrapped.properties) {
    if (t.isSpreadElement(property)) {
      const spreadIn = resolveSpread?.(property);
      if (spreadIn === undefined || !spreadIn.complete) {
        unresolved.push(sourceOf(property));
        continue;
      }
      Object.assign(properties, spreadIn.properties);
      continue;
    }
    const key = t.isObjectProperty(property) ? keyNameOf(property) : undefined;
    if (!t.isObjectProperty(property) || key === undefined) {
      // An accessor or dynamic key can add or override args this pass cannot see.
      unresolved.push(sourceOf(property));
      continue;
    }
    properties[key] = property.value;
  }
  return { properties, complete: unresolved.length === 0, unresolved };
};

type SpreadResolver = (spread: t.SpreadElement) => ArgsRecord | undefined;

interface SpreadArgsContext {
  csf: CsfFile;
  filePath: string;
  enums: SnippetEnum[];
  resolveImport: (fromFile: string, specifier: string) => string | undefined;
}

/** How a spread reads another story's args, matching the story's declared form. */
type ArgsAccessor = 'args' | 'input.args';

const accessorOf = (path: readonly string[]): ArgsAccessor | undefined => {
  if (path.length === 1 && path[0] === 'args') {
    return 'args';
  }
  return path.length === 2 && path[0] === 'input' && path[1] === 'args' ? 'input.args' : undefined;
};

/**
 * Resolves `...Primary.args` (and the factory form `...Primary.input.args`) to the args the spread
 * copies at module-evaluation time, following the reference into another story file when the story
 * is imported. Anything it cannot pin down leaves the args record incomplete, so the story yields
 * no snippet rather than a fabricated one.
 */
const createSpreadArgsResolver =
  (ctx: SpreadArgsContext, visited = new Set<string>()): SpreadResolver =>
  (spread) => {
    const chain = memberChain(spread.argument);
    if (!chain) {
      return undefined;
    }
    const { root, path } = chain;

    if (path.length === 0) {
      return moduleConstantArgs(ctx, root, spread.start ?? undefined, visited);
    }

    if (ctx.csf._storyExports[root] || ctx.csf._storyStatements[root]) {
      return spread.start == null
        ? undefined
        : storyArgsAt(ctx, root, accessorOf(path), spread.start, visited);
    }

    const imported = importBindingOf(ctx.csf, root);
    if (!imported) {
      return undefined;
    }
    const [storyName, accessorPath] =
      imported.kind === 'namespace'
        ? [path[0], path.slice(1)]
        : [imported.exportName, path as string[]];
    if (storyName === undefined) {
      return undefined;
    }
    const targetPath = ctx.resolveImport(ctx.filePath, imported.importId);
    const parsed = targetPath === undefined ? undefined : parseStoryFile(targetPath, 'StoryDocs');
    if (!parsed) {
      return undefined;
    }
    const targetCtx: SpreadArgsContext = { ...ctx, csf: parsed.csf, filePath: targetPath! };
    const record = storyArgsAt(targetCtx, storyName, accessorOf(accessorPath), undefined, visited);
    if (record === undefined || !record.complete) {
      return undefined;
    }
    // Nodes from another file carry that file's source offsets, so they must reduce to values that
    // stand on their own before they may join this file's args record.
    const properties: Record<string, t.Node> = {};
    for (const [key, node] of Object.entries(record.properties)) {
      const value = evaluateNode(node, ctx.enums);
      if (value === EVAL_FAILED) {
        return undefined;
      }
      properties[key] = t.valueToNode(value);
    }
    return { properties, complete: true, unresolved: [] };
  };

/** A bare `...base` spread of a module-level constant object, read from its initializer. */
const moduleConstantArgs = (
  ctx: SpreadArgsContext,
  name: string,
  position: number | undefined,
  visited: Set<string>
): ArgsRecord | undefined => {
  if (position === undefined) {
    return undefined;
  }
  const binding = ctx.csf._file.path.scope.getBinding(name);
  if (!binding?.constant || !t.isVariableDeclarator(binding.path.node)) {
    return undefined;
  }
  const init = binding.path.node.init;
  if (!init || !t.isObjectExpression(unwrapExpression(init))) {
    return undefined;
  }
  if (
    (binding.path.node.start ?? Number.POSITIVE_INFINITY) > position ||
    hasAssignmentInto(ctx.csf, name, 1, position)
  ) {
    return undefined;
  }
  return argsProperties(init, createSpreadArgsResolver(ctx, visited));
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

type StoryImportBinding =
  | { kind: 'named'; importId: string; exportName: string }
  | { kind: 'namespace'; importId: string };

const importBindingOf = (csf: CsfFile, localName: string): StoryImportBinding | undefined => {
  for (const statement of csf._file.path.node.body) {
    if (!t.isImportDeclaration(statement) || statement.importKind === 'type') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.local.name !== localName) {
        continue;
      }
      const importId = statement.source.value;
      if (t.isImportNamespaceSpecifier(specifier)) {
        return { kind: 'namespace', importId };
      }
      if (t.isImportSpecifier(specifier) && specifier.importKind !== 'type') {
        return {
          kind: 'named',
          importId,
          exportName: t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value,
        };
      }
      return undefined;
    }
  }
  return undefined;
};

/** How a story export declares itself, deciding which accessor reads its args at runtime. */
type StoryForm =
  | { kind: 'object'; config: t.ObjectExpression }
  | {
      kind: 'factory';
      method: 'story' | 'extend';
      call: t.CallExpression;
      config: t.ObjectExpression;
    }
  | { kind: 'function' };

const storyFormOf = (csf: CsfFile, exportName: string): StoryForm | undefined => {
  const declared = csf._storyExports[exportName];
  const candidates = [
    t.isVariableDeclarator(declared) ? declared.init : declared,
    csf._storyStatements[exportName],
  ];
  for (const candidate of candidates) {
    const unwrapped = candidate ? unwrapExpression(candidate) : undefined;
    if (!unwrapped) {
      continue;
    }
    if (t.isObjectExpression(unwrapped)) {
      return { kind: 'object', config: unwrapped };
    }
    if (t.isCallExpression(unwrapped) && isStoryFactoryCall(unwrapped)) {
      const method = ((unwrapped.callee as t.MemberExpression).property as t.Identifier).name as
        | 'story'
        | 'extend';
      const argument = unwrapped.arguments[0];
      const config = argument && unwrapExpression(argument);
      return config && t.isObjectExpression(config)
        ? { kind: 'factory', method, call: unwrapped, config }
        : undefined;
    }
    if (
      t.isArrowFunctionExpression(unwrapped) ||
      t.isFunctionExpression(unwrapped) ||
      t.isFunctionDeclaration(unwrapped) ||
      (t.isCallExpression(unwrapped) && isBindCall(unwrapped))
    ) {
      return { kind: 'function' };
    }
  }
  return undefined;
};

/**
 * The args a spread of this story's args object copies, as of `position` in the same file, or the
 * module's final state when `position` is `undefined` (a cross-file reference).
 *
 * `undefined` whenever the value at that moment cannot be pinned down: the story is declared after
 * the spread runs, a member assignment lands in between, or something mutates the args object.
 */
const storyArgsAt = (
  ctx: SpreadArgsContext,
  exportName: string,
  accessor: ArgsAccessor | undefined,
  position: number | undefined,
  visited: Set<string>
): ArgsRecord | undefined => {
  if (accessor === undefined) {
    return undefined;
  }
  const key = `${ctx.filePath}#${exportName}`;
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);
  try {
    return unguardedStoryArgsAt(ctx, exportName, accessor, position, visited);
  } finally {
    visited.delete(key);
  }
};

const unguardedStoryArgsAt = (
  ctx: SpreadArgsContext,
  exportName: string,
  accessor: ArgsAccessor,
  position: number | undefined,
  visited: Set<string>
): ArgsRecord | undefined => {
  const { csf } = ctx;
  const declarationStart = (csf._storyStatements[exportName] ?? csf._storyExports[exportName])
    ?.start;
  if (position !== undefined && (declarationStart == null || declarationStart > position)) {
    return undefined;
  }
  if (hasAssignmentInto(csf, exportName, 2, position)) {
    return undefined;
  }

  const form = storyFormOf(csf, exportName);
  if (form === undefined || (form.kind === 'factory') !== (accessor === 'input.args')) {
    return undefined;
  }

  const resolver = createSpreadArgsResolver(ctx, visited);
  const own =
    form.kind === 'function' ? { kind: 'missing' as const } : resolvedProperty(form.config, 'args');
  if (own.kind === 'unresolvable') {
    return undefined;
  }
  const ownNode = own.kind === 'value' ? own.node : undefined;

  const annotated = csf._storyAnnotations[exportName]?.args;
  // An annotation node the declaration does not contain is an `X.args = {...}` assignment; the
  // spread copies it only when the assignment has already run.
  const argsNode =
    annotated !== undefined && annotated !== ownNode
      ? position === undefined || (annotated.start != null && annotated.start < position)
        ? annotated
        : ownNode
      : ownNode;
  const record = argsProperties(argsNode, resolver);

  if (form.kind === 'factory' && form.method === 'extend') {
    const parent = unwrapExpression((form.call.callee as t.MemberExpression).object);
    const parentName = t.isIdentifier(parent) ? parent.name : undefined;
    const isStory =
      parentName !== undefined &&
      (csf._storyExports[parentName] !== undefined ||
        csf._storyStatements[parentName] !== undefined);
    if (!isStory) {
      return undefined;
    }
    const parentRecord = storyArgsAt(ctx, parentName!, 'input.args', position, visited);
    if (parentRecord === undefined) {
      return undefined;
    }
    return {
      properties: { ...parentRecord.properties, ...record.properties },
      complete: parentRecord.complete && record.complete,
      unresolved: [...parentRecord.unresolved, ...record.unresolved],
    };
  }
  return record;
};

/** Whether a top-level statement assigns into `name` at least `minDepth` member levels deep. */
const hasAssignmentInto = (
  csf: CsfFile,
  name: string,
  minDepth: number,
  position: number | undefined
): boolean => {
  for (const statement of csf._file.path.node.body) {
    if (!t.isExpressionStatement(statement) || !t.isAssignmentExpression(statement.expression)) {
      continue;
    }
    let target: t.Node = statement.expression.left;
    let depth = 0;
    while (t.isMemberExpression(target)) {
      depth += 1;
      target = target.object;
    }
    if (
      depth >= minDepth &&
      t.isIdentifier(target) &&
      target.name === name &&
      (position === undefined || (statement.start ?? 0) < position)
    ) {
      return true;
    }
  }
  return false;
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
