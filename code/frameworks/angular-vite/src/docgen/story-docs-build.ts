import { types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import {
  argsRecordFromObjectNode,
  extractStoryJSDocInfo,
  keyOf,
  mergeArgsRecords,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { resolve } from 'node:path';

import type { EnumType, Property } from '@storybook/angular-compodoc';
import type { AngularClassMeta, AngularComponentMetaResult } from '@storybook/angular-cm';
import { parseStoryFile, resolveComponentOf } from './resolve-component.ts';
import { buildComponentOutletTemplate } from '../template-grammar.ts';
import {
  type SnippetArgValue,
  type SnippetInputBinding,
  renderComponentSnippet,
} from './story-docs-snippet.ts';

/**
 * A component-meta lookup reached through the shared docgen worker rather than an in-process
 * analyzer, so `extractComponentMeta` is Promise-returning here (a real `AngularComponentMetaManager`
 * resolves synchronously; `await`ing a non-Promise value is a no-op).
 */
export interface AngularComponentMetaQuerySource {
  extractComponentMeta(
    componentPath: string,
    names: { exportName: string; localName?: string }
  ): Promise<AngularComponentMetaResult | undefined>;
}

export interface BuildStoryDocsContext {
  // `undefined` when the docgen worker is unavailable; descriptions still extract without it.
  manager: AngularComponentMetaQuerySource | undefined;
  resolvePath?: (importPath: string) => string;
}

// Stories that declare their own `render` get no snippet: their template is a runtime value static
// analysis cannot see, and a component-derived one would misrepresent it.
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
  const storyPath = resolvePath(storyImportPath);

  const parsed = parseStoryFile(storyPath, input.entry.title);
  if (!parsed) {
    return undefined;
  }
  const { source, csf } = parsed;

  const resolution = resolveComponentOf(csf, storyPath);
  const component = 'reason' in resolution ? undefined : resolution.component;

  let meta: AngularComponentMetaResult | undefined;
  if (component?.path && context.manager) {
    try {
      meta = await context.manager.extractComponentMeta(component.path, {
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

  const metaArgs = argsOf(csf._metaAnnotations.args);
  const metaHasRender = csf._metaAnnotations.render !== undefined;

  const stories: Record<string, StoryDoc> = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    const name = story.name ?? storyNameFromExport(exportName);
    try {
      const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);

      const annotations = csf._storyAnnotations[exportName] ?? {};
      const hasRender = metaHasRender || annotations.render !== undefined;
      const args = mergeArgsRecords(metaArgs, argsOf(annotations.args));
      const snippet =
        snippetContext && !hasRender ? renderStorySnippet(snippetContext, args, source) : undefined;

      stories[story.id] = {
        id: story.id,
        name,
        ...(snippet === undefined ? {} : { snippet }),
        ...(description ? { description } : {}),
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
  // Output binding names in `outputsClass` order, `model()` outputs `Change`-suffixed.
  outputs: string[];
  enums: EnumType[];
}

const inputsOf = (entry: AngularClassMeta): Property[] =>
  'inputsClass' in entry ? (entry.inputsClass ?? []) : [];

const outputsOf = (entry: AngularClassMeta): Property[] =>
  'outputsClass' in entry ? (entry.outputsClass ?? []) : [];

const createSnippetContext = (meta: AngularComponentMetaResult): SnippetContext => {
  const inputNames = new Set(inputsOf(meta.entry).map((input) => input.name));
  const outputs: string[] = [];
  for (const output of outputsOf(meta.entry)) {
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
  args: Record<string, t.Node>,
  source: string
): string => {
  if (!snippetContext.selector) {
    return buildComponentOutletTemplate(snippetContext.componentName);
  }
  const inputs: SnippetInputBinding[] = [];
  for (const [argName, node] of Object.entries(args)) {
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

// Peels TS assertion/satisfies wrappers and parentheses off an annotation value node.
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

const argsOf = (node: t.Node | undefined): Record<string, t.Node> => {
  const unwrapped = node && unwrapExpression(node);
  return unwrapped && t.isObjectExpression(unwrapped) ? argsRecordFromObjectNode(unwrapped) : {};
};

const EVAL_FAILED = Symbol('story-docs-eval-failed');

const evaluateArgValue = (node: t.Node, source: string, enums: EnumType[]): SnippetArgValue => {
  const unwrapped = unwrapExpression(node);
  const value = evaluateNode(unwrapped, enums);
  if (value !== EVAL_FAILED) {
    return { kind: 'value', value };
  }
  const text =
    unwrapped.start != null && unwrapped.end != null
      ? source.slice(unwrapped.start, unwrapped.end)
      : undefined;
  return { kind: 'raw', text: text ?? 'undefined' };
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
    const child = enums
      .find((enumeration) => enumeration.name === objectName)
      ?.childs.find((candidate) => candidate.name === propertyName);
    return child?.value ?? EVAL_FAILED;
  }
  return EVAL_FAILED;
};
