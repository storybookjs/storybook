import { types as t } from 'storybook/internal/babel';
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
import {
  buildComponentOutletTemplate,
  buildTemplate,
  formatInputValue,
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

  const deps: StoryDocDeps = {
    csf,
    source,
    metaArgs: argsRecordFromNode(csf._metaAnnotations.args),
    metaHasRender: csf._metaAnnotations.render !== undefined,
    snippetMeta: docgenPayload?.angularComponentMeta,
  };

  const stories: Record<string, StoryDoc> = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    stories[story.id] = buildStoryDoc(exportName, story, deps);
  }

  const titleName = input.entry.title.split('/').at(-1)!.replace(/\s+/g, '');
  const componentName = componentNameOf(componentNode);
  const importStatement = componentName && createImportStatement(componentName, csf, docgenPayload);

  return {
    id: getComponentIdFromEntry(input.entry),
    // The docgen payload knows the class name even when the story file imported it under an alias.
    name: docgenPayload?.name ?? componentName ?? titleName,
    path: storyImportPath,
    ...(importStatement ? { import: importStatement } : {}),
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
  metaHasRender: boolean;
  snippetMeta: AngularComponentSnippetMeta | undefined;
}

// Stories that declare their own `render` get no snippet: their template is a runtime value static
// analysis cannot see, and a component-derived one would misrepresent it.
const buildStoryDoc = (
  exportName: string,
  story: CsfFile['_stories'][string],
  { csf, source, metaArgs, metaHasRender, snippetMeta }: StoryDocDeps
): StoryDoc => {
  const name = story.name ?? storyNameFromExport(exportName);
  try {
    const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
    const annotations = csf._storyAnnotations[exportName] ?? {};
    const hasRender = metaHasRender || annotations.render !== undefined;
    const args = mergeArgsRecords(metaArgs, argsRecordFromNode(annotations.args));
    const snippet =
      snippetMeta && !hasRender ? renderStorySnippet(snippetMeta, args, source) : undefined;

    return {
      id: story.id,
      name,
      ...(snippet === undefined ? {} : { snippet }),
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

const renderStorySnippet = (
  snippetMeta: AngularComponentSnippetMeta,
  args: Record<string, t.Node>,
  source: string
): string => {
  if (!snippetMeta.selector) {
    return buildComponentOutletTemplate(snippetMeta.name);
  }
  const inputNames = new Set(snippetMeta.inputs);
  const inputs = Object.entries(args)
    .filter(([argName]) => inputNames.has(argName))
    .map(([argName, node]) => ({
      name: argName,
      expression: evaluateArgExpression(node, source, snippetMeta.enums),
    }));
  return buildTemplate(snippetMeta.selector, { inputs, outputs: snippetMeta.outputs });
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
