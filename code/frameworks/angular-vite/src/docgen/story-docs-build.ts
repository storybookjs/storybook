import { type NodePath, types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile } from 'storybook/internal/csf-tools';
import {
  argsRecordFromNode,
  buildImportStatements,
  collectImportBindings,
  extractStoryJSDocInfo,
  keyOf,
  mergeArgsRecords,
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
  formatInputValue,
  formatPropInTemplate,
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
    metaArgs: argsRecordFromNode(csf._metaAnnotations.args),
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
  metaArgs: Record<string, t.Node>;
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
    const shape: StoryShape = {
      csf,
      exportName,
      annotations,
      args: mergeArgsRecords(deps.metaArgs, argsRecordFromNode(annotations.args)),
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
  source: string;
}

/**
 * Snippets show the markup a story supplies itself - through `template`, a `render` that returns
 * one, or the CSF2 function form - as written; only markup that cannot be read without running the
 * story falls back to the component-derived bindings.
 */
const renderStorySnippet = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  componentImport: string | undefined
): string => {
  // The story file's local name is what the import binds, so an aliased import stays consistent
  // between the import statement, the `imports` array and the template.
  const localName = componentNameOf(shape.csf._metaAnnotations.component) ?? snippetMeta.name;
  if (!snippetMeta.selector) {
    return buildHostComponentSnippet({
      template: buildComponentOutletTemplate(localName),
      componentName: localName,
      componentImport,
      viaComponentOutlet: true,
      outputs: [],
    });
  }

  const bindings = collectBindings(snippetMeta, shape);
  const userMarkup = userTemplate(shape, bindings);
  const template =
    userMarkup?.kind === 'literal'
      ? userMarkup.markup
      : buildTemplate(snippetMeta.selector, {
          inputs: bindings.inputs,
          outputs: bindings.outputs,
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

/**
 * Markup the story supplies itself, falling back to the meta's.
 *
 * Returns `undefined` when neither declares one, which is the plain `{ args }` story the generated
 * bindings are built for.
 */
const userTemplate = (shape: StoryShape, bindings: Bindings): TemplateResult | undefined =>
  templateOf(shape.annotations, shape, bindings) ??
  // CSF2: the story is the function, and Angular's idiom is to return `{ template }`.
  templateFrom(propertyOf(csf2Return(shape), 'template'), shape, bindings) ??
  templateOf(shape.csf._metaAnnotations, shape, bindings);

/** The template a config declares directly, or through a `render` that returns one. */
const templateOf = (
  annotations: Record<string, t.Node>,
  shape: StoryShape,
  bindings: Bindings
): TemplateResult | undefined => {
  const own = templateFrom(declaredValue(shape, annotations.template), shape, bindings);
  if (own) {
    return own;
  }
  if (annotations.render === undefined) {
    return undefined;
  }

  // A story whose `render` exists but cannot be read must not inherit the meta's markup, which is
  // for code the story never runs.
  const returned = returnedObject(declaredValue(shape, annotations.render));
  return returned
    ? templateFrom(propertyOf(returned, 'template'), shape, bindings)
    : { kind: 'unresolvable' };
};

const templateFrom = (
  node: t.Node | undefined,
  shape: StoryShape,
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
    const markup = interpolate(node, shape, bindings);
    return markup === undefined ? { kind: 'unresolvable' } : { kind: 'literal', markup };
  }
  return { kind: 'unresolvable' };
};

/** Markup a template literal holds once every `${…}` in it has been substituted. */
const interpolate = (
  node: t.TemplateLiteral,
  shape: StoryShape,
  bindings: Bindings
): string | undefined => {
  let markup = node.quasis[0]?.value.cooked ?? '';

  for (const [index, expression] of node.expressions.entries()) {
    const substituted = substituteExpression(expression, shape, bindings);
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
  shape: StoryShape,
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
  return t.isIdentifier(expression) ? literalText(shape.args[expression.name]) : undefined;
};

/** Named property of an object literal, if it has one. */
const propertyOf = (node: t.Node | undefined, name: string): t.Node | undefined => {
  const unwrapped = node && unwrapExpression(node);
  if (!unwrapped || !t.isObjectExpression(unwrapped)) {
    return undefined;
  }
  const property = unwrapped.properties.find(
    (candidate): candidate is t.ObjectProperty =>
      t.isObjectProperty(candidate) && keyOf(candidate) === name
  );
  return property?.value;
};

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

/** The object a CSF2 function story returns, for `export const S = () => ({ template })`. */
const csf2Return = (shape: StoryShape): t.ObjectExpression | undefined => {
  const declared = shape.csf._storyExports[shape.exportName];
  if (t.isVariableDeclarator(declared)) {
    return returnedObject(declared.init ?? undefined);
  }
  if (t.isFunctionDeclaration(declared)) {
    return returnedObject(declared);
  }
  // `export { S }` records no declarator; the statement is the initializer it resolved to.
  return returnedObject(shape.csf._storyStatements[shape.exportName]);
};

/**
 * An annotation value, following a bare name back to what it was declared as in this file.
 *
 * `template: HOISTED_TEMPLATE` is markup the story really did write, so refusing to look through
 * the name would replace it with a fabricated element. An imported name has no initializer here,
 * so it stays an identifier and the snippet falls back to the generated bindings.
 */
const declaredValue = (shape: StoryShape, node: t.Node | undefined): t.Node | undefined => {
  if (!t.isIdentifier(node)) {
    return node;
  }
  const program: NodePath<t.Program> = shape.csf._file.path;
  const declaration = program.scope.getBinding(node.name)?.path.node;
  if (t.isVariableDeclarator(declaration)) {
    return declaration.init ?? node;
  }
  return t.isFunctionDeclaration(declaration) ? declaration : node;
};

const EVAL_FAILED = Symbol('story-docs-eval-failed');

// An arg no static evaluation could reduce to a value falls back to its source text. Binding values
// are delimited by double quotes, so a raw expression containing one would close its own attribute;
// the entity survives the template parser and reads back as the original quote.
const evaluateArgExpression = (node: t.Node, source: string, enums: SnippetEnum[]): string => {
  const unwrapped = unwrapExpression(node);
  const value = evaluateNode(unwrapped, enums);
  if (value !== EVAL_FAILED) {
    return formatInputValue(value);
  }
  const text =
    unwrapped.start != null && unwrapped.end != null
      ? source.slice(unwrapped.start, unwrapped.end)
      : undefined;
  return (text ?? 'undefined').replace(/"/g, '&quot;');
};

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
