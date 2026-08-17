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
  deepAssignmentSources,
  evaluateArgExpression,
  evaluateArgLiteral,
} from './story-docs-args.ts';
import type { Bindings, StoryShape, TemplateResult } from './story-docs-markup.ts';
import {
  metaConfigObject,
  sourceOf,
  storyConfigObject,
  unresolvableConfigMembers,
  userTemplate,
} from './story-docs-markup.ts';
import type { StoryNgModules } from './story-docs-ng-modules.ts';
import { ngModulesFromDecorators, storyNgModules } from './story-docs-ng-modules.ts';
import type { HostComponentSnippet } from './story-docs-snippet.ts';
import { buildHostComponentSnippet } from './story-docs-snippet.ts';
import {
  buildComponentOutletTemplate,
  buildTemplate,
  formatTemplateMarkup,
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
  const csf = parseStoryFile(storyFilePath, input.entry.title);
  if (!csf) {
    return undefined;
  }

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
      unresolvedArgs: [
        ...deps.metaArgs.unresolved,
        ...unresolvableConfigMembers(metaConfigObject(csf)),
        ...storyArgs.unresolved,
        ...unresolvableConfigMembers(storyConfigObject({ csf, exportName })),
        ...deepAssignmentSources(csf, exportName),
      ],
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

  const host = (
    template: string,
    viaComponentOutlet: boolean,
    outputs: string[],
    fields?: { name: string; value: string }[]
  ) =>
    buildHostComponentSnippet({
      template,
      componentName: localName,
      componentImport,
      viaComponentOutlet,
      standalone: snippetMeta.standalone,
      ngModules,
      outputs,
      fields,
    });

  if (userMarkup?.kind === 'literal') {
    // The markup is shown exactly as it was written, so the host has to supply what the story
    // supplied: handlers for the outputs it binds, and the args it reaches for by name.
    const boundOutputs = snippetMeta.outputs.filter((name) =>
      userMarkup.markup.includes(`(${name})=`)
    );
    const hostArgs = referencedArgFields(userMarkup, shape, boundOutputs, snippetMeta.enums);
    return withUnresolved(
      host(formatTemplateMarkup(userMarkup.markup), false, boundOutputs, hostArgs.fields),
      hostArgs.unresolved
    );
  }

  const markupSources = userMarkup?.source === undefined ? [] : [userMarkup.source];
  // The outlet form shows no args at all, so naming the args that could not be read would say
  // nothing about what is missing from it.
  return snippetMeta.selector
    ? withUnresolved(
        host(buildTemplate(snippetMeta.selector, bindings), false, snippetMeta.outputs),
        [...markupSources, ...shape.unresolvedArgs]
      )
    : withUnresolved(host(buildComponentOutletTemplate(localName), true, []), markupSources);
};

/**
 * Args the story's own markup binds by name, as host members holding the value the story gave them.
 */
const referencedArgFields = (
  markup: Extract<TemplateResult, { kind: 'literal' }>,
  shape: StoryShape,
  boundOutputs: readonly string[],
  enums: AngularComponentSnippetMeta['enums']
): { fields: { name: string; value: string }[]; unresolved: string[] } => {
  // An output already contributes a handler under the same name, and a class cannot hold both.
  const taken = new Set([...markup.expandedArgs, ...boundOutputs]);
  const fields: { name: string; value: string }[] = [];
  const unresolved: string[] = [];

  for (const [name, node] of Object.entries(shape.args)) {
    if (taken.has(name) || !isValidIdentifier(name)) {
      continue;
    }
    if (!new RegExp(`\\b${name}\\b`).test(markup.markup)) {
      continue;
    }
    const value = evaluateArgLiteral(node, enums);
    if (value === undefined) {
      unresolved.push(sourceOf(node));
      continue;
    }
    fields.push({ name, value });
  }

  return { fields, unresolved };
};

/** Says which source text a static pass could not read, so a reader can see what is missing. */
const unresolvedWarning = (unresolved: readonly string[]): string =>
  `Incomplete snippet: ${[...new Set(unresolved)]
    .map((source) => `\`${source}\``)
    .join(', ')} could not be resolved statically.`;

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

const collectBindings = (snippetMeta: AngularComponentSnippetMeta, shape: StoryShape): Bindings => {
  const inputNames = new Set(snippetMeta.inputs);
  const inputs = Object.entries(shape.args)
    .filter(([argName]) => inputNames.has(argName))
    .map(([argName, node]) => ({
      name: argName,
      expression: evaluateArgExpression(node, snippetMeta.enums),
    }));
  return { inputs, outputs: snippetMeta.outputs };
};
