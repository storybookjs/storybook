import { types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type {
  CsfFile,
  ResolvedMembers,
  StoryArgsResolver,
  StoryReferences,
} from 'storybook/internal/csf-tools';
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
  createArgExternalizer,
  evaluateArgExpression,
  evaluateArgLiteral,
} from './story-docs-args.ts';
import type { Bindings, StoryShape, TemplateResult } from './story-docs-markup.ts';
import {
  isBindCall,
  isStoryFactoryCall,
  resolvedMember,
  resolvedProperty,
  sourceOf,
  templateParts,
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
  const { csf } = deps;
  const name = story.name ?? storyNameFromExport(exportName);
  try {
    const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
    const rendered = renderedSnippet(storyShape(exportName, deps), deps);

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
const renderedSnippet = (
  shape: StoryShape,
  deps: StoryDocDeps
): HostComponentSnippet | undefined => {
  const authored = authoredSource(shape);
  if (authored.code !== undefined) {
    return { snippet: authored.code };
  }
  const derived = deps.snippetMeta
    ? renderStorySnippet(deps.snippetMeta, shape, shape.members.properties.decorators, deps)
    : undefined;
  return derived && authored.unreadable !== undefined
    ? withWarnings(derived, unresolvedWarning([authored.unreadable]))
    : derived;
};

/**
 * The code the author published for this story, which always outranks a generated snippet.
 *
 * Reported rather than silently replaced when it is written in a spelling this pass cannot read:
 * overriding an author's own example without saying so is the failure this exists to prevent.
 */
const authoredSource = (shape: StoryShape): { code?: string; unreadable?: string } => {
  for (const members of [shape.members, shape.metaMembers]) {
    const code = memberAt(members, ['parameters', 'docs', 'source', 'code']);
    const value = code && unwrapExpression(code);
    if (value === undefined) {
      continue;
    }
    if (t.isStringLiteral(value)) {
      return { code: value.value };
    }
    const parts = templateParts(value);
    if (parts && parts.expressions.length === 0) {
      return { code: parts.quasis[0] ?? '' };
    }
    return { unreadable: sourceOf(value) };
  }
  return {};
};

/** A nested config value, as far as the path is written out in object literals. */
const memberAt = (members: ResolvedMembers, path: readonly string[]): t.Node | undefined => {
  const [first, ...rest] = path;
  const root = resolvedMember(members, first);
  let node = root.kind === 'value' ? root.node : undefined;
  for (const key of rest) {
    const object = node && unwrapExpression(node);
    if (!object || !t.isObjectExpression(object)) {
      return undefined;
    }
    const property = resolvedProperty(object, key);
    node = property.kind === 'value' ? property.node : undefined;
  }
  return node;
};

const storyShape = (exportName: string, deps: StoryDocDeps): StoryShape => {
  const resolved = deps.resolveStoryArgs.resolve(exportName);
  const enums = deps.snippetMeta?.enums ?? [];
  const unresolved = [...resolved.unresolved];
  unresolved.push(...(opaqueFactoryCall(deps.csf, exportName) ?? []));
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
 * A call the story is built by that this pass cannot see the config of.
 *
 * Only a CSF factory exposes what it was called with; any other call resolves to an empty record
 * indistinguishable from a story that really declares nothing, which is what makes it worth naming.
 */
const opaqueFactoryCall = (csf: CsfFile, exportName: string): string[] | undefined => {
  const declared = csf._storyExports[exportName] ?? csf._storyStatements[exportName];
  const init = t.isVariableDeclarator(declared) ? declared.init : declared;
  const call = init ? unwrapExpression(init) : undefined;
  const readable =
    !call || !t.isCallExpression(call) || isStoryFactoryCall(call) || isBindCall(call);
  return readable ? undefined : [sourceOf(call)];
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
  const ngModules = storyNgModules(storyDecorators, deps);
  const expansion = argsExpansion(snippetMeta, shape);
  // Hidden args would expand `argsToTemplate` into markup that looks complete, so the markup is
  // read without bindings then and falls back with a warning instead.
  const userMarkup = userTemplate(
    shape,
    shape.unresolvedArgs.length === 0 ? expansion.bindings : undefined
  );

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
    const boundOutputs = expansion.outputs.filter((name) =>
      userMarkup.markup.includes(`(${name})=`)
    );
    const hostArgs = referencedArgFields(userMarkup, shape, boundOutputs, snippetMeta.enums);
    return withWarnings(
      host(formatTemplateMarkup(userMarkup.markup), false, boundOutputs, hostArgs.fields),
      unresolvedWarning([
        ...hostArgs.unresolved,
        ...(opaqueFactoryCall(shape.csf, shape.exportName) ?? []),
      ]),
      unboundArgsWarning(localName, snippetMeta, shape)
    );
  }

  const markupSources = userMarkup?.source === undefined ? [] : [userMarkup.source];
  // The outlet form shows no args at all, so naming the args that could not be read would say
  // nothing about what is missing from it.
  return snippetMeta.selector
    ? withWarnings(
        host(
          buildTemplate(snippetMeta.selector, componentBindings(snippetMeta, shape)),
          false,
          snippetMeta.outputs
        ),
        unresolvedWarning([...markupSources, ...shape.unresolvedArgs]),
        unboundArgsWarning(localName, snippetMeta, shape)
      )
    : withWarnings(
        host(buildComponentOutletTemplate(localName), true, []),
        unresolvedWarning(markupSources)
      );
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
  const expressions = expressionText(markup.markup);

  for (const [name, node] of Object.entries(shape.args)) {
    if (taken.has(name) || !isValidIdentifier(name)) {
      continue;
    }
    if (!new RegExp(`\\b${name}\\b`).test(expressions)) {
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

const ATTRIBUTE = /([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
const BINDING_ATTRIBUTE = /^(?:\[|\(|\*|bind-|on-|bindon-)/;
const INTERPOLATION = /\{\{([\s\S]*?)\}\}/g;
const CONTROL_FLOW_BLOCK = /@(?:if|else if|for|switch|case|defer)\b([^{]*)/g;
const LET_DECLARATION = /@let\s+[A-Za-z_$][\w$]*\s*=([^;]*);/g;
const QUOTED = /'[^']*'|"[^"]*"/g;

/**
 * The parts of the markup Angular evaluates as code, with their string literals removed.
 *
 * A plain attribute's value is text, so a name appearing in one is not a reference to anything the
 * host would have to declare.
 */
const expressionText = (markup: string): string => {
  const expressions: string[] = [];
  for (const [, name, doubleQuoted, singleQuoted, bare] of markup.matchAll(ATTRIBUTE)) {
    if (BINDING_ATTRIBUTE.test(name)) {
      expressions.push(doubleQuoted ?? singleQuoted ?? bare ?? '');
    }
  }
  for (const [, expression] of markup.matchAll(INTERPOLATION)) {
    expressions.push(expression);
  }
  for (const [, condition] of markup.matchAll(CONTROL_FLOW_BLOCK)) {
    expressions.push(condition);
  }
  for (const [, value] of markup.matchAll(LET_DECLARATION)) {
    expressions.push(value);
  }
  // Stripped per expression: an unbalanced quote in one would otherwise swallow the next.
  return expressions.map((expression) => expression.replace(QUOTED, '')).join('\n');
};

const withWarnings = (
  rendered: HostComponentSnippet,
  ...parts: (string | undefined)[]
): HostComponentSnippet => {
  const warning = [rendered.warning, ...parts].filter((part) => part !== undefined).join('\n');
  return warning === '' ? rendered : { snippet: rendered.snippet, warning };
};

/** Args the generated element cannot carry, since the component declares no binding for them. */
const unboundArgsWarning = (
  componentName: string,
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape
): string | undefined => {
  const bindable = new Set([...snippetMeta.inputs, ...snippetMeta.outputs]);
  const names = Object.keys(shape.args).filter((name) => !bindable.has(name));
  return names.length === 0
    ? undefined
    : `Incomplete snippet: ${names.map((name) => `\`${name}\``).join(', ')} could not be bound, ` +
        `since ${componentName} declares no such input.`;
};

/** Bindings the generated element carries, which is what the component itself accepts. */
const componentBindings = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape
): Bindings => {
  const inputNames = new Set(snippetMeta.inputs);
  const inputs = Object.entries(shape.args)
    .filter(([argName]) => inputNames.has(argName))
    .map(([argName, node]) => ({
      name: argName,
      expression: evaluateArgExpression(node, snippetMeta.enums),
    }));
  return { inputs, outputs: snippetMeta.outputs };
};

interface ArgsExpansion {
  /** What `argsToTemplate(args)` writes into the markup the story wrote. */
  bindings: Bindings;
  /** Every name that expansion may bind as an output, each of which needs a host handler. */
  outputs: string[];
}

/**
 * What `argsToTemplate(args)` expands to on the component element.
 *
 * Only what the component declares: a snippet that binds anything else does not compile, and the
 * reader cannot tell that from a snippet that does. An arg left out is named in the warning
 * instead. `undefined` is dropped for the reason the runtime helper drops it - binding it would
 * suppress the component's own default.
 */
const argsExpansion = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape
): ArgsExpansion => {
  const { outputs } = snippetMeta;
  const bindableInputs = new Set(snippetMeta.inputs);
  const inputs = Object.entries(shape.args)
    .filter(
      ([name, node]) =>
        bindableInputs.has(name) && !outputs.includes(name) && !isUndefinedValue(node)
    )
    .map(([name, node]) => ({
      name,
      expression: evaluateArgExpression(node, snippetMeta.enums),
    }));
  const handWritten = handWrittenOutputs(shape);
  return {
    bindings: { inputs, outputs: outputs.filter((name) => !handWritten.has(name)) },
    outputs,
  };
};

const isUndefinedValue = (node: t.Node): boolean => {
  const unwrapped = unwrapExpression(node);
  return t.isIdentifier(unwrapped) && unwrapped.name === 'undefined';
};

const OUTPUT_BINDING = /\(([^)\s]+)\)\s*=/g;

const EXPANSION_MARKER = 'sbExpansionSite';

/**
 * Outputs the story wrote by hand on the element the expansion lands in, which it has to leave
 * alone or that element binds them twice.
 *
 * Reading the markup with a marker output locates that element: the same name bound on a wrapper or
 * a sibling belongs to a different element and must not suppress anything. A filter that excludes
 * the marker also excludes the outputs it would guard, so the empty result stays correct.
 */
const handWrittenOutputs = (shape: StoryShape): Set<string> => {
  const marked = userTemplate(shape, { inputs: [], outputs: [EXPANSION_MARKER] });
  const markup = marked?.kind === 'literal' ? marked.markup : '';
  const element = expansionElement(markup);
  return new Set(
    [...element.matchAll(OUTPUT_BINDING)]
      .map(([, name]) => name)
      .filter((name) => name !== EXPANSION_MARKER)
  );
};

const expansionElement = (markup: string): string => {
  const at = markup.indexOf(`(${EXPANSION_MARKER})=`);
  if (at === -1) {
    return '';
  }
  const start = markup.lastIndexOf('<', at);
  const end = markup.indexOf('>', at);
  return markup.slice(start === -1 ? 0 : start, end === -1 ? markup.length : end);
};
