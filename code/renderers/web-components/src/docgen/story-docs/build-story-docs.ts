import type { NodePath } from 'storybook/internal/babel';
import { types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type {
  CsfFile,
  RenderFunctionPath,
  StoryArgsResolver,
  StoryReferences,
} from 'storybook/internal/csf-tools';
import {
  authoredSource,
  createStoryArgsResolver,
  createStoryReferenceResolver,
  extractStoryJSDocInfo,
  noSnippetWarning,
  sourceOf,
  unwrapExpression,
  unresolvedWarning,
} from 'storybook/internal/csf-tools';
import { fillHoles, hasHoleBracket } from 'storybook/internal/docs-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { resolve } from 'node:path';

import type { WebComponentsDocgenPayload } from '../component-docgen/build-docgen.ts';
import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import {
  parseStoryFile,
  resolveStoryComponent,
} from '../component-docgen/resolve-component/resolve-component.ts';
import { evaluateArgValue } from './arg-values.ts';
import { classifyArg, type ArgBinding } from './classify-args.ts';
import type { ElementSnippet } from './print-element.ts';
import { printElementSnippet, printListenerScript } from './print-element.ts';
import { fillTemplate } from '../../docs/fill-template.ts';
import type { LiveTemplate, SpreadElement } from './story-template.ts';
import { argsTemplate, argsWords, litTemplate } from './story-template.ts';
import { litBindings, templateModule } from './template-calls.ts';
import { printHtmlTemplate } from './template-print.ts';
import { resolveHtmlTemplate } from './template-scope.ts';
import { resolveEffectiveRender } from '../../../../../core/src/csf-tools/story-shape/render.ts';

export interface BuildStoryDocsContext {
  getDocgenPayload: (componentId: string) => Promise<WebComponentsDocgenPayload | undefined>;
  resolvePath?: (importPath: string) => string;
}

interface StoryDocDeps {
  csf: CsfFile;
  declaration: ManifestDeclaration;
  docgenPayload: WebComponentsDocgenPayload;
  resolveStoryArgs: StoryArgsResolver;
  tag: string;
}

type SnippetResult = {
  snippet?: string;
  template?: string;
  templateWarning?: string;
  warning?: string;
};
type ResolvedStoryArgs = ReturnType<StoryArgsResolver['resolve']>;
type AuthoredFallback = (resolved: ResolvedStoryArgs) => SnippetResult;

const NO_COMPONENT_WARNING = 'No static snippet: `meta.component` is not set.';

const openStoryReferences = createStoryReferenceResolver();

export async function buildStoryDocsPayload(
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext
): Promise<StoryDocsPayload | undefined> {
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

  const resolved = resolveStoryComponent(csf);
  if ('reason' in resolved && resolved.reason === 'no-meta-component') {
    const titleName = input.entry.title.slice(input.entry.title.lastIndexOf('/') + 1);
    return buildPayload(
      input,
      storyImportPath,
      csf,
      authoredSnippetFactory(csf, storyFilePath, elementlessSnippet(csf, NO_COMPONENT_WARNING)),
      titleName
    );
  }

  const docgenPayload = await context.getDocgenPayload(getComponentIdFromEntry(input.entry));
  if (!docgenPayload) {
    return undefined;
  }
  const declaration = docgenPayload?.customElementsManifest?.declaration;
  const snippetFor: (exportName: string) => SnippetResult = declaration
    ? renderedSnippetFactory(csf, declaration, docgenPayload, storyFilePath)
    : authoredSnippetFactory(
        csf,
        storyFilePath,
        elementlessSnippet(
          csf,
          `No static snippet: ${
            docgenPayload.error?.message ??
            'no Custom Elements Manifest declaration for this component.'
          }`
        )
      );

  return buildPayload(input, storyImportPath, csf, snippetFor, docgenPayload.name);
}

const buildPayload = (
  input: StoryDocsProviderInput,
  storyImportPath: string,
  csf: CsfFile,
  snippetFor: (exportName: string) => SnippetResult,
  name: string
): StoryDocsPayload => {
  const stories = Object.fromEntries(
    Object.entries(csf._stories).map(([exportName, story]) => [
      story.id,
      buildStoryDoc(exportName, story, csf, snippetFor),
    ])
  );

  return {
    id: getComponentIdFromEntry(input.entry),
    name,
    path: storyImportPath,
    stories,
  };
};

const renderedSnippetFactory = (
  csf: CsfFile,
  declaration: ManifestDeclaration,
  docgenPayload: WebComponentsDocgenPayload,
  storyFilePath: string
): ((exportName: string) => SnippetResult) => {
  const references = storyReferences(storyFilePath);
  const deps: StoryDocDeps = {
    csf,
    declaration,
    docgenPayload,
    resolveStoryArgs: createStoryArgsResolver(csf, references),
    tag: declaration.tagName ?? docgenPayload.name,
  };
  return (exportName) => renderedSnippet(exportName, deps);
};

const storyReferences = (storyFilePath: string): StoryReferences => ({
  filePath: storyFilePath,
  resolveModule: openStoryReferences().resolveModule,
});

const baseStoryDoc = (
  csf: CsfFile,
  exportName: string,
  story: CsfFile['_stories'][string],
  result: SnippetResult
): StoryDoc => {
  const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
  return {
    id: story.id,
    name: story.name ?? storyNameFromExport(exportName),
    ...(result.snippet === undefined ? {} : { snippet: result.snippet }),
    ...(result.template === undefined ? {} : { template: result.template }),
    ...(result.template === undefined || result.templateWarning === undefined
      ? {}
      : { templateWarning: result.templateWarning }),
    ...(result.warning === undefined ? {} : { warning: result.warning }),
    ...(description ? { description } : {}),
    ...(summary === undefined ? {} : { summary }),
  };
};

const buildStoryDoc = (
  exportName: string,
  story: CsfFile['_stories'][string],
  csf: CsfFile,
  snippetFor: (exportName: string) => SnippetResult
): StoryDoc => {
  try {
    return baseStoryDoc(csf, exportName, story, snippetFor(exportName));
  } catch (e) {
    const err = e instanceof Error ? e : undefined;
    return {
      id: story.id,
      name: story.name ?? storyNameFromExport(exportName),
      error: { name: err?.name ?? 'Error', message: err?.message ?? String(e) },
    };
  }
};

const renderedSnippet = (exportName: string, deps: StoryDocDeps): SnippetResult => {
  return authoredOrFallback(exportName, deps.resolveStoryArgs, (resolved) =>
    renderedArgsSnippet(exportName, resolved, deps)
  );
};

const authoredSnippetFactory = (
  csf: CsfFile,
  storyFilePath: string,
  fallback: (exportName: string, resolveStoryArgs: StoryArgsResolver) => AuthoredFallback
): ((exportName: string) => SnippetResult) => {
  const resolveStoryArgs = createStoryArgsResolver(csf, storyReferences(storyFilePath));
  return (exportName) =>
    authoredOrFallback(exportName, resolveStoryArgs, fallback(exportName, resolveStoryArgs));
};

/**
 * A story without `meta.component`, or whose component the manifest does not declare, has no
 * element to write its args on, but a render reads them where it writes them, so its template and
 * the static snippet it fills to need no manifest.
 */
const elementlessSnippet =
  (csf: CsfFile, warning: string) =>
  (exportName: string, resolveStoryArgs: StoryArgsResolver): AuthoredFallback =>
  (resolved) => {
    const render = resolveEffectiveRender(csf, exportName, resolveStoryArgs.ctx);
    const live =
      render.kind === 'resolved'
        ? liveTemplate(render.path, resolved, csf, resolveStoryArgs, { tag: '' })
        : undefined;
    return (
      filledSnippet(live, resolved) ?? {
        warning,
        ...(live && { template: live.template, ...templateWarning(live, resolved) }),
      }
    );
  };

const authoredOrFallback = (
  exportName: string,
  resolveStoryArgs: StoryArgsResolver,
  fallback: AuthoredFallback
): SnippetResult => {
  const resolved = resolveStoryArgs.resolve(exportName);
  const warnings: (string | undefined)[] = [];
  const authored = authoredSource(resolved, resolveStoryArgs.ctx);
  if (authored.kind === 'code') {
    return { snippet: authored.code };
  }
  if (authored.kind === 'disabled') {
    return {};
  }
  if (authored.kind === 'unresolvable') {
    warnings.push(unresolvedWarning([authored.source]));
  }
  const result = fallback(resolved);
  return { ...result, ...joinWarnings([...warnings, result.warning]) };
};

const renderedArgsSnippet = (
  exportName: string,
  resolved: ResolvedStoryArgs,
  deps: StoryDocDeps
): SnippetResult => {
  const warnings: (string | undefined)[] = [];
  const render = resolveEffectiveRender(deps.csf, exportName, deps.resolveStoryArgs.ctx);
  const live =
    render.kind === 'resolved'
      ? liveTemplate(render.path, resolved, deps.csf, deps.resolveStoryArgs, {
          tag: deps.tag,
          declaration: deps.declaration,
        })
      : undefined;
  const liveWarning = live ? templateWarning(live, resolved) : {};
  // The static snippet reads a spread of the project's own as Storybook's render sets the args.
  const guessed = () =>
    render.kind === 'resolved'
      ? liveTemplate(render.path, resolved, deps.csf, deps.resolveStoryArgs, {
          tag: deps.tag,
          declaration: deps.declaration,
          guess: argsWords(
            Object.keys(resolved.args),
            deps.docgenPayload.argTypes ?? {},
            deps.declaration
          ),
        })
      : undefined;
  if (render.kind === 'resolved') {
    const { ctx } = deps.resolveStoryArgs;
    const module = templateModule(
      { program: deps.csf._file.path, filePath: ctx.filePath },
      ctx.resolveModule
    );
    const template = resolveHtmlTemplate(render.path, deps.csf, litBindings(module));
    const printed = template && printHtmlTemplate(template, resolved.args, deps.declaration);
    const unresolved = printed ? [...resolved.unresolved, ...printed.unresolved] : [];
    // Html whose holes all fail prints nothing; the element the args set stands in for it.
    if (
      printed &&
      (printed.snippet !== '' || unresolved.length + printed.properties.length === 0)
    ) {
      warnings.push(unresolvedWarning(unresolved));
      warnings.push(incompleteList(printed.properties, 'properties without an attribute'));
      warnings.push(
        incompleteList(printed.falseDefaults ?? [], 'false values that HTML cannot express')
      );
      warnings.push(incompleteList(printed.listenersNotShown ?? [], 'listeners not shown'));
      warnings.push(unboundTemplateArgs(resolved.args, printed.referenced));
      const filled = unresolved.length > 0 ? filledSnippet(live, resolved, guessed) : undefined;
      if (filled) {
        return filled;
      }
      return {
        snippet: printed.snippet,
        ...(live === undefined ? {} : { template: live.template, ...liveWarning }),
        ...joinWarnings(warnings),
      };
    }
    const filled = filledSnippet(live, resolved, guessed);
    if (filled) {
      return filled;
    }
    warnings.push(unresolvedWarning([sourceOf(render.path.node)]));
  } else if (render.kind === 'unresolved') {
    warnings.push(unresolvedWarning(unresolvedRenderSource(render, resolved)));
  }

  const args = argsSnippet(
    resolved.args,
    deps.declaration,
    deps.docgenPayload.argTypes ?? {},
    deps.tag,
    resolved.unresolved
  );
  warnings.push(args.warning);

  return {
    ...(args.snippet ? { snippet: args.snippet } : {}),
    ...(render.kind === 'missing' && args.template
      ? { template: args.template, templateWarning: args.templateWarning }
      : {}),
    ...(live === undefined ? {} : { template: live.template, ...liveWarning }),
    ...joinWarnings(warnings),
  };
};

/**
 * The static snippet a story's template fills to with the args written in the story file, for a
 * render the static snippet cannot read. A spread of args the static pass cannot read leaves out
 * what it sets, which its warning says; a value it cannot read keeps the static snippet. A
 * template that passes the args whole to code as an object is no static snippet: it fills to the
 * story's code rather than its html, so the `guessed` template, which reads a spread as
 * Storybook's render sets the args, stands in for it, if any. It does for a helper's spread too,
 * and for a render with no template: it may name what another file declares, which a static
 * snippet may show, but a template filled with other args may not.
 */
const filledSnippet = (
  live: LiveTemplate | undefined,
  resolved: ResolvedStoryArgs,
  guessed?: () => LiveTemplate | undefined
): SnippetResult | undefined => {
  const source = live && !guessesSpread(live.template) ? live : (guessed?.() ?? live);
  if (!source || hasArgsHole(source.template)) {
    return undefined;
  }
  const read = templateArgs(source.template);
  const args: Record<string, unknown> = {};
  for (const name of read.all ? Object.keys(resolved.args) : read.names) {
    const node = resolved.args[name];
    const value = node ? evaluateArgValue(node) : { kind: 'unset' as const };
    if (value.kind === 'unresolved') {
      return undefined;
    }
    // A function the story file writes is a listener, which the static snippet leaves out.
    args[name] =
      value.kind === 'value' ? value.value : value.kind === 'function' ? LISTENER : undefined;
  }
  try {
    const { templateWarning: warning } = templateWarning(source, resolved);
    const { templateWarning: liveWarning } = live ? templateWarning(live, resolved) : {};
    return {
      snippet: fillTemplate(source.template, args),
      ...(live && { template: live.template }),
      ...joinWarnings([unresolvedWarning(resolved.unresolved), warning]),
      ...(liveWarning === undefined ? {} : { templateWarning: liveWarning }),
    };
  } catch {
    return undefined;
  }
};

// What a filled template still leaves out: the listeners, and the args the story sets that no hole
// prints. A function arg is a listener, which the first list names where the render binds it.
const templateWarning = (
  live: LiveTemplate,
  resolved: ResolvedStoryArgs
): { templateWarning?: string } => {
  const read = templateArgs(live.template);
  const unbound = read.all
    ? []
    : Object.entries(resolved.args)
        .filter(
          ([name, node]) =>
            !read.names.has(name) && !['unset', 'function'].includes(evaluateArgValue(node).kind)
        )
        .map(([name]) => name);
  const { warning } = joinWarnings([
    incompleteList(live.listeners, 'listeners not shown'),
    incompleteList(unbound, 'args not bound by the render template'),
  ]);
  return warning === undefined ? {} : { templateWarning: warning };
};

// The args a template's holes print; a props hole names one per word, or all with a `*` word.
const templateArgs = (template: string): { names: Set<string>; all: boolean } => {
  const names = new Set<string>();
  let all = false;
  fillHoles(template, (kind, words) => {
    if (kind === 'props') {
      for (const word of words) {
        all ||= word === '*';
        if (word.startsWith('^')) {
          names.add(word.slice(1));
        } else if (word.includes('=')) {
          names.add(word.split(/=(.*)/)[1]!);
        }
      }
    } else if (kind === 'style') {
      words.slice(1).forEach((word) => names.add(word.split(/=(.*)/)[1]!));
    } else if (kind === 'args') {
      all = true;
    } else {
      names.add(['attr', 'bool', 'prop', 'slot'].includes(kind) ? words[1]! : words[0]!);
    }
    return '';
  });
  return { names, all };
};

const LISTENER = Object.assign(() => {}, { isAction: true });

const hasArgsHole = (template: string) => /⟦args[\s⟧]/.test(template);

// A spread the static snippet reads as Storybook's render sets the args: one it keeps as code, and
// a helper's, whose properties it would otherwise write in full.
const guessesSpread = (template: string) =>
  hasArgsHole(template) || /⟦props !spread(Props)? /.test(template);

const liveTemplate = (
  render: RenderFunctionPath,
  resolved: ResolvedStoryArgs,
  csf: CsfFile,
  { ctx }: StoryArgsResolver,
  element: SpreadElement
): LiveTemplate | undefined => {
  const program = render.findParent((path) => path.isProgram()) as NodePath<t.Program>;
  // A render function from another file is read in the code of that file.
  const filePath =
    program.node === csf._ast.program
      ? ctx.filePath
      : (program.hub as unknown as { file: { opts: { filename: string } } }).file.opts.filename;
  return litTemplate(render.node, templateModule({ program, filePath }, ctx.resolveModule), {
    ...element,
    args: Object.entries(resolved.args)
      .filter(([, node]) => evaluateArgValue(node).kind !== 'unset')
      .map(([name]) => name),
  });
};

const unboundTemplateArgs = (
  args: Record<string, t.Node>,
  referenced: readonly string[]
): string | undefined => {
  const bound = new Set(referenced);
  const unbound = Object.entries(args)
    .filter(([name, node]) => !bound.has(name) && evaluateArgValue(node).kind !== 'unset')
    .map(([name]) => name);
  return incompleteList(unbound, 'args not bound by the render template');
};

const unresolvedRenderSource = (
  render: Extract<ReturnType<typeof resolveEffectiveRender>, { kind: 'unresolved' }>,
  resolved: ResolvedStoryArgs
): string[] => {
  const node =
    resolved.storyMembers.properties.render ??
    resolved.metaMembers.properties.render ??
    render.shadowedRender?.node;
  return node ? [sourceOf(node)] : [];
};

const argsSnippet = (
  args: Record<string, t.Node>,
  declaration: ManifestDeclaration,
  argTypes: WebComponentsDocgenPayload['argTypes'],
  tag: string,
  unresolvedArgs: readonly string[]
): SnippetResult => {
  const snippet: ElementSnippet = {
    tag,
    attributes: [],
    cssProperties: [],
    listeners: [],
    slots: [],
    styleRules: [],
  };
  const unresolved: string[] = [];
  const listeners: string[] = [];
  const properties: string[] = [];
  const unknown: string[] = [];

  for (const [key, node] of Object.entries(args)) {
    const value = evaluateArgValue(node);
    if (value.kind === 'unset') {
      continue;
    }
    const binding = classifyArg(key, value.kind === 'function', argTypes ?? {}, declaration);
    switch (binding.kind) {
      case 'listener':
        if (binding.event) {
          snippet.listeners.push({ event: binding.event, handler: listenerHandler(node), tag });
        } else {
          listeners.push(key);
        }
        break;
      case 'property':
        properties.push(key);
        break;
      case 'method':
        break;
      case 'unknown':
        unknown.push(key);
        break;
      case 'attribute':
      case 'cssProperty':
      case 'slot':
      case 'cssPart':
      case 'cssState':
        if (value.kind === 'value') {
          addBoundValue(snippet, binding, key, value.value, tag);
        } else if (value.kind === 'unresolved') {
          unresolved.push(value.source);
        }
        break;
      default: {
        const exhaustive: never = binding;
        return exhaustive;
      }
    }
  }

  // What the template, which prints each arg as the story applies it, still leaves out.
  const left = [incompleteList(listeners, 'listeners the HTML snippet cannot express')];
  const warnings = [
    ...left,
    incompleteList(falseDefaultAttributes(snippet), 'false values that HTML cannot express'),
    incompleteList(properties, 'properties without an attribute'),
    incompleteList(unknown, `args not declared by \`${tag}\``),
  ];
  const allUnresolved = [...unresolvedArgs, ...unresolved];
  const printed = hasSnippetContent(snippet) || allUnresolved.length === 0;
  warnings.push(printed ? unresolvedWarning(allUnresolved) : noSnippetWarning(allUnresolved));
  // A function arg, such as an action, is a listener, which the static snippet's script adds.
  const element = argsTemplate(
    tag,
    Object.keys(args).filter((key) => evaluateArgValue(args[key]!).kind !== 'function'),
    argTypes ?? {},
    declaration
  );
  const script = printListenerScript(tag, snippet.listeners);
  const template =
    script && hasHoleBracket(script) ? undefined : [element, script].filter(Boolean).join('\n');

  return {
    ...(printed ? { snippet: printElementSnippet(snippet) } : {}),
    ...(template ? { template, templateWarning: joinWarnings(left).warning } : {}),
    ...joinWarnings(warnings),
  };
};

const addBoundValue = (
  snippet: ElementSnippet,
  binding: Exclude<ArgBinding, { kind: 'listener' | 'property' | 'method' | 'unknown' }>,
  source: string,
  value: unknown,
  tag: string
): void => {
  switch (binding.kind) {
    case 'attribute':
      upsertByName(snippet.attributes, {
        name: binding.name,
        value,
        viaField: binding.viaField,
        defaultValue: binding.defaultValue,
        source,
      });
      break;
    case 'cssProperty':
      upsertByName(snippet.cssProperties, { name: binding.name, value });
      break;
    case 'slot':
      upsertByName(snippet.slots, { name: binding.name, html: value });
      break;
    case 'cssPart':
      upsertBySelector(snippet.styleRules, {
        selector: `${tag}::part(${binding.name})`,
        declarations: String(value),
      });
      break;
    case 'cssState':
      upsertBySelector(snippet.styleRules, {
        selector: `${tag}:state(${binding.name})`,
        declarations: String(value),
      });
      break;
    default: {
      const exhaustive: never = binding;
      return exhaustive;
    }
  }
};

const upsertByName = <T extends { name: string }>(items: T[], next: T): void => {
  const index = items.findIndex((item) => item.name === next.name);
  if (index === -1) {
    items.push(next);
    return;
  }
  items[index] = next;
};

const upsertBySelector = <T extends { selector: string }>(items: T[], next: T): void => {
  const index = items.findIndex((item) => item.selector === next.selector);
  if (index === -1) {
    items.push(next);
    return;
  }
  items[index] = next;
};

const falseDefaultAttributes = (snippet: ElementSnippet): string[] =>
  snippet.attributes
    .filter(({ value, defaultValue }) => value === false && defaultValue === 'true')
    .map(({ source, name }) => source ?? name);

const hasSnippetContent = (snippet: ElementSnippet): boolean =>
  snippet.attributes.length > 0 ||
  snippet.cssProperties.length > 0 ||
  snippet.listeners.length > 0 ||
  snippet.slots.length > 0 ||
  snippet.styleRules.length > 0;

const listenerHandler = (node: t.Node): string => {
  const unwrapped = t.isExpression(node) ? unwrapExpression(node) : node;
  return t.isFunction(unwrapped) ? sourceOf(node) : '() => {}';
};

const incompleteList = (names: string[], suffix: string): string | undefined =>
  names.length === 0
    ? undefined
    : `Incomplete snippet: ${suffix}: ${names.map((name) => `\`${name}\``).join(', ')}.`;

const joinWarnings = (parts: (string | undefined)[]): { warning?: string } => {
  const warning = [...new Set(parts.filter((part) => part !== undefined))].join('\n');
  return warning === '' ? {} : { warning };
};
