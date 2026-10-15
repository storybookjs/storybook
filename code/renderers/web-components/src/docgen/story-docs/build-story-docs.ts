import { type NodePath, traverse, types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile, StoryArgsResolver, StoryReferences } from 'storybook/internal/csf-tools';
import {
  authoredSource,
  createStoryArgsResolver,
  createStoryReferenceResolver,
  extractStoryJSDocInfo,
  fillStoryTemplate,
  noSnippetWarning,
  sourceOf,
  unresolvedWarning,
  unwrapExpression,
} from 'storybook/internal/csf-tools';
import { hole, holeWord } from 'storybook/internal/docs-tools';
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
import { classifyArg } from './classify-args.ts';
import { printRootListenerScript } from './print-element.ts';
import { fillTemplate } from '../../docs/fill-template.ts';
import { printHtml } from './html-tree.ts';
import { ownFill, printHtmlTemplate } from './template-print.ts';
import { TEMPLATE_TAG_SOURCES, resolveHtmlTemplate } from './template-scope.ts';
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
      authoredSnippetFactory(csf, storyFilePath, () => ({ warning: NO_COMPONENT_WARNING })),
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
    : authoredSnippetFactory(csf, storyFilePath, () => ({
        warning: `No static snippet: ${
          docgenPayload.error?.message ??
          'no Custom Elements Manifest declaration for this component.'
        }`,
      }));

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
  fallback: AuthoredFallback
): ((exportName: string) => SnippetResult) => {
  const resolveStoryArgs = createStoryArgsResolver(csf, storyReferences(storyFilePath));
  return (exportName) => authoredOrFallback(exportName, resolveStoryArgs, fallback);
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
  const render = resolveEffectiveRender(deps.csf, exportName, deps.resolveStoryArgs.ctx);
  const ctx = deps.resolveStoryArgs.ctx;
  if (render.kind === 'resolved') {
    const template = resolveHtmlTemplate(render.path, deps.csf);
    if (template) {
      // Next prints the html the render returns, with a hole wherever it prints an arg.
      const printed = printHtmlTemplate(template, resolved.args, deps.declaration);
      const unresolved = [...resolved.unresolved, ...printed.unresolved];
      const incomplete = [
        incompleteList(printed.properties, 'properties without an attribute'),
        incompleteList(printed.falseDefaults ?? [], 'false values that HTML cannot express'),
        incompleteList(printed.listenersNotShown ?? [], 'listeners not shown'),
        unboundTemplateArgs(resolved.args, printed.referenced),
      ];
      // As next, no snippet when it prints nothing and leaves out code it cannot read.
      if (printed.template === '' && (unresolved.length > 0 || printed.properties.length > 0)) {
        return joinWarnings([
          unresolvedWarning(unresolved),
          ...incomplete,
          noSnippetWarning(unresolved),
        ]);
      }
      const { warning } = joinWarnings([unresolvedWarning(printed.unresolved), ...incomplete]);
      return withTemplate({ warning }, printed.template, resolved, ctx, warning);
    }
  }

  // Without a lit template it reads, next's printer writes the element with the args on it.
  const element = argsElement(
    resolved.args,
    deps.declaration,
    deps.docgenPayload.argTypes ?? {},
    deps.tag
  );
  const { warning } = joinWarnings([
    unresolvedWarning(
      render.kind === 'resolved'
        ? [sourceOf(render.path.node)]
        : render.kind === 'unresolved'
          ? unresolvedRenderSource(render, resolved)
          : []
    ),
    element.warning,
  ]);
  // As next, no snippet when it shows none of the args and the story has args it cannot read.
  const unread = [...resolved.unresolved, ...element.unread];
  return !element.printed && unread.length > 0
    ? joinWarnings([warning, noSnippetWarning(unread)])
    : withTemplate({ warning }, element.template, resolved, ctx, warning);
};

/**
 * The story's template, and as its static snippet the template filled with the args the story is
 * written with, with the `incomplete` warning of code the template leaves out. Where the filler
 * cannot print an arg, the story has neither.
 */
const withTemplate = (
  own: SnippetResult,
  template: string,
  resolved: ResolvedStoryArgs,
  ctx: StoryArgsResolver['ctx'],
  incomplete?: string
): SnippetResult => {
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
  const filled = fillStoryTemplate(template, resolved.args, (text, args) =>
    fillTemplate(text, reads(args))
  );
  if (!filled) {
    return own;
  }
  const code = filled.argCode;
  // The args it prints as their code, whose names the story file binds the snippet has to declare.
  const written = [...printed].filter((name) => Object.hasOwn(code, name));
  const free = new Set(
    written.flatMap((name) =>
      freeNames(resolved.args[name]!).filter((free) => {
        const declared = ctx.program.scope.getBinding(free)?.path;
        return declared && !isLitImport(declared);
      })
    )
  );
  const { warning } = joinWarnings([
    incompleteList([...free], 'names the snippet does not import or declare'),
  ]);
  // What the file cannot read, but for the names the warning names already.
  const unread = unresolvedWarning(resolved.unresolved.filter((source) => !free.has(source)));
  // The warning hangs on the args the fill printed, so it is known only after it.
  return {
    snippet: filled.snippet,
    ...joinWarnings([incomplete, unread, warning]),
    template: filled.template,
    argCode: code,
    ...(warning === undefined ? {} : { templateWarning: warning }),
  };
};

/** Whether a name is declared by an import from lit, which a lit snippet has. */
const isLitImport = (declared: NodePath) =>
  !!declared.parentPath?.isImportDeclaration() &&
  TEMPLATE_TAG_SOURCES.includes(declared.parentPath.node.source.value);

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

/**
 * The element with the story's args on it, as next prints it, with a hole wherever it prints an
 * arg: an attribute, a custom property in its `style`, a slot as its content, and a part or state
 * in a `<style>` before it. A listener the story writes is a script after it, as written, as no
 * control sets it. Next leaves out a property without an attribute, a method and an arg the
 * element does not declare, and the warning names those the story sets. `printed` is whether it
 * shows a value of the story's args, and `unread` the code of those it shows that next cannot read.
 */
const argsElement = (
  args: Record<string, t.Node>,
  declaration: ManifestDeclaration,
  argTypes: WebComponentsDocgenPayload['argTypes'],
  tag: string
): { template: string; printed: boolean; unread: string[]; warning?: string } => {
  const attributes = new Map<string, string>();
  const [css, slots, styles]: string[][] = [[], [], []];
  const listeners: { event: string; handler: string }[] = [];
  const [inexpressible, falseDefaults, properties, unknown]: string[][] = [[], [], [], []];
  const unread: string[] = [];
  let printed = false;
  for (const key of new Set([...Object.keys(args), ...Object.keys(argTypes ?? {})])) {
    const value = Object.hasOwn(args, key)
      ? evaluateArgValue(args[key]!)
      : ({ kind: 'unset' } as const);
    const set = value.kind !== 'unset';
    const binding = classifyArg(key, value.kind === 'function', argTypes ?? {}, declaration);
    const word = holeWord(key);
    switch (binding.kind) {
      case 'listener':
        if (set && binding.event) {
          listeners.push({ event: binding.event, handler: listenerHandler(args[key]!) });
        } else if (set) {
          inexpressible.push(key);
        }
        break;
      case 'property':
        properties.push(...(set ? [key] : []));
        break;
      case 'unknown':
        unknown.push(...(set ? [key] : []));
        break;
      case 'method':
        break;
      case 'attribute':
        // As next, the last arg the story sets for an attribute is its value.
        if (set || !attributes.has(binding.name)) {
          const field = binding.viaField ? ['field'] : [];
          attributes.set(binding.name, hole('attr', holeWord(binding.name), word, ...field));
        }
        if (value.kind === 'value' && value.value === false && binding.defaultValue === 'true') {
          falseDefaults.push(key);
        }
        break;
      case 'cssProperty':
        css.push(holeWord(`${binding.name}=${key}`));
        break;
      case 'slot':
        slots.push(hole('slot', holeWord(binding.name), word));
        break;
      case 'cssPart':
        styles.push(holeWord(`::part(${binding.name})=${key}`));
        break;
      case 'cssState':
        styles.push(holeWord(`:state(${binding.name})=${key}`));
        break;
      default: {
        const exhaustive: never = binding;
        return exhaustive;
      }
    }
    const shown =
      binding.kind === 'listener'
        ? binding.event !== undefined
        : !['property', 'unknown', 'method'].includes(binding.kind);
    printed ||= shown && (binding.kind === 'listener' ? set : value.kind === 'value');
    unread.push(...(shown && value.kind === 'unresolved' ? [value.source] : []));
  }
  const style = styles.length > 0 ? hole('style', holeWord(tag), ...styles) : '';
  const custom = css.length > 0 ? [['style', hole('css', ...css)] as const] : [];
  // Laid out as next lays out the element with the story's own args.
  const element = printHtml(
    [
      {
        attributes: [...attributes, ...custom].map(([name, hole]) => ({
          hole,
          name,
          value: undefined,
        })),
        children: slots.map((text) => ({ kind: 'text', text })),
        closed: true,
        kind: 'element',
        name: tag,
        selfClosing: false,
      },
    ],
    ownFill(args)
  );
  const script = printRootListenerScript(listeners);
  return {
    template: `${style}${element}${script ? `\n${script}` : ''}`,
    printed,
    unread,
    ...joinWarnings([
      incompleteList(inexpressible, 'listeners the HTML snippet cannot express'),
      incompleteList(falseDefaults, 'false values that HTML cannot express'),
      incompleteList(properties, 'properties without an attribute'),
      incompleteList(unknown, `args not declared by \`${tag}\``),
    ]),
  };
};

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
