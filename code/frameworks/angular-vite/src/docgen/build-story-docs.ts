import { type NodePath, generate, types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile } from 'storybook/internal/csf-tools';
import {
  argsRecordFromObjectPath,
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
import { join, resolve } from 'node:path';

import type { CompodocJson, CompodocParsingLogger } from '@storybook/angular-compodoc';
import { extractArgTypesFromData, htmlToText } from '@storybook/angular-compodoc';
import { DOCUMENTATION_JSON } from '../compodoc-config.ts';
import { findCompodocEntry } from './build-docgen.ts';
import { resolveMetaComponent } from './resolve-component.ts';
import type { AngularComponentTemplate } from './template-snippet.ts';
import { generateAngularSnippet } from './template-snippet.ts';

export interface BuildStoryDocsContext {
  /**
   * Directory a story index `importPath` resolves against. This is the index generator's own
   * working directory, which is the Storybook process cwd - deliberately not Compodoc's
   * `workspaceRoot`, which the Angular builder can report as a different directory entirely.
   */
  storyRoot: string;
  /** Directory Compodoc's relative `file` paths resolve against. */
  workspaceRoot: string;
  /** Directory Compodoc writes {@link DOCUMENTATION_JSON} into. */
  outputDir: string;
  readDocumentationJson: (path: string) => CompodocJson;
  logger: CompodocParsingLogger;
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

/** Story's own `args` object, as a path so the shared CSF helper can read it. */
const storyArgsPath = (
  config: NodePath<t.ObjectExpression> | undefined
): NodePath<t.ObjectExpression> | undefined =>
  config
    ?.get('properties')
    .filter((property) => property.isObjectProperty())
    .filter((property) => keyOf(property.node) === 'args')
    .map((property) => property.get('value'))
    .find((value) => value.isObjectExpression());

/**
 * The component's selector and binding names, from its Compodoc entry. `extractArgTypesFromData`
 * already resolves a `model()` into an input plus a `${name}Change` output.
 */
const resolveComponentTemplate = (
  csf: CsfFile,
  storyPath: string,
  context: BuildStoryDocsContext
): AngularComponentTemplate | undefined => {
  const resolved = resolveMetaComponent(csf, storyPath);
  if ('reason' in resolved) {
    context.logger.debug(`No Angular component resolved from ${storyPath}: ${resolved.reason}.`);
    return undefined;
  }

  const documentationJson = join(context.outputDir, DOCUMENTATION_JSON);
  let compodocJson: CompodocJson;
  try {
    compodocJson = context.readDocumentationJson(documentationJson);
  } catch (error) {
    context.logger.debug(
      `Could not read ${documentationJson}: ${error instanceof Error ? error.message : String(error)}.`
    );
    return undefined;
  }

  const entry = findCompodocEntry(compodocJson, resolved.component, context.workspaceRoot);
  if (!entry) {
    context.logger.debug(
      `Compodoc has no entry for "${resolved.component.exportName}" (${storyPath}).`
    );
    return undefined;
  }

  const argTypes = extractArgTypesFromData(entry, {
    compodocJson,
    // Snippets bind inputs and outputs, which this flag never filters.
    filterNonInputControls: false,
    logger: context.logger,
    unwrapHtml: htmlToText,
  });

  const named = (category: string) =>
    Object.entries(argTypes ?? {})
      .filter(([, argType]) => argType?.table?.category === category)
      .map(([name]) => name);

  return {
    name: entry.name ?? resolved.component.exportName,
    selector: entry.selector,
    inputs: named('inputs'),
    outputs: named('outputs'),
  };
};

/**
 * Static Angular template snippets for one CSF story file.
 *
 * `undefined` means the file is not ours to handle - unparseable, no `meta.component`, or no
 * Compodoc entry. A story whose snippet fails instead carries an `error` while the rest of the file
 * still ships; the two levels are deliberately distinct.
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

  const component = resolveComponentTemplate(csf, storyPath, context);
  if (!component) {
    return undefined;
  }

  const metaNode = csf._metaNode;
  const metaArgs = metaArgsRecord(metaNode);
  const metaTemplate = userTemplate(metaNode);
  const metaUnresolved = unresolvableProperties(metaNode);

  const stories: StoryDocsById = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    const name = story.name ?? storyNameFromExport(exportName);
    try {
      const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[exportName]);
      stories[story.id] = {
        id: story.id,
        name,
        description,
        summary,
        snippet: buildSnippet(csf, exportName, {
          component,
          metaArgs,
          metaTemplate,
          metaUnresolved,
        }),
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
    stories,
  };
};

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
): string => {
  const declaration = csf._storyDeclarationPath[exportName];
  const normalized = declaration ? normalizeStoryDeclaration(declaration) : undefined;
  const config = normalized?.type === 'config' ? normalized.path : undefined;

  // A CSF2 story is the render function itself, and Angular's idiom is to return `{ template }`
  // from it. Ignoring that would replace the user's markup with a fabricated element.
  const storyFnTemplate =
    normalized?.type === 'fn'
      ? templateFrom(propertyValue(returnedObject(normalized.path.node), 'template'))
      : undefined;

  const template = userTemplate(config?.node) ?? storyFnTemplate ?? file.metaTemplate;
  if (template?.kind === 'literal') {
    return template.markup;
  }

  const argsPath = storyArgsPath(config);
  return generateAngularSnippet({
    component: file.component,
    args: mergeArgsRecords(file.metaArgs, argsRecordFromObjectPath(argsPath)),
    unresolvedArgs: [
      ...(template ? [template.source] : []),
      ...file.metaUnresolved,
      ...unresolvableProperties(config?.node),
    ],
  });
};
