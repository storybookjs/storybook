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
import { argsTemplate, litTemplate } from './story-template.ts';
import { templateModule } from './template-calls.ts';
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
        ? liveTemplate(render.path, csf, resolveStoryArgs, { tag: '' })
        : undefined;
    return withTemplate({ warning }, live, resolved);
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
  const element = { tag: deps.tag, declaration: deps.declaration };
  const live =
    render.kind === 'resolved'
      ? liveTemplate(render.path, deps.csf, deps.resolveStoryArgs, element)
      : undefined;
  if (render.kind === 'resolved') {
    const template = resolveHtmlTemplate(render.path, deps.csf);
    if (template) {
      const printed = printHtmlTemplate(template, resolved.args, deps.declaration);
      const unresolved = [...resolved.unresolved, ...printed.unresolved];
      warnings.push(unresolvedWarning(unresolved));
      warnings.push(incompleteList(printed.properties, 'properties without an attribute'));
      warnings.push(
        incompleteList(printed.falseDefaults ?? [], 'false values that HTML cannot express')
      );
      warnings.push(incompleteList(printed.listenersNotShown ?? [], 'listeners not shown'));
      warnings.push(unboundTemplateArgs(resolved.args, printed.referenced));
      const hasFailedHole = unresolved.length > 0 || printed.properties.length > 0;
      const hasSnippet = printed.snippet !== '' || !hasFailedHole;
      const own = {
        ...(hasSnippet ? { snippet: printed.snippet } : {}),
        ...joinWarnings(hasSnippet ? warnings : [...warnings, noSnippetWarning(unresolved)]),
      };
      return withTemplate(own, live, resolved);
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
  const own = { ...(args.snippet ? { snippet: args.snippet } : {}), ...joinWarnings(warnings) };
  if (render.kind === 'missing' && args.template) {
    return {
      ...(filledSnippet(args.template, resolved) ?? own),
      template: args.template,
      ...(args.templateWarning ? { templateWarning: args.templateWarning } : {}),
    };
  }
  return withTemplate(own, live, resolved);
};

/**
 * The story's template, if any, and the static snippet it fills to with the args the story file
 * writes. Where the value of an arg the template reads cannot be read, or has no literal, the
 * static snippet is the one the story had without a template, with its warning.
 */
const withTemplate = (
  own: SnippetResult,
  live: LiveTemplate | undefined,
  resolved: ResolvedStoryArgs
): SnippetResult => {
  if (!live) {
    return own;
  }
  const { templateWarning: warning } = templateWarning(live, resolved);
  const filled = filledSnippet(live.template, resolved);
  return {
    ...(filled ? { ...filled, ...joinWarnings([filled.warning, warning]) } : own),
    template: live.template,
    ...(warning === undefined ? {} : { templateWarning: warning }),
  };
};

// The template filled with the args the story file writes, where it can read each one the template
// reads; a spread of args it cannot read may set any arg the template reads by name. The args passed
// whole are the ones it can read, and the warning names the spread.
const filledSnippet = (
  template: string,
  resolved: ResolvedStoryArgs
): SnippetResult | undefined => {
  const read = templateArgs(template);
  const unknown = resolved.unresolved.length > 0;
  const args: Record<string, unknown> = {};
  for (const name of read.all ? Object.keys(resolved.args) : read.names) {
    const node = resolved.args[name];
    const value = node ? evaluateArgValue(node) : { kind: 'unset' as const };
    // The args passed whole hold a function as it is, which the snippet has no literal for.
    if (
      value.kind === 'unresolved' ||
      (!node && unknown) ||
      (read.all && value.kind === 'function')
    ) {
      return undefined;
    }
    // A function the story file writes is a listener, which the static snippet leaves out.
    args[name] =
      value.kind === 'value' ? value.value : value.kind === 'function' ? LISTENER : undefined;
  }
  try {
    return {
      snippet: fillTemplate(template, args),
      ...joinWarnings([unresolvedWarning(resolved.unresolved)]),
    };
  } catch {
    return undefined;
  }
};

// What a filled template still leaves out: the listeners, the args the story sets that no hole
// prints, and the names the snippet would have to import or declare. A function arg, and an arg a
// listener reads, is a listener, which the first list names where the render binds it.
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
            !read.names.has(name) &&
            !live.heard.includes(name) &&
            !['unset', 'function'].includes(evaluateArgValue(node).kind)
        )
        .map(([name]) => name);
  const { warning } = joinWarnings([
    incompleteList(live.listeners, 'listeners not shown'),
    incompleteList(unbound, 'args not bound by the render template'),
    incompleteList(live.free, 'names the snippet does not import or declare'),
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

const liveTemplate = (
  render: RenderFunctionPath,
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
  return litTemplate(render, templateModule({ program, filePath }, ctx.resolveModule), element);
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
