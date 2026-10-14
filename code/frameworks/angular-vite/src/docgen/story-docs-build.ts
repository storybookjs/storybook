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
import { defaultWord, hasHoleBracket, hole, isHoleWord } from 'storybook/internal/docs-tools';
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
import type { Bindings, RenderedProps, StoryShape } from './story-docs-markup.ts';
import { keyNameOf, renderedProps, sourceOf, userTemplate } from './story-docs-markup.ts';
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
        : { template: rendered.template, argCode: argCodeOf(shape, deps) }),
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

// The code the snippet writes each arg with that no literal its value prints as stands for, as a
// host field holds it.
const argCodeOf = (shape: StoryShape, { snippetMeta }: StoryDocDeps) =>
  Object.fromEntries(
    Object.entries(shape.args)
      .filter(([, node]) => evaluateArgLiteral(node, snippetMeta?.enums ?? []) === undefined)
      .map(([name, node]) => [name, argFieldValue(node)])
  );

// `parameters.docs.source.code` is the example the author chose to publish, so it replaces what
// this pass would derive rather than competing with it.
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
    const analysis = analyzeStoryTemplate(userMarkup.markup, userMarkup.expansions);
    const referencedNames = new Set(analysis.kind === 'resolved' ? analysis.referencedNames : []);
    const boundOutputs =
      analysis.kind === 'resolved'
        ? snippetMeta.outputs.filter((name) => analysis.boundOutputs.includes(name))
        : [];
    const hostArgs = referencedArgFields(
      referencedNames,
      shape,
      boundOutputs,
      snippetMeta.enums,
      props
    );
    // A name the markup calls holds a function, which no control sets.
    const notRead = new Set([
      ...boundOutputs,
      ...(analysis.kind === 'resolved' ? analysis.calledNames : []),
    ]);
    const read = [...referencedNames].filter((name) => !notRead.has(name));
    const declared = new Set(hostArgs.fields.map(({ name }) => name));
    // An arg the story leaves unset is one a control can set: one it declares an arg type for, or an
    // input of the component. Any other name is one the story may never provide, and is warned about.
    const known = new Set([...snippetMeta.inputs, ...argTypeNames(shape)]);
    const unset = read.flatMap((name): HostField[] => {
      const arg = declared.has(name) || !props ? undefined : heldArg(props, name);
      const written = arg === undefined ? undefined : shape.args[arg];
      return arg === undefined ||
        (written && isFunctionValue(written)) ||
        (!(arg in shape.args) && !known.has(arg))
        ? []
        : [{ name, value: 'undefined', arg }];
    });
    // A prop holding an arg the story leaves unset reads `undefined`, as the template's hole prints.
    const unsetArgs =
      shape.unresolvedArgs.length === 0 ? unset.filter(({ arg }) => !(arg! in shape.args)) : [];
    const configUnresolved = [...shape.metaMembers.unresolved, ...shape.members.unresolved];
    const unprovided = unknownTemplateReferencesWarning(referencedNames, [
      ...hostArgs.provided,
      ...boundOutputs,
      ...unsetArgs.map(({ name }) => name),
    ]);
    const unbound = unboundArgsWarning(
      localName,
      snippetMeta,
      shape,
      [...userMarkup.representedArgs, ...referencedNames],
      computedArgs(hostArgs.fields)
    );
    const rendered = withWarnings(
      host(
        formatTemplateMarkup(analysis.markup),
        false,
        boundOutputs,
        sharingArgs([...hostArgs.fields, ...unsetArgs], shape, props)
      ),
      unresolvedWarning([...configUnresolved, ...hostArgs.unresolved.map(({ source }) => source)]),
      templateAnalysisWarning(analysis),
      unprovided,
      unbound
    );
    // Markup follows the controls where it reads its args through `argsToTemplate` or by name; a
    // name the props hold an arg under is a host field, whose value is the hole.
    const { expansions, representedArgs } = userMarkup;
    const onlyExpanded = representedArgs.every((arg) => expansions.some((e) => e.allows(arg)));
    if (analysis.kind !== 'resolved' || !onlyExpanded || !props) {
      return rendered;
    }
    // A prop an arg replaces only while it is set holds the code it is written with until then,
    // which the hole prints while the arg is unset; other code shows neither value for certain.
    const fallbacks = new Map<string, { arg: string; code?: string }>();
    for (const name of read) {
      const { arg, code } = props(name) ?? {};
      if (code && arg !== undefined) {
        const literal = evaluateArgLiteral(code, snippetMeta.enums);
        const written = shape.args[arg];
        const prints =
          literal !== undefined &&
          !hasHoleBracket(literal) &&
          declared.has(name) &&
          !(written && isFunctionValue(written));
        fallbacks.set(name, { arg, code: prints ? literal : undefined });
      }
    }
    const heldArgs: string[] = [];
    const holeFields = sharingArgs([...hostArgs.fields, ...unset], shape, props).map((field) => {
      const fallback = fallbacks.get(field.name);
      if (fallback?.code !== undefined) {
        heldArgs.push(fallback.arg);
        return { ...field, value: hole('value', fallback.arg, defaultWord(fallback.code)) };
      }
      if (field.computed) {
        heldArgs.push(...field.computed.args);
        return { ...field, value: field.computed.template };
      }
      if (field.arg === undefined || notRead.has(field.name)) {
        return field;
      }
      heldArgs.push(field.arg);
      return { ...field, value: hole('value', field.arg) };
    });
    const eitherWay = [...fallbacks.values()].some(({ code }) => code === undefined);
    // `argsToTemplate` binds every arg that holds no function to the prop of its name, which has
    // to be that arg. The snippet binds the inputs among them, as `argsExpansion` does.
    const bindable = [
      ...new Set([
        ...snippetMeta.inputs,
        ...Object.keys(shape.args).filter(
          (name) => !isFunctionValue(shape.args[name]!) && !snippetMeta.outputs.includes(name)
        ),
      ]),
    ];
    const followsControls = expansions.every(({ allows }) =>
      bindable.every((name) => !allows(name) || heldArg(props, name) === name)
    );
    const expanded = (allows: (name: string) => boolean) =>
      inArgsOrder(snippetMeta.inputs, shape).filter((name) => allows(name) && isHoleWord(name));
    if (
      (expansions.length === 0 && heldArgs.length === 0) ||
      !followsControls ||
      eitherWay ||
      !heldArgs.every(isHoleWord)
    ) {
      return rendered;
    }
    // Each expansion stands in for its own marker until the markup is formatted, laid out as the
    // bindings the snippet gives it, then for a hole.
    const marked = expansions.map((e) => ({ ...e, inputAttributes: [e.marker] }));
    let markup = formatTemplateMarkup(
      analyzeStoryTemplate(userMarkup.markup, marked).markup,
      new Map(expansions.map((e) => [e.marker, e.inputAttributes]))
    );
    for (const { marker, allows } of expansions) {
      markup = markup.replace(
        new RegExp(`${marker}(?![\\w-])`),
        hole('props', ...expanded(allows))
      );
    }
    // A hole prints an arg value this pass could not read as written, until a control changes it.
    return withTemplate(rendered, host(markup, false, boundOutputs, holeFields), [
      unresolvedWarning([...configUnresolved, ...hostArgs.unresolved.map(({ source }) => source)]),
      unprovided,
      unbound,
    ]);
  }

  const markupSources = userMarkup?.source === undefined ? [] : [userMarkup.source];
  // The story renders an element-less component through an outlet that passes it no inputs, so
  // naming the args that could not be read would say nothing about what is missing from it.
  if (!snippetMeta.selector) {
    return withWarnings(
      host(buildComponentOutletTemplate(localName, { selfClosing: true }), true, []),
      unresolvedWarning(markupSources)
    );
  }

  const { bindings, fields, unresolved, holeInputs } = componentBindings(snippetMeta, shape, props);
  const unbound = unboundArgsWarning(
    localName,
    snippetMeta,
    shape,
    undefined,
    computedArgs(fields)
  );
  const rendered = withWarnings(
    host(
      buildTemplate(snippetMeta.selector, { ...bindings, selfClosing: true }),
      false,
      snippetMeta.outputs,
      fields
    ),
    unresolvedWarning([...markupSources, ...shape.unresolvedArgs, ...unresolved]),
    unbound
  );
  // The component's own element follows the controls, unless the story binds an input to code
  // other than code that reads args.
  if (userMarkup || fields.some(({ computed }) => !computed) || !holeInputs) {
    return rendered;
  }
  const markup = buildTemplate(snippetMeta.selector, {
    inputs: bindings.inputs.filter(({ name }) => !holeInputs.includes(name)),
    outputs: snippetMeta.outputs,
    selfClosing: true,
    hole: {
      text: hole('props', BINDS_UNDEFINED, ...holeInputs.filter(isHoleWord)),
      standsFor: bindings.inputs
        .filter(({ name }) => holeInputs.includes(name))
        .map(({ name, expression }) => `[${name}]="${expression}"`),
    },
  });
  const holeFields = fields.map((field) => ({ ...field, value: field.computed!.template }));
  // A hole prints an arg value this pass could not read as written, until a control changes it;
  // args it could not see may still be bound to nothing.
  const unread = holeInputs.flatMap((name) => {
    const node = shape.args[name];
    return node && isUnread(node, snippetMeta.enums) ? [sourceOf(node)] : [];
  });
  return withTemplate(rendered, host(markup, false, snippetMeta.outputs, holeFields), [
    unresolvedWarning([...shape.hidingArgs, ...unread]),
    unbound,
  ]);
};

// A snippet whose own code holds a hole bracket has no template, and neither has one whose holes
// name no arg, as no args change it. The filled snippet keeps those of the warnings the args it is
// filled with do not answer.
const withTemplate = (
  rendered: HostComponentSnippet,
  template: HostComponentSnippet,
  stillApplies: (string | undefined)[]
): HostComponentSnippet => {
  const namesAnArg = [...template.snippet.matchAll(/⟦\S+((?: [^\s⟧]+)*)⟧/g)].some(([, words]) =>
    words!.split(' ').some((word) => word !== '' && word !== BINDS_UNDEFINED)
  );
  if (hasHoleBracket(rendered.snippet) || !namesAnArg) {
    return rendered;
  }
  const { warning: templateWarning } = withWarnings(template, ...stillApplies);
  return {
    ...rendered,
    template: template.snippet,
    ...(templateWarning === undefined ? {} : { templateWarning }),
  };
};

interface HostField {
  name: string;
  value: string;
  /** The arg the field holds whatever the args are, which a hole can print. */
  arg?: string;
  /** Set where the render computes the field from args; see {@link computedField}. */
  computed?: ComputedField;
}

interface ComputedField {
  /** The field's code with a hole for each arg it reads. */
  template: string;
  args: string[];
  imports: string[];
}

type ComputedValue = ComputedField & { value: string };

// Code the story writes an arg with, which a hole holds in place of a literal: `1 + 2` is
// parenthesised, so it stays one operand.
const operand = (node: t.Node) => {
  const code = argFieldValue(node);
  const unwrapped = unwrapExpression(node);
  return t.isLiteral(unwrapped) ||
    t.isArrayExpression(unwrapped) ||
    t.isObjectExpression(unwrapped) ||
    t.isCallExpression(unwrapped) ||
    t.isNewExpression(unwrapped) ||
    t.isMemberExpression(unwrapped)
    ? code
    : `(${code})`;
};

// The args host fields the render computes read, which reach the markup through them.
const computedArgs = (fields: readonly HostField[]) =>
  fields.flatMap(({ computed }) => computed?.args ?? []);

// The code a render computes a prop with, written with the story's arg values and, for the
// template, a hole for each; `undefined` when an arg it reads holds what the snippet cannot write.
const computedField = (
  code: PropCode,
  shape: StoryShape,
  enums: AngularComponentSnippetMeta['enums']
): ComputedValue | undefined => {
  const values = new Map<string, string>();
  for (const arg of code.args) {
    const node = shape.args[arg];
    const value =
      node === undefined
        ? 'undefined'
        : (evaluateArgLiteral(node, enums) ??
          (isSelfContained(node) && !isFunctionValue(node) ? operand(node) : undefined));
    if (value === undefined || !isHoleWord(arg)) {
      return undefined;
    }
    values.set(arg, value);
  }
  return {
    value: code.print((arg) => values.get(arg)!),
    template: code.print((arg) => hole('value', arg)),
    args: code.args,
    imports: code.imports,
  };
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
    const field = computed && computedField(computed, shape, enums);
    if (field) {
      provided.push(name);
      if (!taken.has(name)) {
        fields.push({ name, value: field.value, computed: field });
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
    if (value !== undefined) {
      fields.push({ name, value, ...(arg === undefined ? {} : { arg }) });
    } else if (fromArg && isSelfContained(node) && !isFunctionValue(node)) {
      // A host field is TypeScript, which can hold what the story writes, such as a `Date`.
      provided.push(name);
      fields.push({ name, value: argFieldValue(node), ...(arg === undefined ? {} : { arg }) });
    } else if (fromArg && isSelfContained(node) && !readsThis(node)) {
      // A function the story writes inline is code no control sets, so the field holds it as is.
      provided.push(name);
      fields.push({ name, value: argFieldValue(node) });
    } else if (fromArg) {
      unresolved.push({ name, source: sourceOf(node) });
    }
  }

  return { fields, unresolved, provided };
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

// Names the props hold one arg under hold one object, so a field after the first shares the
// first's value. An arg the story sets to a primitive is copied instead, which reads the same.
const sharingArgs = (
  fields: readonly HostField[],
  shape: StoryShape,
  props: RenderedProps | undefined
): HostField[] => {
  const first = new Map<string, string>();
  return fields.map((field) => {
    const prop = props ? props(field.name) : { arg: field.name };
    const arg = field.computed ? undefined : (field.arg ?? prop?.arg);
    const value = arg === undefined ? undefined : (shape.args[arg] ?? prop?.code);
    if (arg === undefined || (value && isPrimitiveValue(value))) {
      return field;
    }
    const owner = first.get(arg);
    if (owner === undefined) {
      first.set(arg, field.name);
      return field;
    }
    return { name: field.name, value: `this.${owner}` };
  });
};

const isPrimitiveValue = (node: t.Node): boolean => {
  const unwrapped = unwrapExpression(node);
  return (
    (t.isLiteral(unwrapped) && !t.isRegExpLiteral(unwrapped)) ||
    (t.isUnaryExpression(unwrapped) && t.isNumericLiteral(unwrapped.argument))
  );
};

// The args the story and its meta declare an arg type for, as far as their `argTypes` are written
// out as object literals.
const argTypeNames = (shape: StoryShape): string[] =>
  [shape.members, shape.metaMembers].flatMap(({ properties }) => {
    const argTypes = properties.argTypes && unwrapExpression(properties.argTypes);
    return t.isObjectExpression(argTypes)
      ? argTypes.properties.flatMap((property) =>
          (t.isObjectProperty(property) || t.isObjectMethod(property)) && !property.computed
            ? (keyNameOf(property) ?? [])
            : []
        )
      : [];
  });

// The arg a prop holds whatever the args are, so a hole can print it.
const heldArg = (props: RenderedProps, name: string): string | undefined => {
  const prop = props(name);
  return prop?.code === undefined ? prop?.arg : undefined;
};

// The inputs the story's props bind on the component's own element. `holeInputs` names those the
// props hold the arg of the same name under, and is absent when the others do not stand as written.
const componentBindings = (
  snippetMeta: AngularComponentSnippetMeta,
  shape: StoryShape,
  props: RenderedProps | undefined
): {
  bindings: Bindings;
  fields: HostField[];
  unresolved: string[];
  holeInputs?: string[];
} => {
  const { enums } = snippetMeta;
  const bound: { name: string; node: t.Node; arg?: string; computed?: ComputedValue }[] = [];
  const unresolved: string[] = [];
  let standsAsWritten = props !== undefined;
  for (const name of snippetMeta.inputs) {
    const { arg, code, computed } = (props ? props(name) : { arg: name }) ?? {};
    const field = arg === undefined && computed && computedField(computed, shape, enums);
    if (arg !== undefined && arg in shape.args) {
      bound.push({ name, node: shape.args[arg]!, arg });
    } else if (code && field) {
      bound.push({ name, node: code, computed: field });
    } else if (code && evaluateArgLiteral(code, enums) === undefined && !isSelfContained(code)) {
      unresolved.push(sourceOf(code));
    } else if (code) {
      bound.push({ name, node: code });
    }
    standsAsWritten &&= code
      ? arg === undefined && (!!field || evaluateArgLiteral(code, enums) !== undefined)
      : arg === undefined || arg === name;
  }
  // Inputs keep the order the story's args give them, those the props fix after, as written.
  const argNames = Object.keys(shape.args);
  const position = ({ arg, node }: { arg?: string; node: t.Node }) =>
    arg === undefined ? argNames.length + (node.start ?? 0) : argNames.indexOf(arg);
  bound.sort((left, right) => position(left) - position(right));

  const inputs: Bindings['inputs'] = [];
  const fields: HostField[] = [];
  for (const { name, node, computed } of bound) {
    if (computed) {
      fields.push({ name, value: computed.value, computed });
      inputs.push({ name, expression: formatPropInTemplate(name) });
      continue;
    }
    if (evaluateArgLiteral(node, enums) === undefined && isSelfContained(node)) {
      fields.push({ name, value: argFieldValue(node) });
      inputs.push({ name, expression: formatPropInTemplate(name) });
      continue;
    }
    inputs.push({ name, expression: evaluateArgExpression(node, enums) });
  }
  return {
    bindings: { inputs, outputs: snippetMeta.outputs },
    fields,
    unresolved,
    ...(standsAsWritten && props
      ? {
          holeInputs: inArgsOrder(snippetMeta.inputs, shape).filter(
            (name) => heldArg(props, name) === name
          ),
        }
      : {}),
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

// A host field's `this` is the host component, where the story's code had its own.
const readsThis = (node: t.Node): boolean => {
  let found = false;
  t.traverse(node, (child) => {
    found ||= t.isThisExpression(child);
  });
  return found;
};

const isUndefinedValue = (node: t.Node): boolean => {
  const unwrapped = unwrapExpression(node);
  return (
    (t.isIdentifier(unwrapped) && unwrapped.name === 'undefined') ||
    t.isUnaryExpression(unwrapped, { operator: 'void' })
  );
};
