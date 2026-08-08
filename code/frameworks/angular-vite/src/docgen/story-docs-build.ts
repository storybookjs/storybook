import { generate, type NodePath, types as t } from 'storybook/internal/babel';
import {
  createMetaComponentResolver,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
  type ResolvedMetaComponent,
} from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile } from 'storybook/internal/csf-tools';
import { extractDescription, extractJSDocInfo, loadCsf } from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { EnumType, Property } from '@storybook/angular-compodoc';
import type { AngularComponentMetaResult } from '@storybook/angular-cm';
import type { AngularComponentMetaSource } from './build-docgen.ts';
import type { AngularHostContext } from './story-docs-host.ts';
import { angularHostComponent, angularHostImports } from './story-docs-host.ts';
import {
  type BindingFilter,
  RawArgExpression,
  bindingAttributes,
  renderComponentOutletSnippet,
  renderComponentSnippet,
  type SnippetInputBinding,
} from './story-docs-snippet.ts';
import type { SnippetFormat } from '../types.ts';

const resolveMetaComponent = createMetaComponentResolver();

/** Preserves what the browser generator produces, so `component` stays an opt-in. */
export const DEFAULT_SNIPPET_FORMAT: SnippetFormat = 'template';

export interface BuildStoryDocsContext {
  /** `undefined` when the analyzer could not be created; descriptions still extract without it. */
  manager: AngularComponentMetaSource | undefined;
  /** Same hook the docgen builder exposes, defaulting to the same resolution against cwd. */
  resolvePath?: (importPath: string) => string;
  /** Shape of the emitted snippet. Defaults to {@link DEFAULT_SNIPPET_FORMAT}. */
  snippetFormat?: SnippetFormat;
}

/**
 * How the host wrapper names and imports the component.
 *
 * The name is the class's own, which is already what the outlet form renders as a template
 * expression; the import aliases the story file's export name back to it when the two differ.
 */
const hostContext = (
  ref: ResolvedMetaComponent,
  snippetContext: SnippetContext
): AngularHostContext => ({
  componentName: snippetContext.componentName,
  exportName: ref.exportName,
  ...(ref.importId === undefined ? {} : { importId: ref.importId }),
  outlet: !snippetContext.selector,
});

/**
 * Output names the markup binds, which the host has to declare methods for.
 *
 * Matched against the binding this generator emits rather than assumed to be every output: a story
 * that wrote its own markup around `argsToTemplate(args, { exclude })` binds only some of them, and
 * one that wrote plain markup binds none.
 */
const boundOutputs = (markup: string, outputs: readonly string[]): string[] =>
  outputs.filter((name) => markup.includes(bindingAttributes({ inputs: [], outputs: [name] })[0]));

/**
 * Builds a {@link StoryDocsPayload} for the stories in one CSF story file.
 *
 * Snippets render the component's selector with `[input]` bindings for the args present in the
 * story (meta args merged under story args) and `(output)` bindings for every output - mirroring
 * the runtime source decorator, where addon-actions injects a handler arg for each output. A story
 * that supplies its own markup, through `template` or through a `render` that returns one, is shown
 * as written instead; only markup that cannot be read without running the story falls back to the
 * component-derived bindings. A story left incomplete that way, or one whose args a spread hides,
 * carries a `warning` naming what could not be read.
 *
 * Returns `undefined` when the entry has no story file or the file cannot be parsed (fall through
 * to the next provider). A resolvable file whose component cannot be analyzed still yields a
 * payload carrying story descriptions, just without snippets.
 */
export const buildStoryDocsPayload = (
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext
): StoryDocsPayload | undefined => {
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => resolve(process.cwd(), importPath));
  const storyPath = resolvePath(storyImportPath);

  let source: string;
  let csf: ReturnType<ReturnType<typeof loadCsf>['parse']>;
  try {
    source = readFileSync(storyPath, 'utf8');
    csf = loadCsf(source, { makeTitle: () => input.entry.title }).parse();
  } catch {
    return undefined;
  }

  const resolution = resolveMetaComponent(csf, storyPath);
  const component = 'reason' in resolution ? undefined : resolution.component;

  let meta: AngularComponentMetaResult | undefined;
  if (component?.path && context.manager) {
    try {
      meta = context.manager.extractComponentMeta(component.path, {
        exportName: component.exportName,
        localName: component.localName,
      });
    } catch {
      meta = undefined;
    }
  }
  const snippetContext = meta ? createSnippetContext(meta) : undefined;
  // Set only for the `component` format, and only when there is something to wrap: a payload that
  // carries no snippets would otherwise advertise an import block for markup it never emits.
  const host =
    (context.snippetFormat ?? DEFAULT_SNIPPET_FORMAT) === 'component' && snippetContext && component
      ? hostContext(component, snippetContext)
      : undefined;
  const outputs = snippetContext?.outputs ?? [];

  const displayName =
    component && (component.exportName === 'default' ? component.localName : component.exportName);
  const titleName = input.entry.title.split('/').at(-1)!.replace(/\s+/g, '');

  const metaArgs = objectPropertiesOf(csf._metaAnnotations.args);

  const stories: Record<string, StoryDoc> = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    const name = story.name ?? storyNameFromExport(exportName);
    try {
      const jsdocComment = extractDescription(csf._storyStatements[exportName]);
      const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
      const finalDescription = ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim();
      const summary = tags?.summary?.[0];

      const annotations = csf._storyAnnotations[exportName] ?? {};
      const args = new Map([...metaArgs, ...objectPropertiesOf(annotations.args)]);
      const rendered = snippetContext
        ? renderStorySnippet(snippetContext, { csf, exportName, annotations, args, source })
        : undefined;
      const snippet =
        rendered && host
          ? angularHostComponent(rendered.snippet, boundOutputs(rendered.snippet, outputs), host)
          : rendered?.snippet;

      stories[story.id] = {
        id: story.id,
        name,
        ...(snippet === undefined ? {} : { snippet }),
        ...(rendered?.warning === undefined ? {} : { warning: rendered.warning }),
        ...(finalDescription ? { description: finalDescription } : {}),
        ...(summary === undefined ? {} : { summary }),
      };
    } catch (e) {
      const err = e instanceof Error ? e : undefined;
      stories[story.id] = {
        id: story.id,
        name,
        error: { name: err?.name ?? 'Error', message: err?.message ?? String(e) },
      };
    }
  }

  return {
    id: getComponentIdFromEntry(input.entry),
    // The analyzer knows the class name even when the story file imported it as a default export.
    name: meta?.entry.name ?? displayName ?? titleName,
    path: storyImportPath,
    ...(host ? { import: angularHostImports(host) } : {}),
    stories,
  };
};

interface SnippetContext {
  selector: string | undefined;
  componentName: string;
  inputNames: Set<string>;
  /** Output binding names in `outputsClass` order, `model()` outputs `Change`-suffixed. */
  outputs: string[];
  enums: EnumType[];
}

const readProperties = (entry: unknown, key: 'inputsClass' | 'outputsClass'): Property[] =>
  (entry as Record<typeof key, Property[] | undefined>)[key] ?? [];

const createSnippetContext = (meta: AngularComponentMetaResult): SnippetContext => {
  const inputNames = new Set(readProperties(meta.entry, 'inputsClass').map((input) => input.name));
  const outputs: string[] = [];
  for (const output of readProperties(meta.entry, 'outputsClass')) {
    // model() lands under the same bare name in both arrays; its output binds as `${name}Change`.
    const bindingName = inputNames.has(output.name) ? `${output.name}Change` : output.name;
    if (!outputs.includes(bindingName)) {
      outputs.push(bindingName);
    }
  }
  return {
    selector: meta.entry.selector,
    componentName: meta.entry.name,
    inputNames,
    outputs,
    enums: meta.json.miscellaneous?.enumerations ?? [],
  };
};

/** One story, as much of it as reading the markup it supplies needs. */
interface StoryShape {
  csf: CsfFile;
  exportName: string;
  annotations: Record<string, t.Node>;
  /** Meta args merged under story args, keyed by arg name. */
  args: Map<string, t.Node>;
  source: string;
}

/** A story's snippet, plus what a static pass could not read to build it. */
interface RenderedSnippet {
  snippet: string;
  warning?: string;
}

const renderStorySnippet = (snippetContext: SnippetContext, story: StoryShape): RenderedSnippet => {
  if (!snippetContext.selector) {
    // The outlet form shows no args at all, so naming the args that could not be read would say
    // nothing about what is missing from it.
    return { snippet: renderComponentOutletSnippet(snippetContext.componentName) };
  }

  const inputs: SnippetInputBinding[] = [];
  for (const [argName, node] of story.args) {
    if (snippetContext.inputNames.has(argName)) {
      inputs.push({
        name: argName,
        value: evaluateArgValue(node, story.source, snippetContext.enums),
      });
    }
  }
  const bindings = { inputs, outputs: snippetContext.outputs };

  const template = userTemplate(story, bindings);
  if (template?.kind === 'literal') {
    // The story is shown exactly as it was written, so nothing about it is missing.
    return { snippet: template.markup };
  }

  const unresolved = [
    ...(template ? [template.source] : []),
    ...unresolvableProperties(story.csf._metaNode),
    ...unresolvableProperties(storyConfig(story)),
  ];
  return {
    snippet: renderComponentSnippet({ selector: snippetContext.selector, ...bindings }),
    ...(unresolved.length > 0 ? { warning: unresolvedWarning(unresolved) } : {}),
  };
};

/** Source text of a node, for naming an expression this pass could not read. */
const sourceOf = (node: t.Node): string => generate(node, { concise: true, comments: false }).code;

/** Says which source text a static pass could not read, so a reader can see what is missing. */
const unresolvedWarning = (unresolved: readonly string[]): string =>
  `Incomplete snippet: ${unresolved.map((source) => `\`${source}\``).join(', ')} could not be resolved statically.`;

/**
 * Source text of everything in a config object a static pass cannot read - spreads, computed keys,
 * methods - at the config level and inside its `args`. A spread at the config level carries args
 * just as invisibly as one inside `args`, so both are reported.
 */
const unresolvableProperties = (config: t.ObjectExpression | undefined): string[] =>
  [config, objectExpressionOf(propertyOf(config, 'args'))].flatMap((object) =>
    (object?.properties ?? [])
      .filter((property) => !t.isObjectProperty(property) || keyOf(property) === undefined)
      .map(sourceOf)
  );

/** What a `template` turned out to hold. */
type TemplateResult =
  /** Read as markup, so the story is shown as written. */
  | { kind: 'literal'; markup: string }
  /**
   * A `template` or `render` exists, but its markup needs the story to run. `source` is that
   * expression as written, so the story can say which one it fell back from.
   */
  | { kind: 'unresolvable'; source: string };

/** Bindings the generated snippet would carry, which is also what `argsToTemplate` expands to. */
type Bindings = { inputs: SnippetInputBinding[]; outputs: string[] };

/**
 * Markup the story supplies itself, falling back to the meta's.
 *
 * Returns `undefined` when neither declares one, which is the plain `{ args }` story the generated
 * bindings are built for.
 */
const userTemplate = (story: StoryShape, bindings: Bindings): TemplateResult | undefined =>
  templateOf(story.annotations, story, bindings) ??
  // CSF2: the story is the function, and Angular's idiom is to return `{ template }`.
  templateFrom(propertyOf(csf2Return(story), 'template'), story, bindings) ??
  templateOf(story.csf._metaAnnotations, story, bindings);

/** The template a config declares directly, or through a `render` that returns one. */
const templateOf = (
  annotations: Record<string, t.Node>,
  story: StoryShape,
  bindings: Bindings
): TemplateResult | undefined => {
  const own = templateFrom(declaredValue(story, annotations.template), story, bindings);
  if (own) {
    return own;
  }
  if (annotations.render === undefined) {
    return undefined;
  }

  // A story whose `render` exists but cannot be read must not inherit the meta's markup, which is
  // for code the story never runs.
  const returned = returnedObject(declaredValue(story, annotations.render));
  return returned
    ? templateFrom(propertyOf(returned, 'template'), story, bindings)
    : { kind: 'unresolvable', source: `render: ${sourceOf(annotations.render)}` };
};

const templateFrom = (
  node: t.Node | undefined,
  story: StoryShape,
  bindings: Bindings
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
    const markup = interpolate(node, story, bindings);
    return markup === undefined
      ? { kind: 'unresolvable', source: sourceOf(node) }
      : { kind: 'literal', markup };
  }
  return { kind: 'unresolvable', source: sourceOf(node) };
};

/** Markup a template literal holds once every `${…}` in it has been substituted. */
const interpolate = (
  node: t.TemplateLiteral,
  story: StoryShape,
  bindings: Bindings
): string | undefined => {
  let markup = node.quasis[0]?.value.cooked ?? '';

  for (const [index, expression] of node.expressions.entries()) {
    const substituted = substituteExpression(expression, story, bindings);
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
 */
const substituteExpression = (
  expression: t.Node,
  story: StoryShape,
  bindings: Bindings
): string | undefined => {
  if (
    t.isCallExpression(expression) &&
    t.isIdentifier(expression.callee) &&
    expression.callee.name === 'argsToTemplate'
  ) {
    const options = expression.arguments[1];
    const filter: BindingFilter = {
      include: stringArray(propertyOf(options, 'include')),
      exclude: stringArray(propertyOf(options, 'exclude')),
    };
    return bindingAttributes(bindings, filter).join(' ');
  }

  // `render: ({ footer, ...args }) => …` destructures an arg and interpolates it as slot content.
  return t.isIdentifier(expression) ? literalText(story.args.get(expression.name)) : undefined;
};

/** Named property of an object literal, if it has one. */
const propertyOf = (node: t.Node | undefined, name: string): t.Node | undefined =>
  objectPropertiesOf(node).get(name);

/** String array literal, for `argsToTemplate`'s `include` / `exclude` options. */
const stringArray = (node: t.Node | undefined): string[] | undefined =>
  t.isArrayExpression(node)
    ? node.elements.filter((element) => t.isStringLiteral(element)).map((element) => element.value)
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

/** Object literal a story or `render` function returns, when it returns one directly. */
const returnedObject = (fn: t.Node | undefined): t.ObjectExpression | undefined => {
  if (
    !t.isArrowFunctionExpression(fn) &&
    !t.isFunctionExpression(fn) &&
    !t.isFunctionDeclaration(fn)
  ) {
    return undefined;
  }
  const returned = t.isBlockStatement(fn.body)
    ? fn.body.body.find((statement) => t.isReturnStatement(statement))?.argument
    : fn.body;
  const unwrapped = returned && unwrapExpression(returned);
  return t.isObjectExpression(unwrapped) ? unwrapped : undefined;
};

/** What a story export was declared as, whichever branch of the CSF parser registered it. */
const storyInitializer = (story: StoryShape): t.Node | undefined => {
  const declared = story.csf._storyExports[story.exportName];
  if (t.isVariableDeclarator(declared)) {
    return declared.init ?? undefined;
  }
  if (t.isFunctionDeclaration(declared)) {
    return declared;
  }
  // `export { S }` records no declarator; the statement is the initializer it resolved to.
  return story.csf._storyStatements[story.exportName];
};

/** The object a CSF2 function story returns, for `export const S = () => ({ template })`. */
const csf2Return = (story: StoryShape): t.ObjectExpression | undefined =>
  returnedObject(storyInitializer(story));

/**
 * A story's own config object.
 *
 * `_storyAnnotations` only records the properties that have a static name, so the object itself is
 * what a spread or a computed key has to be read off.
 */
const storyConfig = (story: StoryShape): t.ObjectExpression | undefined =>
  objectExpressionOf(storyInitializer(story));

/**
 * An annotation value, following a bare name back to what it was declared as in this file.
 *
 * `template: HOISTED_TEMPLATE` is markup the story really did write, so refusing to look through
 * the name would replace it with a fabricated element. An imported name has no initializer here,
 * so it stays an identifier and the snippet falls back to the generated bindings.
 */
const declaredValue = (story: StoryShape, node: t.Node | undefined): t.Node | undefined => {
  if (!t.isIdentifier(node)) {
    return node;
  }
  const program: NodePath<t.Program> = story.csf._file.path;
  const declaration = program.scope.getBinding(node.name)?.path.node;
  if (t.isVariableDeclarator(declaration)) {
    return declaration.init ?? node;
  }
  return t.isFunctionDeclaration(declaration) ? declaration : node;
};

/** Peels TS assertion/satisfies wrappers and parentheses off an annotation value node. */
const unwrapExpression = (node: t.Node): t.Node => {
  if (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isParenthesizedExpression(node)
  ) {
    return unwrapExpression(node.expression);
  }
  return node;
};

/** The object literal a node holds, peeling TS wrappers off it first. */
const objectExpressionOf = (node: t.Node | undefined): t.ObjectExpression | undefined => {
  const unwrapped = node && unwrapExpression(node);
  return t.isObjectExpression(unwrapped) ? unwrapped : undefined;
};

/** Static name of an object property, or `undefined` when reading it needs the file to run. */
const keyOf = (property: t.ObjectProperty): string | undefined => {
  if (property.computed) {
    return undefined;
  }
  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }
  return t.isStringLiteral(property.key) ? property.key.value : undefined;
};

/** Named properties of an `args` object literal, in source order. */
const objectPropertiesOf = (node: t.Node | undefined): Map<string, t.Node> => {
  const properties = new Map<string, t.Node>();
  for (const property of objectExpressionOf(node)?.properties ?? []) {
    if (!t.isObjectProperty(property)) {
      continue;
    }
    const key = keyOf(property);
    if (key !== undefined) {
      properties.set(key, property.value);
    }
  }
  return properties;
};

const EVAL_FAILED = Symbol('story-docs-eval-failed');

/**
 * Evaluates a literal-shaped arg value AST to the JS value the runtime generator would receive.
 * Anything not statically known (identifier references, functions, calls) falls back to a
 * {@link RawArgExpression} with the arg's source text, inlined verbatim into the binding.
 */
const evaluateArgValue = (node: t.Node, source: string, enums: EnumType[]): unknown => {
  const unwrapped = unwrapExpression(node);
  const value = evaluateNode(unwrapped, enums);
  if (value !== EVAL_FAILED) {
    return value;
  }
  const text =
    unwrapped.start != null && unwrapped.end != null
      ? source.slice(unwrapped.start, unwrapped.end)
      : undefined;
  return new RawArgExpression(text ?? 'undefined');
};

const evaluateNode = (node: t.Node, enums: EnumType[]): unknown => {
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
      if (key === undefined) {
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
    const child = enums
      .find((enumeration) => enumeration.name === objectName)
      ?.childs.find((candidate) => candidate.name === propertyName);
    return child?.value ?? EVAL_FAILED;
  }
  return EVAL_FAILED;
};
