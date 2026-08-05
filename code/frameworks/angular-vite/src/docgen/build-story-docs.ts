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
  /** Directory story `importPath`s and Compodoc's relative `file` paths resolve against. */
  workspaceRoot: string;
  /** Directory Compodoc writes {@link DOCUMENTATION_JSON} into. */
  outputDir: string;
  readDocumentationJson: (path: string) => CompodocJson;
  logger: CompodocParsingLogger;
}

/** Compodoc records a component's selector, but its published types omit the field. */
type WithSelector<T> = T & { selector?: string };

/** `args` object of a CSF config object expression. */
const argsObjectNode = (config?: t.ObjectExpression): t.ObjectExpression | undefined => {
  const property = config?.properties.find(
    (candidate): candidate is t.ObjectProperty =>
      t.isObjectProperty(candidate) && keyOf(candidate) === 'args'
  );
  return property && t.isObjectExpression(property.value) ? property.value : undefined;
};

/** Source text of every spread in an `args` object; those values cannot be resolved statically. */
const spreadSources = (args?: t.ObjectExpression): string[] =>
  (args?.properties ?? [])
    .filter((property): property is t.SpreadElement => t.isSpreadElement(property))
    .map((property) => generate(property, { concise: true, comments: false }).code);

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

/**
 * The template markup a `template` property holds. `null` and `undefined` do not count, matching
 * the preview's rule that an empty string is still a user-defined template.
 */
const templateFrom = (node: t.Node | undefined): string | undefined => {
  if (
    node === undefined ||
    t.isNullLiteral(node) ||
    (t.isIdentifier(node) && node.name === 'undefined')
  ) {
    return undefined;
  }
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? '';
  }
  return generate(node, { concise: true, comments: false }).code;
};

/**
 * The template a story or meta supplies itself, including the `render: () => ({ template })` form
 * Angular stories use.
 */
const userTemplate = (config: t.ObjectExpression | undefined): string | undefined =>
  templateFrom(
    propertyValue(config, 'template') ??
      propertyValue(returnedObject(propertyValue(config, 'render')), 'template')
  );

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
 * The component's selector and binding names, from its Compodoc entry.
 *
 * `extractArgTypesFromData` is what already knows how to read Compodoc's members - including that a
 * name appearing in both `inputsClass` and `outputsClass` is an Angular `model()` whose output is
 * `${name}Change` - so the discrimination is shared rather than reimplemented here.
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
    // Snippets bind inputs and outputs, which this flag never removes; it only hides the
    // properties and methods a snippet has no use for.
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
    selector: (entry as WithSelector<typeof entry>).selector,
    inputs: named('inputs'),
    outputs: named('outputs'),
  };
};

/**
 * Builds a {@link StoryDocsPayload} of static Angular template snippets for one CSF story file.
 *
 * Returns `undefined` when the file is unusable - not a story file, unparseable, no
 * `meta.component`, or no Compodoc entry for that component - which is the contract's "not mine,
 * fall through". A story whose snippet cannot be generated instead carries an `error` while the
 * rest of the file still ships; the two levels are different and must not be collapsed.
 */
export const buildStoryDocsPayload = (
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext
): StoryDocsPayload | undefined => {
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }

  const storyPath = resolve(context.workspaceRoot, storyImportPath);
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
  const metaSpreads = spreadSources(argsObjectNode(metaNode));

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
          metaSpreads,
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
    metaTemplate: string | undefined;
    metaSpreads: string[];
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
  if (template !== undefined) {
    return template;
  }

  const argsPath = storyArgsPath(config);
  return generateAngularSnippet({
    component: file.component,
    args: mergeArgsRecords(file.metaArgs, argsRecordFromObjectPath(argsPath)),
    unresolvedArgs: [...file.metaSpreads, ...spreadSources(argsPath?.node)],
  });
};
