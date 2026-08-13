import { types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile } from 'storybook/internal/csf-tools';
import {
  buildImportStatements,
  collectImportBindings,
  extractStoryJSDocInfo,
  resolveComponentImport,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { resolve } from 'node:path';

import type { AngularComponentSnippetMeta, AngularDocgenPayload } from './build-docgen.ts';
import { parseStoryFile, resolveStoryImport } from './resolve-component.ts';
import type { ArgsRecord, SpreadArgsContext } from './story-docs-args.ts';
import {
  argsProperties,
  createSpreadArgsResolver,
  evaluateArgExpression,
  hasAssignmentInto,
} from './story-docs-args.ts';
import type { Bindings, StoryShape } from './story-docs-markup.ts';
import { userTemplate } from './story-docs-markup.ts';
import type { StoryNgModules } from './story-docs-ng-modules.ts';
import { ngModulesFromDecorators, storyNgModules } from './story-docs-ng-modules.ts';
import type { HostComponentSnippet } from './story-docs-snippet.ts';
import { buildHostComponentSnippet } from './story-docs-snippet.ts';
import {
  buildComponentOutletTemplate,
  buildTemplate,
  formatTemplateMarkup,
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
      argsReadable:
        deps.metaArgs.complete &&
        storyArgs.complete &&
        !hasAssignmentInto(csf, exportName, 2, undefined),
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

/**
 * Snippets show the markup a story supplies itself - through `template`, a `render` that returns
 * one, or the CSF2 function form - as written. Markup or args that cannot be read without running
 * the story yield no snippet at all, so the runtime source fallback stays authoritative rather
 * than a fabricated element misrepresenting what the story renders.
 */
const renderStorySnippet = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  storyDecorators: t.Node | undefined,
  deps: StoryDocDeps
): HostComponentSnippet | undefined => {
  const { componentImport } = deps;
  // The story file's local name is what the import binds, so an aliased import stays consistent
  // between the import statement, the `imports` array and the template.
  const localName = componentNameOf(shape.csf._metaAnnotations.component) ?? snippetMeta.name;
  const ngModules = snippetMeta.standalone ? undefined : storyNgModules(storyDecorators, deps);
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
      standalone: snippetMeta.standalone,
      ngModules,
      outputs: [],
    });
  }
  if (userMarkup === undefined && bindings === undefined) {
    return undefined;
  }
  const template =
    userMarkup?.kind === 'literal'
      ? formatTemplateMarkup(userMarkup.markup)
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
    standalone: snippetMeta.standalone,
    ngModules,
    outputs: boundOutputs,
  });
};

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
