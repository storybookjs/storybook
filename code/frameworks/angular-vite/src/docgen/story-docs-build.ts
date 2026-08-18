import { types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile, StoryArgsResolver, StoryReferences } from 'storybook/internal/csf-tools';
import {
  buildImportStatements,
  collectImportBindings,
  createStoryArgsResolver,
  createStoryReferenceResolver,
  extractStoryJSDocInfo,
  isSelfContained,
  parseReferenceModule,
  resolveComponentImport,
  unresolvedWarning,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { resolve } from 'node:path';

import type { AngularComponentSnippetMeta, AngularDocgenPayload } from './build-docgen.ts';
import { parseStoryFile } from './resolve-component.ts';
import {
  createArgExternalizer,
  evaluateArgExpression,
  evaluateArgLiteral,
} from './story-docs-args.ts';
import type { Bindings, StoryShape, TemplateResult } from './story-docs-markup.ts';
import { sourceOf, userTemplate } from './story-docs-markup.ts';
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

  const enums = docgenPayload?.angularComponentMeta?.enums ?? [];
  const { resolveImport } = context;
  const references: StoryReferences = {
    filePath: storyFilePath,
    externalize: createArgExternalizer(enums),
    resolveModule: resolveImport
      ? (fromFile, specifier) => {
          const target = resolveImport(fromFile, specifier);
          return target === undefined ? undefined : parseReferenceModule(target);
        }
      : openStoryReferences().resolveModule,
  };

  const componentName = componentNameOf(componentNode);
  const importBindings = collectImportBindings(csf._file.path);
  const deps: StoryDocDeps = {
    csf,
    resolveStoryArgs: createStoryArgsResolver(csf, references),
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
  /** Resolves each story's args, following a spread or a name out of the story file. */
  resolveStoryArgs: StoryArgsResolver;
  snippetMeta: AngularComponentSnippetMeta | undefined;
  componentName: string | undefined;
  componentImport: string | undefined;
  metaNgModules: StoryNgModules;
  importBindings: ReturnType<typeof collectImportBindings>;
}

// One instance per process, so the module-resolution cache is shared; each build opens its own.
const openStoryReferences = createStoryReferenceResolver();

const buildStoryDoc = (
  exportName: string,
  story: CsfFile['_stories'][string],
  deps: StoryDocDeps
): StoryDoc => {
  const { csf, snippetMeta } = deps;
  const name = story.name ?? storyNameFromExport(exportName);
  try {
    const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
    const shape = storyShape(exportName, deps);
    const rendered = snippetMeta
      ? renderStorySnippet(snippetMeta, shape, shape.members.properties.decorators, deps)
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

const storyShape = (exportName: string, deps: StoryDocDeps): StoryShape => {
  const resolved = deps.resolveStoryArgs.resolve(exportName);
  const enums = deps.snippetMeta?.enums ?? [];
  const unresolved = [...resolved.unresolved];
  for (const value of Object.values(resolved.args)) {
    // An arg that still carries a name has to be reported: an Angular binding is evaluated against
    // the host component the snippet ships, so a name that component does not have reads as
    // `undefined` there rather than failing to compile. An enum member still resolves, and an
    // expression that only names what it declares itself - a handler's own parameters - needs
    // nothing from the host.
    if (evaluateArgLiteral(value, enums) === undefined && !isSelfContained(value)) {
      unresolved.push(sourceOf(value));
    }
  }

  return {
    csf: deps.csf,
    exportName,
    members: resolved.storyMembers,
    metaMembers: resolved.metaMembers,
    args: resolved.args,
    unresolvedArgs: unresolved,
  };
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
