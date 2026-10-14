import { types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf/csf-utils';
import type { CsfFile, StoryArgsResolver, StoryReferences } from 'storybook/internal/csf-tools';
import {
  argCode,
  buildImportStatements,
  authoredSource,
  collectImportBindings,
  createStoryArgsResolver,
  createStoryReferenceResolver,
  extractStoryJSDocInfo,
  fillStoryTemplate,
  isSelfContained,
  parseReferenceModule,
  resolveComponentImport,
  unresolvedWarning,
  unwrapExpression,
} from 'storybook/internal/csf-tools';
import {
  defaultWord,
  fillHoles,
  hasHoleBracket,
  hole,
  holeWord,
  writtenArg,
} from 'storybook/internal/docs-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { resolve } from 'node:path';

import { fillTemplate } from '../client/docs/fill-template.ts';
import type { AngularComponentSnippetMeta, AngularDocgenPayload } from './build-docgen.ts';
import { parseStoryFile } from './resolve-component.ts';
import {
  argFieldValue,
  createArgExternalizer,
  evaluateArgExpression,
  evaluateArgLiteral,
  writtenValue,
} from './story-docs-args.ts';
import type { Bindings, RenderedProps, StoryShape } from './story-docs-markup.ts';
import { renderedProps, sourceOf, userTemplate } from './story-docs-markup.ts';
import type { StoryNgModules } from './story-docs-ng-modules.ts';
import { ngModulesFromDecorators, storyNgModules } from './story-docs-ng-modules.ts';
import type { PropCode } from './story-docs-prop-code.ts';
import type { HostComponentSnippet } from './story-docs-snippet.ts';
import { buildHostComponentSnippet } from './story-docs-snippet.ts';
import type { StoryTemplateAnalysis } from './story-docs-template-analysis.ts';
import {
  BINDS_UNDEFINED,
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
    const shape = storyShape(exportName, deps);
    const rendered = await renderedSnippet(shape, deps);

    return {
      id: story.id,
      name,
      ...(rendered === undefined ? {} : { snippet: rendered.snippet }),
      ...(rendered?.warning === undefined ? {} : { warning: rendered.warning }),
      ...(rendered?.template === undefined
        ? {}
        : { template: rendered.template, argCode: rendered.argCode }),
      ...(rendered?.templateWarning === undefined
        ? {}
        : { templateWarning: rendered.templateWarning }),
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
// this pass would derive rather than competing with it. No arg changes it, so it is its own template.
const renderedSnippet = async (
  shape: StoryShape,
  deps: StoryDocDeps
): Promise<HostComponentSnippet | undefined> => {
  const authoredShape = {
    storyMembers: shape.members,
    members: shape.members,
    metaMembers: shape.metaMembers,
  };
  const authored = authoredSource(authoredShape, deps.resolveStoryArgs.ctx);
  if (authored.kind === 'code') {
    return hasHoleBracket(authored.code)
      ? { snippet: authored.code }
      : { snippet: authored.code, template: authored.code, argCode: {} };
  }
  if (authored.kind === 'disabled') {
    return undefined;
  }
  const derived = deps.snippetMeta
    ? await renderStorySnippet(deps.snippetMeta, shape, shape.members.properties.decorators, deps)
    : undefined;
  if (!derived || authored.kind !== 'unresolvable') {
    return derived;
  }
  const unresolved = unresolvedWarning([authored.source]);
  return {
    ...withWarnings(derived, unresolved),
    ...(derived.template === undefined
      ? {}
      : { templateWarning: joinWarnings(derived.templateWarning, unresolved) }),
  };
};

// An arg that still carries a name has to be reported: an Angular binding is evaluated against the
// host component the snippet ships, so a name that component does not have reads as `undefined`
// there rather than failing to compile. An enum member still resolves, and an expression that only
// names what it declares itself - a handler's own parameters - needs nothing from the host.
const isUnread = (node: t.Node, enums: AngularComponentSnippetMeta['enums']) =>
  evaluateArgLiteral(node, enums) === undefined && !isSelfContained(node);

const storyShape = (exportName: string, deps: StoryDocDeps): StoryShape => {
  const resolved = deps.resolveStoryArgs.resolve(exportName);
  const enums = deps.snippetMeta?.enums ?? [];
  const unresolved = [...resolved.unresolved];
  for (const value of Object.values(resolved.args)) {
    if (isUnread(value, enums)) {
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
    hidingArgs: [...resolved.unresolved],
  };
};

/**
 * Snippets show the markup a story supplies itself - through `template`, a `render` that returns
 * one, or the CSF2 function form - as written. Markup or args that cannot be read without running
 * the story fall back to the component-derived bindings: a snippet that fell back is still useful,
 * but silently shipping it would leave a consumer no way to know its example is partial, so the
 * story carries a `warning` naming the source text this pass could not read.
 *
 * Each is printed once, as a template with a hole wherever it prints an arg, and the static snippet
 * is that template filled with the story's args; see {@link withTemplate}.
 */
const renderStorySnippet = async (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  storyDecorators: t.Node | undefined,
  deps: StoryDocDeps
): Promise<HostComponentSnippet> => {
  const { componentImport } = deps;
  const { enums } = snippetMeta;
  // The story file's local name is what the import binds, so an aliased import stays consistent
  // between the import statement, the `imports` array and the template.
  const localName = componentNameOf(shape.csf._metaAnnotations.component) ?? snippetMeta.name;
  const ngModules = storyNgModules(storyDecorators, deps);
  const expansion = argsExpansion(snippetMeta, shape);
  // Hidden args would expand `argsToTemplate` into markup that looks complete, so the markup is
  // read without bindings then and falls back with a warning instead.
  const userMarkup = userTemplate(shape, shape.unresolvedArgs.length === 0 ? expansion : undefined);
  const args = writtenArgs(shape, enums);

  const host = (
    template: string,
    viaComponentOutlet: boolean,
    outputs: string[],
    fields?: HostField[]
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
      imports: buildImportStatements({
        refs: [...new Set(fields?.flatMap(({ computed }) => computed?.imports ?? []))].map((name) =>
          resolveComponentImport(name, deps.importBindings)
        ),
      }),
    });

  const props = renderedProps(shape);

  if (userMarkup?.kind === 'literal') {
    const { analyzeStoryTemplate } = await import('./story-docs-template-analysis.ts');
    const { expansions, texts } = userMarkup;
    const analysis = analyzeStoryTemplate(userMarkup.markup, expansions);
    const referencedNames = new Set(analysis.kind === 'resolved' ? analysis.referencedNames : []);
    const boundOutputs =
      analysis.kind === 'resolved'
        ? snippetMeta.outputs.filter((name) => analysis.boundOutputs.includes(name))
        : [];
    const hostArgs = referencedArgFields(referencedNames, shape, boundOutputs, enums, props);
    // A name the markup calls holds a function, which no control sets.
    const notRead = new Set([
      ...boundOutputs,
      ...(analysis.kind === 'resolved' ? analysis.calledNames : []),
    ]);
    const declared = new Set(hostArgs.fields.map(({ name }) => name));
    // A name the props hold an arg under that no field declares reads that arg, which the story
    // leaves unset.
    const unset = [...referencedNames].flatMap((name): HostField[] => {
      const arg =
        notRead.has(name) || declared.has(name) || !props ? undefined : heldArg(props, name);
      const written = arg === undefined ? undefined : shape.args[arg];
      return arg === undefined || (written && isFunctionValue(written))
        ? []
        : [{ name, value: 'undefined', arg }];
    });
    const unbound = unboundArgsWarning(
      localName,
      snippetMeta,
      shape,
      [
        ...userMarkup.representedArgs,
        ...referencedNames,
        ...[...referencedNames].flatMap((name) => props?.(name)?.arg ?? []),
      ],
      computedArgs(hostArgs.fields)
    );
    const warnings = [
      unresolvedWarning([
        ...shape.metaMembers.unresolved,
        ...shape.members.unresolved,
        ...hostArgs.unresolved.map(({ source }) => source),
      ]),
      templateAnalysisWarning(analysis),
      // An unset arg reads `undefined`, as the field prints, unless args the story hides set it.
      unknownTemplateReferencesWarning(referencedNames, [
        ...hostArgs.provided,
        ...boundOutputs,
        ...(shape.unresolvedArgs.length === 0 ? unset.map(({ name }) => name) : []),
      ]),
      unbound,
    ];
    // `argsToTemplate` binds the inputs among the args that hold no function, as `argsExpansion`
    // does.
    const expanded = (allows: (name: string) => boolean) =>
      inArgsOrder(snippetMeta.inputs, shape)
        .filter((name) => {
          const node = shape.args[name];
          return allows(name) && !(node && isFunctionValue(node));
        })
        .map(holeWord);
    // Each expansion stands in for its own marker, and each interpolated arg for its own, until the
    // markup is formatted, laid out as the bindings or the text the snippet gives it, then for a
    // hole.
    const marked = expansions.map((e) => ({ ...e, inputAttributes: [e.marker] }));
    let markup = formatTemplateMarkup(
      analyzeStoryTemplate(userMarkup.markedMarkup, marked).markup,
      new Map<string, readonly string[]>([
        ...expansions.map((e) => [e.marker, e.inputAttributes] as const),
        ...texts.map(({ marker, text }) => [marker, [text]] as const),
      ])
    );
    for (const { marker, allows } of expansions) {
      markup = markup.replace(new RegExp(`${marker}(?![\\w-])`), () =>
        hole('props', ...expanded(allows))
      );
    }
    for (const { marker, arg } of texts) {
      markup = markup.replace(marker, () => hole('text', holeWord(arg)));
    }
    const fields = [...hostArgs.fields, ...unset].map((field) =>
      notRead.has(field.name) ? field : holeField(field, props, enums)
    );
    return withTemplate(args, host(markup, false, boundOutputs, fields), warnings, warnings);
  }

  const markupSources = userMarkup?.source === undefined ? [] : [userMarkup.source];
  const { selector } = snippetMeta;
  // The story renders an element-less component through an outlet that passes it no inputs, so
  // naming the args that could not be read would say nothing about what is missing from it.
  if (!selector) {
    const warnings = [unresolvedWarning(markupSources)];
    return withTemplate(
      args,
      host(buildComponentOutletTemplate(localName, { selfClosing: true }), true, []),
      warnings,
      warnings
    );
  }

  const { inputs, holeInputs, fields, unresolved } = componentBindings(snippetMeta, shape, props);
  const fieldArgs = fields.flatMap(({ arg, computed }) => computed?.args ?? arg ?? []);
  const unbound = unboundArgsWarning(localName, snippetMeta, shape, undefined, fieldArgs);
  // A hole prints an arg value this pass could not read as written, until a control changes it;
  // args it could not see may still be bound to nothing.
  const unread = [...new Set([...holeInputs, ...fieldArgs])].flatMap((name) => {
    const node = shape.args[name];
    return node && isUnread(node, enums) ? [sourceOf(node)] : [];
  });
  const markup = buildTemplate(selector, {
    inputs,
    outputs: snippetMeta.outputs,
    selfClosing: true,
    hole: {
      text: hole('props', BINDS_UNDEFINED, ...holeInputs.map(holeWord)),
      standsFor: holeInputs.flatMap((name) =>
        name in shape.args ? [`[${name}]="${evaluateArgExpression(shape.args[name]!, enums)}"`] : []
      ),
    },
  });
  return withTemplate(
    args,
    host(markup, false, snippetMeta.outputs, fields),
    [unresolvedWarning([...markupSources, ...shape.unresolvedArgs, ...unresolved]), unbound],
    [unresolvedWarning([...markupSources, ...shape.hidingArgs, ...unread, ...unresolved]), unbound]
  );
};

/**
 * The static snippet is the template filled with the args the story is written with, as the preview
 * fills it while no control has changed them, with those of the warnings the args it is filled with
 * do not answer as the template's. A template whose own code holds a hole bracket is none, as its
 * holes could not be found again; its snippet is still filled, reading that bracket as a hole.
 */
const withTemplate = (
  args: Record<string, t.Node>,
  template: HostComponentSnippet,
  warnings: (string | undefined)[],
  templateWarnings: (string | undefined)[]
): HostComponentSnippet => {
  const read = holeArgs(template.snippet);
  const { warning } = withWarnings(template, ...warnings);
  const { warning: templateWarning } = withWarnings(template, ...templateWarnings);
  const filled = read && fillStoryTemplate(template.snippet, args, fillTemplate);
  const code = argCode(args);
  return {
    // An arg too long for the filler to print still prints as the code the story writes it with.
    snippet: filled ? filled.snippet : fillTemplate(template.snippet, writtenCode(args, code)),
    ...(warning === undefined ? {} : { warning }),
    ...(read && {
      template: template.snippet,
      argCode: Object.fromEntries(Object.entries(code).filter(([name]) => read.has(name))),
      ...(templateWarning === undefined ? {} : { templateWarning }),
    }),
  };
};

// Each arg the story sets as the code it writes it with, its `argCode` or the literal it is.
const writtenCode = (args: Record<string, t.Node>, code: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(args).map(([name, node]) => {
      const literal = code[name] ?? evaluateArgLiteral(node, []);
      return [name, isUndefinedValue(node) || !literal ? undefined : writtenArg(literal)];
    })
  );

// The args as the story writes them, those that evaluate to a value as that value; see
// `writtenValue`.
const writtenArgs = (shape: StoryShape, enums: AngularComponentSnippetMeta['enums']) =>
  Object.fromEntries(
    Object.entries(shape.args).map(([name, node]) => [name, writtenValue(node, enums)])
  );

// The args the holes of a template print, or `undefined` where its own code holds a hole bracket.
const holeArgs = (template: string): Set<string> | undefined => {
  const args = new Set<string>();
  let ownBracket = false;
  const code = fillHoles(template, (kind, words) => {
    const field = kind === 'value' || kind === 'operand';
    ownBracket ||= !field && kind !== 'props' && kind !== 'text';
    for (const word of field ? words.slice(0, 1) : words) {
      if (word !== BINDS_UNDEFINED) {
        args.add(word);
      }
    }
    return '';
  });
  return ownBracket || hasHoleBracket(code) ? undefined : args;
};

interface HostField {
  name: string;
  value: string;
  /** The arg the field holds, which a hole prints. */
  arg?: string;
  /** Set where the render computes the field from args; its `template` is the field's value. */
  computed?: PropCode;
}

// The args host fields the render computes read, which reach the markup through them.
const computedArgs = (fields: readonly HostField[]) =>
  fields.flatMap(({ computed }) => computed?.args ?? []);

// A field the props hold an arg under prints that arg, or the code they hold while it is unset.
const holeField = (
  field: HostField,
  props: RenderedProps | undefined,
  enums: AngularComponentSnippetMeta['enums']
): HostField => {
  const { arg: propArg, code } = props?.(field.name) ?? {};
  const arg = code ? propArg : field.arg;
  if (field.computed || arg === undefined) {
    return field;
  }
  return { ...field, value: argHole(arg, code, enums) };
};

// The hole for an arg, with the code it prints while the arg is unset where a prop holds one.
const argHole = (
  arg: string,
  code: t.Node | undefined,
  enums: AngularComponentSnippetMeta['enums']
) => {
  const written = code && (evaluateArgLiteral(code, enums) ?? argFieldValue(code));
  return hole('value', holeWord(arg), ...(written ? [defaultWord(written)] : []));
};

// The host fields of the names the markup reads, each holding what the story's props hold under
// that name. Props that need the story to run are read as the args, as the snippet shows.
const referencedArgFields = (
  referencedNames: ReadonlySet<string>,
  shape: StoryShape,
  boundOutputs: readonly string[],
  enums: AngularComponentSnippetMeta['enums'],
  props: RenderedProps | undefined
): { fields: HostField[]; unresolved: { name: string; source: string }[]; provided: string[] } => {
  const taken = new Set(boundOutputs);
  const argNames = Object.keys(shape.args);
  const fields: HostField[] = [];
  const unresolved: { name: string; source: string }[] = [];
  const provided: string[] = [];

  const read = [...referencedNames].flatMap((name) => {
    const { arg, code, computed } = (props ? props(name) : { arg: name }) ?? {};
    const set = arg !== undefined && arg in shape.args;
    const node = set ? shape.args[arg]! : code;
    const position = set ? argNames.indexOf(arg) : argNames.length + (code?.start ?? 0);
    return node
      ? [{ name, node, position, arg: code ? undefined : arg, fromArg: set, computed }]
      : [];
  });
  for (const { name, node, arg, fromArg, computed } of read.sort(
    (a, b) => a.position - b.position
  )) {
    if (computed) {
      provided.push(name);
      // An arg the story writes with a name the snippet lacks prints that name.
      for (const arg of computed.args) {
        const written = shape.args[arg];
        if (written && isUnread(written, enums)) {
          unresolved.push({ name, source: sourceOf(written) });
        }
      }
      if (!taken.has(name)) {
        fields.push({ name, value: computed.template, computed });
      }
      continue;
    }
    const value = evaluateArgLiteral(node, enums);
    if (fromArg || value !== undefined) {
      provided.push(name);
    }
    if (taken.has(name)) {
      continue;
    }
    if (value === undefined && !fromArg) {
      continue;
    }
    // A host field is TypeScript, which can hold what the story writes, such as a `Date`; one that
    // names what the snippet lacks is warned about.
    if (value === undefined && !isSelfContained(node)) {
      unresolved.push({ name, source: sourceOf(node) });
    }
    fields.push({
      name,
      value: value ?? argFieldValue(node),
      ...(arg === undefined ? {} : { arg }),
    });
  }

  return { fields, unresolved, provided };
};

const withWarnings = (
  rendered: HostComponentSnippet,
  ...parts: (string | undefined)[]
): HostComponentSnippet => {
  const warning = joinWarnings(rendered.warning, ...parts);
  return warning === undefined ? rendered : { ...rendered, warning };
};

const joinWarnings = (...parts: (string | undefined)[]): string | undefined =>
  [...new Set(parts)].filter((part) => part !== undefined).join('\n') || undefined;

const templateAnalysisWarning = (analysis: StoryTemplateAnalysis): string | undefined =>
  analysis.kind === 'resolved'
    ? undefined
    : `Incomplete snippet: the story template could not be analyzed statically. ${analysis.errors.join('\n')}`;

const unknownTemplateReferencesWarning = (
  referencedNames: ReadonlySet<string>,
  provided: readonly string[]
): string | undefined => {
  const names = [...referencedNames].filter((name) => !provided.includes(name));
  return names.length === 0
    ? undefined
    : `Incomplete snippet: ${names.map((name) => `\`${name}\``).join(', ')} could not be provided, ` +
        `since the story declares no such arg.`;
};

const unboundArgsWarning = (
  componentName: string,
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  representedArgs?: readonly string[],
  computed: readonly string[] = []
): string | undefined => {
  const represented = new Set([...(representedArgs ?? []), ...computed]);
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

// Names in the order the snippet binds them: the story's args first, as it writes them.
const inArgsOrder = (names: readonly string[], shape: StoryShape) => {
  const argNames = Object.keys(shape.args);
  const position = (name: string) => {
    const index = argNames.indexOf(name);
    return index === -1 ? argNames.length : index;
  };
  return [...names].sort((left, right) => position(left) - position(right));
};

// The arg a prop holds whatever the args are, so a hole can print it.
const heldArg = (props: RenderedProps, name: string): string | undefined => {
  const prop = props(name);
  return prop?.code === undefined ? prop?.arg : undefined;
};

/**
 * What the story's props bind each input of the component's own element to. `holeInputs` are those
 * the props hold the arg of the same name under, which the element's `⟦props⟧` hole binds. An input
 * whose props hold an arg the binding cannot print, such as one under another name or one the story
 * writes as code, reads a host field whose value is the hole; one the props compute from args reads
 * a field of that code, and one they hold other code under is bound to it.
 */
const componentBindings = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  props: RenderedProps | undefined
): {
  inputs: Bindings['inputs'];
  holeInputs: string[];
  fields: HostField[];
  unresolved: string[];
} => {
  const { enums } = snippetMeta;
  const bound: { name: string; position: number; field?: HostField; expression?: string }[] = [];
  const unresolved: string[] = [];
  const argNames = Object.keys(shape.args);
  const holeInputs: string[] = [];
  for (const name of inArgsOrder(snippetMeta.inputs, shape)) {
    const { arg, code, computed } = (props ? props(name) : { arg: name }) ?? {};
    const node = arg !== undefined && arg in shape.args ? shape.args[arg]! : undefined;
    const position = node ? argNames.indexOf(arg!) : argNames.length + (code?.start ?? 0);
    const asCode = node && evaluateArgLiteral(node, enums) === undefined && isSelfContained(node);
    if (arg === name && !code && !asCode) {
      holeInputs.push(name);
    } else if (arg !== undefined && (node || code)) {
      bound.push({ name, position, field: { name, value: argHole(arg, code, enums), arg } });
    } else if (computed) {
      bound.push({ name, position, field: { name, value: computed.template, computed } });
    } else if (code && isUnread(code, enums)) {
      unresolved.push(sourceOf(code));
    } else if (code && evaluateArgLiteral(code, enums) === undefined) {
      bound.push({ name, position, field: { name, value: argFieldValue(code) } });
    } else if (code) {
      bound.push({ name, position, expression: evaluateArgExpression(code, enums) });
    }
  }
  // Inputs keep the order the story's args give them, those the props fix after, as written.
  bound.sort((left, right) => left.position - right.position);
  return {
    inputs: bound.map(({ name, expression }) => ({
      name,
      expression: expression ?? formatPropInTemplate(name),
    })),
    holeInputs,
    fields: bound.flatMap(({ field }) => field ?? []),
    unresolved,
  };
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
