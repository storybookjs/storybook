import type { types as t } from 'storybook/internal/babel';
import type { ResolvedMetaComponent } from 'storybook/internal/common';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import type { CsfFile } from 'storybook/internal/csf-tools';
import {
  extractStoryJSDocInfo,
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

import { resolveMetaComponent } from './resolve-component.ts';
import type { AngularComponentTemplate } from './template-snippet.ts';
import { generateAngularSnippet } from './template-snippet.ts';

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
}

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

  const metaArgs = metaArgsRecord(csf._metaNode);

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
        snippet: generateAngularSnippet({
          component,
          // Not meta-specific: the helper reads the `args` property of any CSF config object.
          args: mergeArgsRecords(metaArgs, metaArgsRecord(storyConfig(csf, exportName))),
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

/** The config object a story declares, when it declares one. */
const storyConfig = (csf: CsfFile, exportName: string): t.ObjectExpression | undefined => {
  const declaration = csf._storyDeclarationPath[exportName];
  const normalized = declaration ? normalizeStoryDeclaration(declaration) : undefined;
  return normalized?.type === 'config' ? normalized.path.node : undefined;
};
