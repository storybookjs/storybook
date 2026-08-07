import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type {
  DocgenJsDocTags,
  DocgenPayload,
  DocgenProviderInput,
  StrictArgTypes,
} from 'storybook/internal/types';

import { resolve } from 'node:path';

import type { CompodocParsingLogger } from '@storybook/angular-compodoc';
import { extractArgTypesFromData, unwrapPlainText } from '@storybook/angular-compodoc';
import type { AngularClassMeta, AngularComponentMetaResult } from '@storybook/angular-cm';
import { resolveStoryComponent } from './resolve-component.ts';

/**
 * Configuration the `angular-vite` preset hands to the docgen worker.
 *
 * The descriptor's `options` object is structured-cloned onto the worker thread, so every field
 * here must be plain JSON data. The analyzer derives everything else (tsconfig, project layout)
 * from the component files themselves.
 */
export interface AngularDocgenOptions {
  /**
   * `features.angularFilterNonInputControls`, threaded through because the worker cannot read
   * features itself.
   */
  angularFilterNonInputControls?: boolean;
}

export type AngularDocgenPayload = DocgenPayload & {
  /** The analyzer's record for the component class, unfiltered. */
  angularComponentMeta?: AngularClassMeta;
};

/**
 * The slice of `AngularComponentMetaManager` this builder reads, structural so tests can hand in a
 * stub instead of a real TypeScript-backed analyzer.
 */
export interface AngularComponentMetaSource {
  extractComponentMeta(
    componentPath: string,
    names: { exportName: string; localName?: string }
  ): AngularComponentMetaResult | undefined;
}

export interface BuildDocgenContext {
  manager: AngularComponentMetaSource;
  options: AngularDocgenOptions;
  logger: CompodocParsingLogger;
  /** Same hook the React and Vue builders expose, defaulting to the same resolution against cwd. */
  resolvePath?: (importPath: string) => string;
}

/**
 * How this provider runs the shared compodoc-shaped extraction: the analyzer emits plain-text
 * comments (an HTML unwrapper would mangle text like `Array<string>`), and `modern` drops the
 * legacy quirks the compodoc pipeline is pinned to. The docgen-harness recorder spreads the same
 * object so its `acm-` baselines represent exactly what this worker produces.
 */
export const ACM_EXTRACT_OPTIONS = { unwrapHtml: unwrapPlainText, modern: true } as const;

/**
 * The analyzer's JSDoc tag nodes, reshaped as the payload's `Record<name, values>`. The description
 * is deliberately not parsed for tags: an `@Input()` inside a documentation code block would become
 * a fabricated tag.
 */
const extractJsDocTags = (entry: AngularClassMeta): DocgenJsDocTags => {
  const tags: DocgenJsDocTags = {};
  for (const tag of entry.jsdoctags ?? []) {
    const name = tag?.tagName?.escapedText;
    if (!name) {
      continue;
    }
    // A tag may legitimately carry no comment. The analyzer's comments are plain text, kept
    // verbatim rather than run through an HTML unwrapper.
    const value = tag.comment === undefined ? '' : unwrapPlainText(tag.comment).trim();
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
 * Builds an Angular {@link DocgenPayload} for one story entry from the in-process Angular Component
 * Meta analyzer.
 *
 * Returns `undefined` for "not an Angular component here" (no story import path, no `meta.component`
 * - fall through to the next provider), and a payload carrying `error` for "mine, but extraction
 * failed". The two are different and callers must not collapse them.
 */
export const buildDocgenPayload = (
  input: DocgenProviderInput,
  context: BuildDocgenContext
): AngularDocgenPayload | undefined => {
  const { manager, options, logger } = context;
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }

  // The index writes `importPath` relative to the Storybook working directory, which is the
  // worker's cwd.
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => resolve(process.cwd(), importPath));
  const storyFilePath = resolvePath(storyImportPath);
  const resolved = resolveStoryComponent(storyFilePath, input.entry.title);
  if ('reason' in resolved) {
    // Passing through is correct - it means "no Angular component here" - but leave a trace.
    logger.debug(`No Angular component resolved from ${storyFilePath}: ${resolved.reason}.`);
    return undefined;
  }

  const { component } = resolved;
  // `default` is an export name, not a class name; the local binding is the only thing left to
  // call the component before its metadata is extracted.
  const displayName =
    component.exportName === 'default' ? component.localName : component.exportName;

  const base = {
    id: getComponentIdFromEntry(input.entry),
    name: displayName,
    path: storyImportPath,
  };

  // A component declared inside the story file resolves to the story file itself, which the
  // analyzer handles like any other TypeScript source. No path at all means the import statement
  // did not resolve, so there is no file to analyze.
  if (!component.path) {
    return errorPayload(
      base,
      'AngularComponentMetaNotFound',
      `The story file imports "${displayName}" from "${component.importId}", which did not resolve to a file.\n` +
        `Check the import specifier (and any tsconfig path aliases it relies on) in ${storyFilePath}.`
    );
  }

  // A language-service throw (e.g. a ts Debug Failure on one pathological file) is "mine, but
  // failed", not a reason to reject the whole request and veto downstream providers.
  let meta: AngularComponentMetaResult | undefined;
  try {
    meta = manager.extractComponentMeta(component.path, {
      exportName: component.exportName,
      localName: component.localName,
    });
  } catch (err) {
    return errorPayload(
      base,
      'AngularComponentMetaExtractionFailed',
      `The analyzer threw while extracting "${component.exportName}" from ${component.path}: ` +
        `${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!meta) {
    return errorPayload(
      base,
      'AngularComponentMetaNotFound',
      `No metadata was extracted for the "${component.exportName}" export of ${component.path}.\n` +
        `Check that the file exports the component class and is covered by a tsconfig.json in or above its directory.`
    );
  }

  const argTypes = extractArgTypesFromData(meta.entry, {
    compodocJson: meta.json,
    filterNonInputControls: options.angularFilterNonInputControls,
    logger,
    ...ACM_EXTRACT_OPTIONS,
  }) as StrictArgTypes;

  const jsDocTags = extractJsDocTags(meta.entry);
  // The analyzer emits plain text into both fields, with tags excluded from `rawdescription`.
  const description =
    meta.entry.rawdescription?.trim() || (meta.entry.description ?? '').trim() || undefined;

  return {
    ...base,
    // The analyzer knows the class name even when the story file imported it as a default export.
    name: meta.entry.name,
    description,
    // Same meaning as on React, which also sources `summary` from a `@summary` tag.
    summary: jsDocTags.summary?.[0],
    jsDocTags,
    argTypes,
    // `subcomponents` stays unset: inherited members are merged into the component's own
    // inputs/outputs, and Angular has no second construct the field would describe.
    angularComponentMeta: meta.entry,
  };
};
