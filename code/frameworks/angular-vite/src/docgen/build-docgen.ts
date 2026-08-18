import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type {
  DocgenJsDocTags,
  DocgenPayload,
  DocgenProviderInput,
  StrictArgTypes,
} from 'storybook/internal/types';

import { resolve } from 'node:path';

import type {
  AngularClassMeta,
  AngularComponentMetaResult,
  ParsingLogger,
  PropsTableMode,
} from '@storybook/angular-cm';
import { extractArgTypesFromData } from '@storybook/angular-cm';
import { buildApiDescription } from './api-description.ts';
import { resolveStoryComponent } from './resolve-component.ts';

// Structured-cloned onto the worker thread, so every field must be plain JSON data.
export interface AngularDocgenOptions {
  propsTable: PropsTableMode;
}

export interface SnippetEnum {
  name: string;
  members: { name: string; value?: string | number }[];
}

/** Everything the story-docs provider needs to render a component snippet. */
export interface AngularComponentSnippetMeta {
  name: string;
  selector: string | undefined;
  // `false` only for an explicit `standalone: false`; anything else is the language default.
  standalone: boolean;
  inputs: string[];
  // Output binding names in `outputsClass` order, `model()` outputs `Change`-suffixed.
  outputs: string[];
  enums: SnippetEnum[];
}

export type AngularDocgenPayload = DocgenPayload & {
  // The analyzer's record for the class, never filtered by `propsTable`.
  angularComponentMeta?: AngularComponentSnippetMeta;
};

// Structural on purpose: tests hand in a stub instead of a real TypeScript-backed analyzer.
export interface AngularComponentMetaSource {
  extractComponentMeta(
    componentPath: string,
    names: { exportName: string; localName?: string }
  ): AngularComponentMetaResult | undefined;
}

export interface BuildDocgenContext {
  manager: AngularComponentMetaSource;
  options: AngularDocgenOptions;
  logger: ParsingLogger;
  resolvePath?: (importPath: string) => string;
}

const inputsOf = (entry: AngularClassMeta) =>
  'inputsClass' in entry ? (entry.inputsClass ?? []) : [];

const outputsOf = (entry: AngularClassMeta) =>
  'outputsClass' in entry ? (entry.outputsClass ?? []) : [];

export const metaToSnippetMeta = (
  meta: AngularComponentMetaResult
): AngularComponentSnippetMeta => {
  const { entry } = meta;
  const inputs = inputsOf(entry).map((input) => input.name);
  const inputNames = new Set(inputs);
  const outputs: string[] = [];
  for (const output of outputsOf(entry)) {
    // model() lands under the same bare name in both arrays; its output binds as `${name}Change`.
    const bindingName = inputNames.has(output.name) ? `${output.name}Change` : output.name;
    if (!outputs.includes(bindingName)) {
      outputs.push(bindingName);
    }
  }
  return {
    name: entry.name,
    selector: entry.selector,
    standalone: entry.standalone !== false,
    inputs,
    outputs,
    enums: (meta.json.miscellaneous?.enumerations ?? []).map((enumeration) => ({
      name: enumeration.name,
      members: enumeration.childs.map((child) => ({ name: child.name, value: child.value })),
    })),
  };
};

// The description is deliberately not parsed for tags: an `@Input()` inside a documentation code
// block would become a fabricated tag.
const extractJsDocTags = (entry: AngularClassMeta): DocgenJsDocTags => {
  const tags: DocgenJsDocTags = {};
  for (const tag of entry.jsdoctags ?? []) {
    const name = tag?.tagName?.escapedText;
    if (!name) {
      continue;
    }
    // The analyzer's comments are plain text, never the Markdown-rendered HTML Compodoc produced.
    const value = tag.comment === undefined ? '' : String(tag.comment).trim();
    (tags[name] ??= []).push(value);
  }
  return tags;
};

const errorPayload = (
  base: Pick<DocgenPayload, 'id' | 'name' | 'path'>,
  name: string,
  message: string
): AngularDocgenPayload => ({ ...base, jsDocTags: {}, error: { name, message } });

// `undefined` means "no Angular component here", so callers fall through to the next provider,
// while a payload carrying `error` means "mine, but extraction failed".
export const buildDocgenPayload = (
  input: DocgenProviderInput,
  context: BuildDocgenContext
): AngularDocgenPayload | undefined => {
  const { manager, options, logger } = context;
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }

  // The index writes `importPath` relative to the Storybook working directory, the worker's cwd.
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => resolve(process.cwd(), importPath));
  const storyFilePath = resolvePath(storyImportPath);
  const resolved = resolveStoryComponent(storyFilePath, input.entry.title);
  if ('reason' in resolved) {
    logger.debug(`No Angular component resolved from ${storyFilePath}: ${resolved.reason}.`);
    return undefined;
  }

  const { component } = resolved;
  // `default` is an export name, not a class name, so the local binding is the best name so far.
  const displayName =
    component.exportName === 'default' ? component.localName : component.exportName;

  const base = {
    id: getComponentIdFromEntry(input.entry),
    name: displayName,
    path: storyImportPath,
  };

  // A component declared in the story file resolves to the story file itself, so no path at all can
  // only mean the import specifier did not resolve.
  if (!component.path) {
    return errorPayload(
      base,
      'AngularComponentMetaNotFound',
      `The story file imports "${displayName}" from "${component.importId}", which did not resolve to a file.\n` +
        `Check the import specifier (and any tsconfig path aliases it relies on) in ${storyFilePath}.`
    );
  }

  // The language service can throw a TS Debug Failure on a single pathological file.
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
    metadataJson: meta.json,
    propsTable: options.propsTable,
    logger,
  }) as StrictArgTypes;

  // Agent documentation is pinned to `api` whatever the user chose for their props table: `all`
  // would hand an agent private wiring it cannot bind, and `inputs` would empty the Outputs section.
  const apiArgTypes =
    options.propsTable === 'api'
      ? argTypes
      : (extractArgTypesFromData(meta.entry, {
          metadataJson: meta.json,
          propsTable: 'api',
          logger,
        }) as StrictArgTypes);

  const jsDocTags = extractJsDocTags(meta.entry);
  // Tags are excluded from `rawdescription`, which is why it wins over `description`.
  const description =
    meta.entry.rawdescription?.trim() || (meta.entry.description ?? '').trim() || undefined;

  return {
    ...base,
    // The analyzer knows the class name even when the story file imported it as a default export.
    name: meta.entry.name,
    description,
    summary: jsDocTags.summary?.[0],
    jsDocTags,
    argTypes,
    apiDescription: buildApiDescription(apiArgTypes, meta.entry.name),
    renderer: 'angular',
    angularComponentMeta: metaToSnippetMeta(meta),
  };
};
