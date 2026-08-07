import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { genImport } from 'knitwork';

import {
  STORY_FILE_TEST_REGEXP,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
} from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import {
  collectImportBindings,
  extractStoryJSDocInfo,
  keyOf,
  loadCsf,
  metaObjectPath,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

interface BuildStoryDocsContext {
  /** Resolve a CSF import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
}

type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;

const COMPONENT_PROPERTY = 'component';

/**
 * Builds Vue story-docs metadata without snippets so runtime source fallback remains authoritative.
 */
export async function buildStoryDocsPayload(
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext = {}
): Promise<StoryDocsPayload | undefined> {
  const storyFilePath = getStoryImportPathFromEntry(input.entry);
  if (!storyFilePath || !STORY_FILE_TEST_REGEXP.test(storyFilePath)) {
    return undefined;
  }

  const resolvePath =
    context.resolvePath ??
    ((importPath: string): string =>
      isAbsolute(importPath) ? importPath : join(process.cwd(), importPath));
  const storyPath = resolvePath(storyFilePath);

  let storyFile: string;
  try {
    storyFile = await readFile(storyPath, 'utf8');
  } catch {
    return undefined;
  }

  let csf: ParsedCsf;
  try {
    csf = loadCsf(storyFile, { makeTitle: () => input.entry.title }).parse();
  } catch {
    return undefined;
  }

  const componentName = csf._meta?.component;
  const importStatement = createImportStatement(csf);

  return {
    id: getComponentIdFromEntry(input.entry),
    name: componentName ?? fallbackTitle(input.entry.title),
    path: storyFilePath,
    ...(importStatement ? { import: importStatement } : {}),
    stories: extractStories(csf),
  };
}

/** Last title segment matches the fallback used by the existing docgen payload builder. */
function fallbackTitle(title: string): string {
  return title.split('/').at(-1)!.replace(/\s+/g, '');
}

function resolveMetaComponentIdentifier(csf: ParsedCsf): string | undefined {
  const metaPath = metaObjectPath(csf);
  const componentProperty = metaPath
    ?.get('properties')
    .find((property) => property.isObjectProperty() && keyOf(property.node) === COMPONENT_PROPERTY);

  if (!componentProperty?.isObjectProperty()) {
    return undefined;
  }

  const value = componentProperty.get('value');
  return value.isIdentifier() ? value.node.name : undefined;
}

function createImportStatement(csf: ParsedCsf): string | undefined {
  const componentName = resolveMetaComponentIdentifier(csf);
  if (!componentName) {
    return undefined;
  }

  const binding = collectImportBindings(csf._file.path).get(componentName);
  // Namespace imports should never reach here
  if (!binding || binding.importName === '*') {
    return undefined;
  }

  const specifier =
    binding.importName === 'default'
      ? componentName
      : [{ name: binding.importName, as: componentName }];
  return genImport(binding.importId, specifier, { singleQuotes: true });
}

function extractStories(csf: ParsedCsf): Record<string, StoryDoc> {
  return Object.fromEntries(
    Object.entries(csf._stories).map(([storyExport, story]): [string, StoryDoc] => {
      const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[storyExport]);
      return [
        story.id,
        {
          id: story.id,
          name: story.name ?? storyNameFromExport(storyExport),
          description,
          summary,
        },
      ];
    })
  );
}
