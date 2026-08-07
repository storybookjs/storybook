import { generate, types as t } from 'storybook/internal/babel';
import type { ResolvedMetaComponent } from 'storybook/internal/common';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile } from 'storybook/internal/csf-tools';
import {
  extractStoryJSDocInfo,
  keyOf,
  loadCsf,
  mergeArgsRecords,
  metaArgsRecord,
  normalizeStoryDeclaration,
} from 'storybook/internal/csf-tools';
import type {
  StoryDocsById,
  StoryDocsPayload,
  StoryDocsProviderInput,
} from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AngularHostContext } from './component-snippet.ts';
import { angularHostComponent, angularHostImports } from './component-snippet.ts';
import { resolveMetaComponent } from './resolve-component.ts';
import type { AngularComponentTemplate } from './template-snippet.ts';
import { generateAngularSnippet } from './template-snippet.ts';
import type { SnippetFormat } from '../types.ts';

/** Preserves what the browser generator produces, so `component` stays an opt-in. */
export const DEFAULT_SNIPPET_FORMAT: SnippetFormat = 'template';

/**
 * The selector and binding names a snippet is built from, for one component.
 *
 * Which engine produced them is deliberately not expressed here. Compodoc is one source; an
 * in-process Angular component meta service is another, and swapping between them must not reach
 * into snippet generation.
 */
export type AngularComponentResolver = (
  component: ResolvedMetaComponent
) => AngularComponentTemplate | undefined;

/** The slice of the logger this module uses. */
export interface StoryDocsLogger {
  debug: (message: string) => void;
}

export interface BuildStoryDocsContext {
  /**
   * Directory a story index `importPath` resolves against. This is the index generator's own
   * working directory, which is the Storybook process cwd.
   */
  storyRoot: string;
  resolveComponent: AngularComponentResolver;
  logger: StoryDocsLogger;
  /** Shape of the emitted snippet. Defaults to {@link DEFAULT_SNIPPET_FORMAT}. */
  snippetFormat?: SnippetFormat;
}

/** `args` object of a CSF config object expression. */
const argsObjectNode = (config?: t.ObjectExpression): t.ObjectExpression | undefined => {
  const value = propertyValue(config, 'args');
  return t.isObjectExpression(value) ? value : undefined;
};

const sourceOf = (node: t.Node): string => generate(node, { concise: true, comments: false }).code;

/**
 * Source text of everything a static pass cannot read - spreads, computed keys, methods - in a
 * story or meta config and in its `args`. A spread at the config level carries args just as
 * invisibly as one inside `args`.
 */
const unresolvableProperties = (config?: t.ObjectExpression): string[] =>
  [config, argsObjectNode(config)].flatMap((object) =>
    (object?.properties ?? [])
      .filter((property) => !t.isObjectProperty(property) || keyOf(property) === null)
      .map(sourceOf)
  );

/** Value of a config object's own property, if it has one. */
const propertyValue = (config: t.ObjectExpression | undefined, name: string): t.Node | undefined =>
  config?.properties.find(
    (candidate): candidate is t.ObjectProperty =>
      t.isObjectProperty(candidate) && keyOf(candidate) === name
  )?.value;

/** Object literal a story or `render` function returns, when it returns one directly. */
const returnedObject = (fn: t.Node | undefined): t.ObjectExpression | undefined => {
  if (
    !t.isArrowFunctionExpression(fn) &&
    !t.isFunctionExpression(fn) &&
    !t.isFunctionDeclaration(fn)
  ) {
    return undefined;
  }
  if (t.isObjectExpression(fn.body)) {
    return fn.body;
  }
  const returned = t.isBlockStatement(fn.body)
    ? fn.body.body.find((statement): statement is t.ReturnStatement =>
        t.isReturnStatement(statement)
      )?.argument
    : undefined;
  return t.isObjectExpression(returned) ? returned : undefined;
};

/** What a `template` property turned out to be. */
type TemplateResult =
  /** Read as markup, so the story is passed through as written. */
  | { kind: 'literal'; markup: string }
  /** A `template` or `render` exists but its markup is not knowable without running the story. */
  | { kind: 'unresolvable'; source: string };

/**
 * Markup a `template` property holds. `null` and `undefined` are not templates, but an empty string
 * is, matching the preview's own rule. A non-literal is reported rather than printed, so JavaScript
 * source never lands in the Source block where markup is expected.
 */
const templateFrom = (node: t.Node | undefined): TemplateResult | undefined => {
  if (
    node === undefined ||
    t.isNullLiteral(node) ||
    (t.isIdentifier(node) && node.name === 'undefined')
  ) {
    return undefined;
  }
  if (t.isStringLiteral(node)) {
    return { kind: 'literal', markup: node.value };
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return { kind: 'literal', markup: node.quasis[0]?.value.cooked ?? '' };
  }
  return { kind: 'unresolvable', source: sourceOf(node) };
};

/**
 * The template a story or meta supplies itself, including the `render: () => ({ template })` form
 * Angular stories use. A `render` this cannot read into an object literal may still produce markup,
 * so it counts as unresolvable rather than being replaced by generated bindings.
 */
const userTemplate = (config: t.ObjectExpression | undefined): TemplateResult | undefined => {
  const own = templateFrom(propertyValue(config, 'template'));
  if (own) {
    return own;
  }
  const render = propertyValue(config, 'render');
  if (!render) {
    return undefined;
  }
  const returned = returnedObject(render);
  return returned
    ? templateFrom(propertyValue(returned, 'template'))
    : { kind: 'unresolvable', source: `render: ${sourceOf(render)}` };
};

/**
 * How the host wrapper names and imports the component. A default import has no export name worth
 * printing, so the story file's own local name is the only one available.
 */
const hostContext = (
  ref: ResolvedMetaComponent,
  component: AngularComponentTemplate
): AngularHostContext => ({
  componentName: ref.exportName === 'default' ? ref.localName : ref.exportName,
  importId: ref.importId,
  defaultImport: ref.exportName === 'default',
  outlet: !component.selector,
});

/**
 * Static Angular template snippets for one CSF story file.
 *
 * `undefined` means the file is not ours to handle - unparseable, no `meta.component`, or a
 * component the docgen engine has nothing for. A story whose snippet fails instead carries an
 * `error` while the rest of the file still ships; the two levels are deliberately distinct.
 */
export const buildStoryDocsPayload = (
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext
): StoryDocsPayload | undefined => {
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }

  const storyPath = resolve(context.storyRoot, storyImportPath);
  let csf: CsfFile;
  try {
    csf = loadCsf(readFileSync(storyPath, 'utf8'), { makeTitle: () => input.entry.title }).parse();
  } catch (error) {
    context.logger.debug(
      `Could not parse ${storyPath}: ${error instanceof Error ? error.message : String(error)}.`
    );
    return undefined;
  }

  const ref = resolveMetaComponent(csf, storyPath);
  if ('reason' in ref) {
    context.logger.debug(`No Angular component resolved from ${storyPath}: ${ref.reason}.`);
    return undefined;
  }

  const component = context.resolveComponent(ref.component);
  if (!component) {
    return undefined;
  }
  const host = hostContext(ref.component, component);
  const format = context.snippetFormat ?? DEFAULT_SNIPPET_FORMAT;

  const metaNode = csf._metaNode;
  const metaArgs = metaArgsRecord(metaNode);
  const metaTemplate = userTemplate(metaNode);
  const metaUnresolved = unresolvableProperties(metaNode);

  const stories: StoryDocsById = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    const name = story.name ?? storyNameFromExport(exportName);
    try {
      const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
      const { snippet, warning, handlers } = buildSnippet(csf, exportName, {
        component,
        metaArgs,
        metaTemplate,
        metaUnresolved,
      });
      stories[story.id] = {
        id: story.id,
        name,
        description,
        summary,
        snippet: format === 'component' ? angularHostComponent(snippet, handlers, host) : snippet,
        warning,
      };
    } catch (error) {
      stories[story.id] = {
        id: story.id,
        name,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: 'Error', message: String(error) },
      };
    }
  }

  return {
    id: getComponentIdFromEntry(input.entry),
    name: component.name,
    path: storyImportPath,
    ...(format === 'component' ? { import: angularHostImports(host) } : {}),
    stories,
  };
};

/** What a story's snippet turned out to be, plus what the host component needs to render it. */
interface SnippetResult {
  snippet: string;
  /** Set when the snippet is an incomplete example. */
  warning?: string;
  /** Output names the snippet binds, which the host class has to declare methods for. */
  handlers: readonly string[];
}

/** Snippet for one story: the template it supplies itself, or one built from its declared args. */
const buildSnippet = (
  csf: CsfFile,
  exportName: string,
  file: {
    component: AngularComponentTemplate;
    metaArgs: Record<string, t.Node>;
    metaTemplate: TemplateResult | undefined;
    metaUnresolved: string[];
  }
): SnippetResult => {
  const config = storyConfig(csf, exportName);

  const template = userTemplate(config.object) ?? config.fnTemplate ?? file.metaTemplate;
  if (template?.kind === 'literal') {
    // Which outputs the story's own markup binds is not knowable, so the host declares none.
    return { snippet: template.markup, handlers: [] };
  }

  const unresolved = [
    ...(template ? [template.source] : []),
    ...file.metaUnresolved,
    ...unresolvableProperties(config.object),
  ];

  return {
    snippet: generateAngularSnippet({
      component: file.component,
      // Not meta-specific: the helper reads the `args` property of any CSF config object.
      args: mergeArgsRecords(file.metaArgs, metaArgsRecord(config.object)),
    }),
    warning: unresolved.length > 0 ? unresolvedWarning(unresolved) : undefined,
    // A component with no selector renders through `*ngComponentOutlet`, which binds nothing.
    handlers: file.component.selector ? file.component.outputs : [],
  };
};

/** Says which source text a static pass could not read, so a reader can see what is missing. */
const unresolvedWarning = (unresolved: readonly string[]): string =>
  `Incomplete snippet: ${unresolved.map((source) => `\`${source}\``).join(', ')} could not be resolved statically.`;

/**
 * A story's own config object, plus the template a CSF2 story returns from its function body.
 *
 * `export { A }` registers a story without a declaration path, because the parser resolves the
 * re-exported binding instead. Its initializer is still recorded, so the config object is reachable
 * either way and a re-exported story keeps its own args rather than silently inheriting the meta's.
 */
const storyConfig = (
  csf: CsfFile,
  exportName: string
): { object?: t.ObjectExpression; fnTemplate?: TemplateResult } => {
  const declaration = csf._storyDeclarationPath[exportName];
  const normalized = declaration ? normalizeStoryDeclaration(declaration) : undefined;

  if (normalized?.type === 'config') {
    return { object: normalized.path.node };
  }
  if (normalized?.type === 'fn') {
    // Angular's CSF2 idiom is to return `{ template }`; ignoring it would replace the user's
    // markup with a fabricated element.
    return {
      fnTemplate: templateFrom(propertyValue(returnedObject(normalized.path.node), 'template')),
    };
  }

  const reExported = csf._storyStatements[exportName];
  return { object: t.isObjectExpression(reExported) ? reExported : undefined };
};
