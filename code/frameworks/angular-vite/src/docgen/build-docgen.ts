import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { getRealPath } from 'storybook/internal/mocking-utils';
import type {
  DocgenJsDocTags,
  DocgenPayload,
  DocgenProviderInput,
  StrictArgTypes,
} from 'storybook/internal/types';

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type {
  CompodocEntry,
  CompodocJson,
  CompodocParsingLogger,
  JsDocTag,
} from '@storybook/angular-compodoc';
import { extractArgTypesFromData, htmlToText } from '@storybook/angular-compodoc';
import { DOCUMENTATION_JSON } from '../compodoc-config.ts';
import type { ResolvedMetaComponent } from 'storybook/internal/common';
import { resolveStoryComponent } from './resolve-component.ts';

/**
 * Configuration the `angular-vite` preset hands to the docgen worker.
 *
 * The descriptor's `options` object is structured-cloned onto the worker thread, so every field
 * here must be plain JSON data.
 */
export interface AngularDocgenOptions {
  /** Absolute directory Compodoc writes {@link DOCUMENTATION_JSON} into. */
  outputDir: string;
  /** Compodoc's own argument list. */
  compodocArgs: string[];
  /**
   * Directory Compodoc ran in, which is the base its entries' relative `file` paths are written
   * against.
   */
  workspaceRoot: string;
  /**
   * `features.angularFilterNonInputControls`. Threaded rather than defaulted: hardcoding it would
   * silently give half of all users the opposite of their configured Controls behaviour.
   */
  angularFilterNonInputControls?: boolean;
  /** tsconfig Compodoc scans against. Reported in the "component missing from the scan" message. */
  tsconfig: string;
}

export type AngularDocgenPayload = DocgenPayload & {
  /** The raw Compodoc entry, unfiltered - a few kilobytes per component, mostly `sourceCode`. */
  compodoc?: CompodocEntry;
};

export interface BuildDocgenContext {
  options: AngularDocgenOptions;
  readDocumentationJson: (path: string) => CompodocJson;
  logger: CompodocParsingLogger;
}

/** Compodoc attaches the raw TypeScript JSDoc tag nodes, which its published types omit. */
type WithJsDocTags<T> = T & { jsdoctags?: JsDocTag[] };

/** Compodoc records a source file on every entry, but its published types omit the field. */
type WithFile<T> = T & { file?: string };

/**
 * Rewrites a path into the form both sides of a comparison are held in: absolute, symlinks
 * resolved, forward slashes, no trailing slash. Lowercased on Windows only - NTFS is
 * case-insensitive, but Linux is not, so lowercasing everywhere would collapse `Button.ts` and
 * `button.ts` into one candidate.
 */
const comparablePath = (filePath: string, base?: string): string => {
  const absolute = getRealPath(base ? resolve(base, filePath) : resolve(filePath), true);
  const posix = absolute.replace(/\\/g, '/');
  const trimmed = posix.length > 1 ? posix.replace(/\/+$/, '') : posix;
  return process.platform === 'win32' ? trimmed.toLowerCase() : trimmed;
};

/**
 * Locates the one Compodoc entry that documents a resolved component.
 *
 * Class names are not unique - a stock Angular sandbox has `ButtonComponent` three times, in three
 * files, with different inputs - so the component's source file decides. Name alone is only trusted
 * when exactly one entry in the whole scan carries it; an ambiguous name with no matching file is
 * reported as undocumented rather than answered with another component's props.
 *
 * Lookup is restricted to `components` and `directives`: the shared five-array `findComponentByName`
 * also returns pipes, injectables and plain classes, which carry no `inputsClass`.
 */
export const findCompodocEntry = (
  json: CompodocJson,
  component: Pick<ResolvedMetaComponent, 'exportName' | 'path'>,
  workspaceRoot: string
): CompodocEntry | undefined => {
  const { exportName, path } = component;
  const entries = [...(json.components ?? []), ...(json.directives ?? [])].filter(
    Boolean
  ) as WithFile<CompodocEntry>[];

  if (path) {
    const wanted = comparablePath(path);
    const inFile = entries.filter(
      (entry) =>
        typeof entry.file === 'string' && comparablePath(entry.file, workspaceRoot) === wanted
    );

    // A default-exported class keeps its own name in `documentation.json`, which the story file
    // never mentions, so the file is the only thing left to match on. Compodoc can list one physical
    // file more than once - a symlinked directory yields both a relative and an absolute spelling of
    // the same path - so entries agreeing on the class name are one component, not an ambiguity.
    const onPath =
      exportName === 'default'
        ? namesAgree(inFile)
          ? inFile[0]
          : undefined
        : inFile.find((entry) => entry.name === exportName);
    if (onPath) {
      return onPath;
    }
  }

  if (exportName === 'default') {
    return undefined;
  }

  const byName = entries.filter((entry) => entry.name === exportName);
  return sameComponent(byName, workspaceRoot) ? byName[0] : undefined;
};

/** Whether every entry describes the same class, so picking the first is not a guess. */
const namesAgree = (entries: WithFile<CompodocEntry>[]): boolean =>
  entries.length > 0 && entries.every((entry) => entry.name === entries[0].name);

/** Whether same-named entries are all the same physical file, rather than genuine namesakes. */
const sameComponent = (entries: WithFile<CompodocEntry>[], workspaceRoot: string): boolean => {
  if (entries.length === 0) {
    return false;
  }
  // An entry with no `file` cannot be shown to be the same file as any other, so it stands alone:
  // two file-less namesakes are a genuine ambiguity, not one component listed twice.
  const files = new Set(
    entries.map((entry, index) =>
      typeof entry.file === 'string' ? comparablePath(entry.file, workspaceRoot) : `#${index}`
    )
  );
  return files.size === 1;
};

/**
 * Compodoc's own JSDoc tag nodes, reshaped as the payload's `Record<name, values>`. The description
 * is deliberately not parsed for tags: it is rendered Markdown prose, and an `@Input()` inside a
 * documentation code block would become a fabricated tag.
 */
const extractJsDocTags = (entry: CompodocEntry): DocgenJsDocTags => {
  const tags: DocgenJsDocTags = {};
  for (const tag of (entry as WithJsDocTags<CompodocEntry>).jsdoctags ?? []) {
    const name = tag?.tagName?.escapedText;
    if (!name) {
      continue;
    }
    // Compodoc renders each tag's comment to HTML too, and a tag may legitimately carry none.
    const value = tag.comment === undefined ? '' : htmlToText(tag.comment).trim();
    (tags[name] ??= []).push(value);
  }
  return tags;
};

const errorPayload = (
  base: Pick<DocgenPayload, 'id' | 'name' | 'path'>,
  name: string,
  message: string
): AngularDocgenPayload => ({ ...base, jsDocTags: {}, error: { name, message } });

/**
 * Builds an Angular {@link DocgenPayload} for one story entry from Compodoc's `documentation.json`.
 *
 * Returns `undefined` for "not an Angular component here" (no story import path, no `meta.component`
 * - fall through to the next provider), and a payload carrying `error` for "mine, but extraction
 * failed". The two are different and callers must not collapse them.
 */
export const buildDocgenPayload = (
  input: DocgenProviderInput,
  context: BuildDocgenContext
): AngularDocgenPayload | undefined => {
  const { options, logger } = context;
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }

  // The index writes `importPath` relative to the Storybook working directory, which is the
  // worker's cwd.
  const storyFilePath = resolve(process.cwd(), storyImportPath);
  const resolved = resolveStoryComponent(storyFilePath, input.entry.title);
  if ('reason' in resolved) {
    // Passing through is correct - it means "no Angular component here" - but leave a trace.
    logger.debug(`No Angular component resolved from ${storyFilePath}: ${resolved.reason}.`);
    return undefined;
  }

  const { component } = resolved;
  // `default` is an export name, not a class name; the local binding is the only thing left to
  // call the component before its Compodoc entry is found.
  const displayName =
    component.exportName === 'default' ? component.localName : component.exportName;

  const base = {
    id: getComponentIdFromEntry(input.entry),
    name: displayName,
    path: storyImportPath,
  };
  const documentationJson = join(options.outputDir, DOCUMENTATION_JSON);
  const enableCompodoc =
    `Enable Compodoc so Storybook can extract Angular metadata: make sure framework.options.compodoc is not false, ` +
    `or generate it yourself with "compodoc -p ${options.tsconfig} -e json -d ${options.outputDir}".`;

  if (!existsSync(documentationJson)) {
    return errorPayload(
      base,
      'NoCompodocDocumentation',
      `No Compodoc documentation.json at ${documentationJson}.\n${enableCompodoc}`
    );
  }

  let compodocJson: CompodocJson;
  try {
    compodocJson = context.readDocumentationJson(documentationJson);
  } catch (error) {
    return errorPayload(
      base,
      'NoCompodocDocumentation',
      `${documentationJson} could not be read: ${error instanceof Error ? error.message : String(error)}\n${enableCompodoc}`
    );
  }

  const entry = findCompodocEntry(compodocJson, component, options.workspaceRoot);
  if (!entry) {
    const declaredInStoryFile =
      component.path !== undefined &&
      comparablePath(component.path) === comparablePath(storyFilePath);

    return errorPayload(
      base,
      'ComponentNotDocumented',
      declaredInStoryFile
        ? `Compodoc does not document components declared inside story files, so "${displayName}" has no metadata.\nMove it into its own file to have it documented. Source: ${documentationJson}`
        : `Compodoc documented this project but not the component "${displayName}".\nCheck that the component's file is covered by the tsconfig Compodoc runs against (${
            options.tsconfig
          }) and re-run Compodoc. Source: ${documentationJson}`
    );
  }

  const argTypes = extractArgTypesFromData(entry, {
    compodocJson,
    filterNonInputControls: options.angularFilterNonInputControls,
    logger,
    unwrapHtml: htmlToText,
  }) as StrictArgTypes;

  // `rawdescription` is not used: it opens with blank lines, which makes its first line empty.
  const description = entry.description ? htmlToText(entry.description).trim() : undefined;
  const jsDocTags = extractJsDocTags(entry);

  return {
    ...base,
    // Compodoc knows the class name even when the story file imported it as a default export.
    name: entry.name ?? displayName,
    description,
    // Same meaning as on React, which also sources `summary` from a `@summary` tag.
    summary: jsDocTags.summary?.[0],
    jsDocTags,
    argTypes,
    // `subcomponents` stays unset: Compodoc flattens inherited members into the component's own
    // `inputsClass`/`outputsClass`, and Angular has no second construct the field would describe.
    compodoc: entry,
  };
};
