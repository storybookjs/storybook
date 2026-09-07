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
  unwrapExpression,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { resolve } from 'node:path';

import type { AngularComponentSnippetMeta, AngularDocgenPayload } from './build-docgen.ts';
import { parseStoryFile } from './resolve-component.ts';
import {
  argFieldValue,
  createArgExternalizer,
  evaluateArgExpression,
  evaluateArgLiteral,
} from './story-docs-args.ts';
import type { Bindings, StoryShape } from './story-docs-markup.ts';
import { sourceOf, userTemplate } from './story-docs-markup.ts';
import type { StoryNgModules } from './story-docs-ng-modules.ts';
import { ngModulesFromDecorators, storyNgModules } from './story-docs-ng-modules.ts';
import type { HostComponentSnippet } from './story-docs-snippet.ts';
import { buildHostComponentSnippet } from './story-docs-snippet.ts';
import { authoredSource } from './story-docs-source.ts';
import type { StoryTemplateAnalysis } from './story-docs-template-analysis.ts';
import {
  buildComponentOutletTemplate,
  buildTemplate,
  formatPropInTemplate,
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

  const stories = Object.fromEntries(
    await Promise.all(
      Object.entries(csf._stories).map(
        async ([exportName, story]) =>
          [story.id, await buildStoryDoc(exportName, story, deps)] as const
      )
    )
  );

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

const buildStoryDoc = async (
  exportName: string,
  story: CsfFile['_stories'][string],
  deps: StoryDocDeps
): Promise<StoryDoc> => {
  const { csf } = deps;
  const name = story.name ?? storyNameFromExport(exportName);
  try {
    const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
    const rendered = await renderedSnippet(storyShape(exportName, deps), deps);

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

// `parameters.docs.source.code` is the example the author chose to publish, so it replaces what
// this pass would derive rather than competing with it.
const renderedSnippet = async (
  shape: StoryShape,
  deps: StoryDocDeps
): Promise<HostComponentSnippet | undefined> => {
  const authored = authoredSource(shape, deps.resolveStoryArgs.ctx);
  if (authored.kind === 'code') {
    return { snippet: authored.code };
  }
  if (authored.kind === 'disabled') {
    return undefined;
  }
  const derived = deps.snippetMeta
    ? await renderStorySnippet(deps.snippetMeta, shape, shape.members.properties.decorators, deps)
    : undefined;
  return derived && authored.kind === 'unresolvable'
    ? withWarnings(derived, unresolvedWarning([authored.source]))
    : derived;
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
const renderStorySnippet = async (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  storyDecorators: t.Node | undefined,
  deps: StoryDocDeps
): Promise<HostComponentSnippet> => {
  const { componentImport } = deps;
  // The story file's local name is what the import binds, so an aliased import stays consistent
  // between the import statement, the `imports` array and the template.
  const localName = componentNameOf(shape.csf._metaAnnotations.component) ?? snippetMeta.name;
  const ngModules = storyNgModules(storyDecorators, deps);
  const expansion = argsExpansion(snippetMeta, shape);
  // Hidden args would expand `argsToTemplate` into markup that looks complete, so the markup is
  // read without bindings then and falls back with a warning instead.
  const userMarkup = userTemplate(shape, shape.unresolvedArgs.length === 0 ? expansion : undefined);

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
    const { analyzeStoryTemplate } = await import('./story-docs-template-analysis.ts');
    const analysis = analyzeStoryTemplate(userMarkup.markup, userMarkup.expansions);
    const referencedNames = new Set(analysis.kind === 'resolved' ? analysis.referencedNames : []);
    const boundOutputs =
      analysis.kind === 'resolved'
        ? snippetMeta.outputs.filter((name) => analysis.boundOutputs.includes(name))
        : [];
    const hostArgs = referencedArgFields(
      referencedNames,
      userMarkup.representedArgs,
      shape,
      boundOutputs,
      snippetMeta.enums
    );
    return withWarnings(
      host(formatTemplateMarkup(analysis.markup), false, boundOutputs, hostArgs.fields),
      unresolvedWarning([
        ...shape.metaMembers.unresolved,
        ...shape.members.unresolved,
        ...hostArgs.unresolved,
      ]),
      templateAnalysisWarning(analysis),
      unknownTemplateReferencesWarning(referencedNames, shape, boundOutputs),
      unboundArgsWarning(localName, snippetMeta, shape, [
        ...userMarkup.representedArgs,
        ...referencedNames,
      ])
    );
  }

  const markupSources = userMarkup?.source === undefined ? [] : [userMarkup.source];
  // The outlet form shows no args at all, so naming the args that could not be read would say
  // nothing about what is missing from it.
  if (!snippetMeta.selector) {
    return withWarnings(
      host(buildComponentOutletTemplate(localName, { selfClosing: true }), true, []),
      unresolvedWarning(markupSources)
    );
  }

  const { bindings, fields } = componentBindings(snippetMeta, shape);
  return withWarnings(
    host(
      buildTemplate(snippetMeta.selector, { ...bindings, selfClosing: true }),
      false,
      snippetMeta.outputs,
      fields
    ),
    unresolvedWarning([...markupSources, ...shape.unresolvedArgs]),
    unboundArgsWarning(localName, snippetMeta, shape)
  );
};

const referencedArgFields = (
  referencedNames: ReadonlySet<string>,
  representedArgs: readonly string[],
  shape: StoryShape,
  boundOutputs: readonly string[],
  enums: AngularComponentSnippetMeta['enums']
): { fields: { name: string; value: string }[]; unresolved: string[] } => {
  const taken = new Set([...representedArgs, ...boundOutputs]);
  const fields: { name: string; value: string }[] = [];
  const unresolved: string[] = [];

  for (const [name, node] of Object.entries(shape.args)) {
    if (taken.has(name)) {
      continue;
    }
    if (!referencedNames.has(name)) {
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

const withWarnings = (
  rendered: HostComponentSnippet,
  ...parts: (string | undefined)[]
): HostComponentSnippet => {
  const warning = [...new Set([rendered.warning, ...parts])]
    .filter((part) => part !== undefined)
    .join('\n');
  return warning === '' ? rendered : { snippet: rendered.snippet, warning };
};

const templateAnalysisWarning = (analysis: StoryTemplateAnalysis): string | undefined =>
  analysis.kind === 'resolved'
    ? undefined
    : `Incomplete snippet: the story template could not be analyzed statically. ${analysis.errors.join('\n')}`;

const unknownTemplateReferencesWarning = (
  referencedNames: ReadonlySet<string>,
  shape: StoryShape,
  outputHandlers: readonly string[]
): string | undefined => {
  const provided = new Set([...Object.keys(shape.args), ...outputHandlers]);
  const names = [...referencedNames].filter((name) => !provided.has(name));
  return names.length === 0
    ? undefined
    : `Incomplete snippet: ${names.map((name) => `\`${name}\``).join(', ')} could not be provided, ` +
        `since the story declares no such arg.`;
};

const unboundArgsWarning = (
  componentName: string,
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  representedArgs?: readonly string[]
): string | undefined => {
  const represented = new Set(representedArgs);
  const inputNames = new Set(snippetMeta.inputs);
  const outputNames = new Set(snippetMeta.outputs);
  const unbound = Object.entries(shape.args)
    .filter(([name, node]) => {
      if (represented.has(name) || isUndefinedValue(node)) {
        return false;
      }
      if (representedArgs === undefined) {
        return !inputNames.has(name) && !outputNames.has(name);
      }
      return isFunctionValue(node) ? !outputNames.has(name) : !inputNames.has(name);
    })
    .map(([name, node]) => ({ name, kind: isFunctionValue(node) ? 'output' : 'input' }));
  if (unbound.length === 0) {
    return undefined;
  }
  const kinds = new Set(unbound.map(({ kind }) => kind));
  const reason =
    kinds.size === 1
      ? `declares no such ${unbound[0]!.kind}`
      : 'declares no compatible input or output';
  return (
    `Incomplete snippet: ${unbound.map(({ name }) => `\`${name}\``).join(', ')} could not be bound, ` +
    `since ${componentName} ${reason}.`
  );
};

const componentBindings = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape
): { bindings: Bindings; fields: { name: string; value: string }[] } => {
  const inputNames = new Set(snippetMeta.inputs);
  const inputs: Bindings['inputs'] = [];
  const fields: { name: string; value: string }[] = [];
  for (const [name, node] of Object.entries(shape.args)) {
    if (!inputNames.has(name)) {
      continue;
    }
    if (evaluateArgLiteral(node, snippetMeta.enums) === undefined && isSelfContained(node)) {
      fields.push({ name, value: argFieldValue(node) });
      inputs.push({ name, expression: formatPropInTemplate(name) });
      continue;
    }
    inputs.push({ name, expression: evaluateArgExpression(node, snippetMeta.enums) });
  }
  return { bindings: { inputs, outputs: snippetMeta.outputs }, fields };
};

const argsExpansion = (snippetMeta: AngularComponentSnippetMeta, shape: StoryShape): Bindings => {
  const inputNames = new Set(snippetMeta.inputs);
  const outputNames = new Set(snippetMeta.outputs);
  const inputs: Bindings['inputs'] = [];
  const outputs: string[] = [];
  for (const [name, node] of Object.entries(shape.args)) {
    if (isUndefinedValue(node)) {
      continue;
    }
    if (isFunctionValue(node)) {
      if (outputNames.has(name)) {
        outputs.push(name);
      }
    } else if (inputNames.has(name)) {
      inputs.push({ name, expression: evaluateArgExpression(node, snippetMeta.enums) });
    }
  }
  return { inputs, outputs };
};

const isFunctionValue = (node: t.Node): boolean => {
  const unwrapped = unwrapExpression(node);
  return t.isFunction(unwrapped);
};

const isUndefinedValue = (node: t.Node): boolean => {
  const unwrapped = unwrapExpression(node);
  return (
    (t.isIdentifier(unwrapped) && unwrapped.name === 'undefined') ||
    t.isUnaryExpression(unwrapped, { operator: 'void' })
  );
};
