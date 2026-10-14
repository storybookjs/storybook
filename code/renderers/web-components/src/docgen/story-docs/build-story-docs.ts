import type { NodePath } from 'storybook/internal/babel';
import { traverse, types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type {
  CsfFile,
  RenderFunctionPath,
  StoryArgsResolver,
  StoryReferences,
} from 'storybook/internal/csf-tools';
import {
  argCode,
  authoredSource,
  createStoryArgsResolver,
  createStoryReferenceResolver,
  extractStoryJSDocInfo,
  fillWithStoryArgs,
  noSnippetWarning,
  sourceOf,
  unwrapExpression,
  unresolvedWarning,
} from 'storybook/internal/csf-tools';
import { hasHoleBracket } from 'storybook/internal/docs-tools';
import type {
  Args,
  StoryDoc,
  StoryDocsPayload,
  StoryDocsProviderInput,
} from 'storybook/internal/types';

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
import type { LiveTemplate } from './story-template.ts';
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
  argCode?: Record<string, string>;
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
    ...(result.template === undefined
      ? {}
      : { template: result.template, argCode: result.argCode }),
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
      render.kind === 'resolved' ? liveTemplate(render.path, resolveStoryArgs.ctx) : undefined;
    return withTemplate({ warning }, live, resolved, resolveStoryArgs.ctx);
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
    render.kind === 'resolved' ? liveTemplate(render.path, deps.resolveStoryArgs.ctx) : undefined;
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
      return withTemplate(own, live, resolved, deps.resolveStoryArgs.ctx);
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
    const element = { template: args.template, listeners: [], free: [] };
    return withTemplate(own, element, resolved, deps.resolveStoryArgs.ctx, [args.templateWarning]);
  }
  return withTemplate(own, live, resolved, deps.resolveStoryArgs.ctx);
};

/**
 * The story's template, if any, and as its static snippet the template filled with the args the
 * story is written with. Where the story spreads args the file cannot read, or the filler cannot
 * print an arg, the static snippet is the one the story has without a template, with its warning.
 */
const withTemplate = (
  own: SnippetResult,
  live: LiveTemplate | undefined,
  resolved: ResolvedStoryArgs,
  ctx: StoryArgsResolver['ctx'],
  warnings: (string | undefined)[] = []
): SnippetResult => {
  if (!live) {
    return own;
  }
  const code = argCode(resolved.args);
  // The args the filler reads.
  const printed = new Set<string>();
  const reads = (args: Args) =>
    new Proxy(args, {
      get: (target, name) => {
        if (typeof name === 'string' && name !== '') {
          printed.add(name);
        }
        return Reflect.get(target, name);
      },
    });
  let snippet: string | undefined;
  try {
    snippet = fillWithStoryArgs(live.template, resolved.args, (template, args) =>
      fillTemplate(template, reads(args))
    );
  } catch {
    // The static snippet is the one the story has without a template.
  }
  // The args it prints as their code, whose names the story file binds the snippet has to declare.
  const written = [...printed].filter((name) => name in code);
  // A spread of args the file cannot read may set an arg the snippet prints.
  const unknown =
    resolved.unresolved.length > 0 && [...printed].some((name) => !(name in resolved.args));
  const free = new Set([
    ...live.free,
    ...written.flatMap((name) =>
      freeNames(resolved.args[name]!).filter((free) => ctx.program.scope.getBinding(free))
    ),
  ]);
  const { warning } = joinWarnings([
    ...warnings,
    incompleteList(live.listeners, 'listeners not shown'),
    incompleteList([...free], 'names the snippet does not import or declare'),
  ]);
  // What the file cannot read, but for the names the warning names already.
  const unread = unresolvedWarning(resolved.unresolved.filter((source) => !free.has(source)));
  return {
    ...(snippet === undefined || unknown ? own : { snippet, ...joinWarnings([unread, warning]) }),
    template: live.template,
    argCode: code,
    ...(warning === undefined ? {} : { templateWarning: warning }),
  };
};

// The names code reads from outside itself, such as `ITEMS` or `fn`, but for ES globals.
const freeNames = (node: t.Node): string[] => {
  const names: string[] = [];
  const expression = t.isObjectMethod(node) ? t.objectExpression([node]) : node;
  if (t.isExpression(expression)) {
    // A clone, so the traversal binds no scope to the story file's own nodes.
    traverse(t.file(t.program([t.expressionStatement(t.cloneNode(expression, true))])), {
      ReferencedIdentifier(path) {
        if (!path.scope.hasBinding(path.node.name)) {
          names.push(path.node.name);
        }
      },
    });
  }
  return names;
};

// A render function from another file is read in the code of that file.
const liveTemplate = (
  render: RenderFunctionPath,
  ctx: StoryArgsResolver['ctx']
): LiveTemplate | undefined => {
  const program = render.findParent((path) => path.isProgram()) as NodePath<t.Program>;
  const filePath =
    program.node === ctx.program.node
      ? ctx.filePath
      : (program.hub as unknown as { file: { opts: { filename: string } } }).file.opts.filename;
  return litTemplate(render, templateModule({ program, filePath }, ctx.resolveModule));
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
    Object.keys(args),
    argTypes ?? {},
    declaration,
    Object.keys(args).filter((key) => evaluateArgValue(args[key]!).kind === 'function')
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
