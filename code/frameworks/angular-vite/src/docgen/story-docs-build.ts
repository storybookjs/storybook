import { types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf/csf-utils';
import type { CsfFile, StoryArgsResolver, StoryReferences } from 'storybook/internal/csf-tools';
import {
  buildImportStatements,
  authoredSource,
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
import type { StoryTemplateAnalysis } from './story-docs-template-analysis.ts';
import {
  MARKER_PREFIX,
  type TemplateItem,
  argMarker,
  canMarkSelector,
  elementMarker,
  isMarkerName,
} from '../snippet-markers.ts';
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
      ...(rendered?.template === undefined ? {} : { template: rendered.template }),
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

type RenderedStory = HostComponentSnippet & { template?: string };

// `parameters.docs.source.code` is the example the author chose to publish, so it replaces what
// this pass would derive rather than competing with it.
const renderedSnippet = async (
  shape: StoryShape,
  deps: StoryDocDeps
): Promise<RenderedStory | undefined> => {
  const authoredShape = {
    storyMembers: shape.members,
    members: shape.members,
    metaMembers: shape.metaMembers,
  };
  const authored = authoredSource(authoredShape, deps.resolveStoryArgs.ctx);
  if (authored.kind === 'code') {
    return { snippet: authored.code };
  }
  if (authored.kind === 'disabled' || !deps.snippetMeta) {
    return undefined;
  }
  const derived = await renderStorySnippet(deps.snippetMeta, shape, deps);
  return authored.kind === 'unresolvable'
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
    if (isUnreadValue(value, enums)) {
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

const isUnreadValue = (node: t.Node, enums: AngularComponentSnippetMeta['enums']) =>
  evaluateArgLiteral(node, enums) === undefined && !isSelfContained(node);

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
  deps: StoryDocDeps
): Promise<RenderedStory> => {
  const { componentImport } = deps;
  // The story file's local name is what the import binds, so an aliased import stays consistent
  // between the import statement, the `imports` array and the template.
  const localName = componentNameOf(shape.csf._metaAnnotations.component) ?? snippetMeta.name;
  const ngModules = storyNgModules(shape.members.properties.decorators, deps);
  const expansion = argsExpansion(snippetMeta, shape);
  // The template fills an arg value the static pass could not read from its runtime value, which the
  // preview can only write as data and throws on otherwise, falling back to this snippet. A value
  // already known to be a function or an instance would only ever throw, so it leaves a gap.
  const unreadArgs = new Set(
    Object.keys(shape.args).filter((name) => isUnreadValue(shape.args[name]!, snippetMeta.enums))
  );
  const isUnboundGap = ({ name }: { name: string }) =>
    !(unreadArgs.has(name) && snippetMeta.outputs.includes(name));
  const unwritableArg = [...unreadArgs].some(
    (name) => !snippetMeta.outputs.includes(name) && isCodeValue(shape.args[name]!)
  );
  // The template is filled with whatever the args hold, so it may only name args by marker.
  const markable = [
    ...snippetMeta.inputs,
    ...snippetMeta.outputs,
    ...Object.keys(shape.args),
  ].every(isMarkerName);
  // Hidden args would expand `argsToTemplate` into markup that looks complete, so the markup is
  // read without bindings then and falls back with a warning instead.
  const userMarkup = userTemplate(shape, shape.unresolvedArgs.length === 0 ? expansion : undefined);

  const host = (
    template: string,
    viaComponentOutlet: boolean,
    outputs: string[],
    fields?: { name: string; value: string }[],
    liveOutputs?: ReadonlySet<string>
  ) =>
    buildHostComponentSnippet({
      template,
      componentName: localName,
      componentImport,
      viaComponentOutlet,
      standalone: snippetMeta.standalone,
      ngModules,
      outputs,
      liveOutputs,
      fields,
    });

  if (userMarkup?.kind === 'literal') {
    const { analyzeStoryTemplate, markStoryTemplate } =
      await import('./story-docs-template-analysis.ts');
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
    const built = host(formatTemplateMarkup(analysis.markup), false, boundOutputs, hostArgs.fields);
    const unknownReferences = unknownTemplateReferencesWarning(
      referencedNames,
      shape,
      boundOutputs
    );
    const unbound = unboundArgs(snippetMeta, shape, [
      ...userMarkup.representedArgs,
      ...referencedNames,
    ]);
    const rendered = withWarnings(
      built,
      unresolvedWarning([
        ...shape.metaMembers.unresolved,
        ...shape.members.unresolved,
        ...hostArgs.unresolved,
      ]),
      templateAnalysisWarning(analysis),
      unknownReferences,
      unboundArgsWarning(localName, unbound)
    );
    const gap =
      built.warning !== undefined ||
      shape.metaMembers.unresolved.length > 0 ||
      shape.members.unresolved.length > 0 ||
      unknownReferences !== undefined ||
      unwritableArg ||
      unbound.some(isUnboundGap);
    return withTemplate(rendered, gap, () => {
      // Self-contained code the story wrote stays as written; data is filled from the controls.
      const fields = hostArgs.names.map((name) => {
        const node = shape.args[name]!;
        return isCodeValue(node) && isSelfContained(node)
          ? { name, value: argFieldValue(node) }
          : { name, value: argMarker(name) };
      });
      const readsArgs =
        userMarkup.expansions.length > 0 || userMarkup.argTexts.size > 0 || fields.length > 0;
      if (!markable || !readsArgs || analysis.kind !== 'resolved') {
        return undefined;
      }
      const marked = markStoryTemplate(
        userMarkup,
        { inputs: orderedInputs(snippetMeta, shape), outputs: snippetMeta.outputs },
        analysis
      );
      if (marked === undefined) {
        return undefined;
      }
      const outputs = snippetMeta.outputs.filter(
        (name) => boundOutputs.includes(name) || marked.liveOutputs.has(name)
      );
      return host(marked.markup, false, outputs, fields, marked.liveOutputs).snippet;
    });
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

  const { inputs, fields } = componentBindings(snippetMeta, shape);
  const built = host(
    buildTemplate(snippetMeta.selector, {
      inputs,
      outputs: snippetMeta.outputs,
      selfClosing: true,
    }),
    false,
    snippetMeta.outputs,
    fields
  );
  const unbound = unboundArgs(snippetMeta, shape);
  const rendered = withWarnings(
    built,
    unresolvedWarning([...markupSources, ...shape.unresolvedArgs]),
    unboundArgsWarning(localName, unbound)
  );
  const gap =
    built.warning !== undefined ||
    markupSources.length > 0 ||
    unwritableArg ||
    unbound.some(isUnboundGap);
  const selector = snippetMeta.selector;
  return withTemplate(rendered, gap, () => {
    if (!markable || !canMarkSelector(selector) || snippetMeta.inputs.length === 0) {
      return undefined;
    }
    // An arg the static snippet keeps in a host field stays there when its value is code. Computed
    // data is filled from the controls like any other input.
    const codeFields = fields.filter(({ name }) => isCodeValue(shape.args[name]!));
    const fieldArgs = new Set(codeFields.map(({ name }) => name));
    const items: TemplateItem[] = [
      ...orderedInputs(snippetMeta, shape).map((name) => ({
        kind: fieldArgs.has(name) ? ('field' as const) : ('input' as const),
        name,
      })),
      ...snippetMeta.outputs.map((name) => ({ kind: 'output' as const, name })),
    ];
    return host(elementMarker(selector, items), false, snippetMeta.outputs, codeFields).snippet;
  });
};

// The inputs a live snippet may bind: the story's own in the order its args write them, which is
// the order the static snippet binds them in, then the rest in docgen order.
const orderedInputs = (snippetMeta: AngularComponentSnippetMeta, shape: StoryShape) => {
  const inputNames = new Set(snippetMeta.inputs);
  const storyInputs = Object.keys(shape.args).filter((name) => inputNames.has(name));
  return [...new Set([...storyInputs, ...snippetMeta.inputs])];
};

const referencedArgFields = (
  referencedNames: ReadonlySet<string>,
  representedArgs: readonly string[],
  shape: StoryShape,
  boundOutputs: readonly string[],
  enums: AngularComponentSnippetMeta['enums']
): { names: string[]; fields: { name: string; value: string }[]; unresolved: string[] } => {
  const taken = new Set([...representedArgs, ...boundOutputs]);
  const names: string[] = [];
  const fields: { name: string; value: string }[] = [];
  const unresolved: string[] = [];

  for (const [name, node] of Object.entries(shape.args)) {
    if (taken.has(name)) {
      continue;
    }
    if (!referencedNames.has(name)) {
      continue;
    }
    names.push(name);
    const value = evaluateArgLiteral(node, enums);
    if (value === undefined) {
      unresolved.push(sourceOf(node));
      continue;
    }
    fields.push({ name, value });
  }

  return { names, fields, unresolved };
};

const withWarnings = (rendered: RenderedStory, ...parts: (string | undefined)[]): RenderedStory => {
  const warning = [...new Set([rendered.warning, ...parts])]
    .filter((part) => part !== undefined)
    .join('\n');
  return warning === '' ? rendered : { snippet: rendered.snippet, warning };
};

// The template is only built when the snippet has no gap that filling in the args would not close,
// and only kept when no text in the snippet already reads as a marker. A warning about an arg value
// the static pass could not read is no such gap: the preview fills the value in or throws.
const withTemplate = (
  rendered: RenderedStory,
  gap: boolean,
  template: () => string | undefined
): RenderedStory => {
  if (gap) {
    return rendered;
  }
  const built = template();
  return built === undefined || rendered.snippet.includes(MARKER_PREFIX)
    ? rendered
    : { ...rendered, template: built };
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

const unboundArgs = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  representedArgs?: readonly string[]
): { name: string; kind: 'input' | 'output' }[] => {
  const represented = new Set(representedArgs);
  const inputNames = new Set(snippetMeta.inputs);
  const outputNames = new Set(snippetMeta.outputs);
  return Object.entries(shape.args)
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
};

const unboundArgsWarning = (
  componentName: string,
  unbound: readonly { name: string; kind: 'input' | 'output' }[]
): string | undefined => {
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
): { inputs: Bindings['inputs']; fields: { name: string; value: string }[] } => {
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
  return { inputs, fields };
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

// A value that is code rather than data, which no template binding can write.
const isCodeValue = (node: t.Node): boolean => {
  const unwrapped = unwrapExpression(node);
  return t.isFunction(unwrapped) || t.isClass(unwrapped) || t.isNewExpression(unwrapped);
};

const isUndefinedValue = (node: t.Node): boolean => {
  const unwrapped = unwrapExpression(node);
  return (
    (t.isIdentifier(unwrapped) && unwrapped.name === 'undefined') ||
    t.isUnaryExpression(unwrapped, { operator: 'void' })
  );
};
