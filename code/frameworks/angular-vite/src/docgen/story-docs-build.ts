import { types as t } from 'storybook/internal/babel';
import {
  createMetaComponentResolver,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
} from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription, extractJSDocInfo, loadCsf } from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { EnumType, Property } from '@storybook/angular-compodoc';
import type { AngularComponentMetaResult } from '@storybook/angular-cm';
import type { AngularComponentMetaSource } from './build-docgen.ts';
import {
  RawArgExpression,
  renderComponentOutletSnippet,
  renderComponentSnippet,
  type SnippetInputBinding,
} from './story-docs-snippet.ts';

const resolveMetaComponent = createMetaComponentResolver();

export interface BuildStoryDocsContext {
  /** `undefined` when the analyzer could not be created; descriptions still extract without it. */
  manager: AngularComponentMetaSource | undefined;
  /** Same hook the docgen builder exposes, defaulting to the same resolution against cwd. */
  resolvePath?: (importPath: string) => string;
}

/**
 * Builds a {@link StoryDocsPayload} for the stories in one CSF story file.
 *
 * Snippets render the component's selector with `[input]` bindings for the args present in the
 * story (meta args merged under story args) and `(output)` bindings for every output - mirroring
 * the runtime source decorator, where addon-actions injects a handler arg for each output. Stories
 * that declare their own `render` are skipped for snippets: their template is a runtime value the
 * static analysis cannot see, and the component-derived template would misrepresent it.
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

  const displayName =
    component && (component.exportName === 'default' ? component.localName : component.exportName);
  const titleName = input.entry.title.split('/').at(-1)!.replace(/\s+/g, '');

  const metaArgs = objectPropertiesOf(csf._metaAnnotations.args);
  const metaHasRender = csf._metaAnnotations.render !== undefined;

  const stories: Record<string, StoryDoc> = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    const name = story.name ?? storyNameFromExport(exportName);
    try {
      const jsdocComment = extractDescription(csf._storyStatements[exportName]);
      const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
      const finalDescription = ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim();
      const summary = tags?.summary?.[0];

      const annotations = csf._storyAnnotations[exportName] ?? {};
      const hasRender = metaHasRender || annotations.render !== undefined;
      const args = new Map([...metaArgs, ...objectPropertiesOf(annotations.args)]);
      const snippet =
        snippetContext && !hasRender ? renderStorySnippet(snippetContext, args, source) : undefined;

      stories[story.id] = {
        id: story.id,
        name,
        ...(snippet === undefined ? {} : { snippet }),
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

const renderStorySnippet = (
  snippetContext: SnippetContext,
  args: Map<string, t.Node>,
  source: string
): string => {
  if (!snippetContext.selector) {
    return renderComponentOutletSnippet(snippetContext.componentName);
  }
  const inputs: SnippetInputBinding[] = [];
  for (const [argName, node] of args) {
    if (snippetContext.inputNames.has(argName)) {
      inputs.push({ name: argName, value: evaluateArgValue(node, source, snippetContext.enums) });
    }
  }
  return renderComponentSnippet({
    selector: snippetContext.selector,
    inputs,
    outputs: snippetContext.outputs,
  });
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

/** Named properties of an `args` object literal, in source order. */
const objectPropertiesOf = (node: t.Node | undefined): Map<string, t.Node> => {
  const properties = new Map<string, t.Node>();
  const unwrapped = node && unwrapExpression(node);
  if (!unwrapped || !t.isObjectExpression(unwrapped)) {
    return properties;
  }
  for (const property of unwrapped.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      continue;
    }
    const key = t.isIdentifier(property.key)
      ? property.key.name
      : t.isStringLiteral(property.key)
        ? property.key.value
        : undefined;
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
      if (!t.isObjectProperty(property) || property.computed) {
        return EVAL_FAILED;
      }
      const key = t.isIdentifier(property.key)
        ? property.key.name
        : t.isStringLiteral(property.key)
          ? property.key.value
          : undefined;
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
