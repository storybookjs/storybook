import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import type { DocgenJsDocTags, DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

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

const describedBy = (text: string | undefined): string | undefined => text?.trim() || undefined;

const analyzerJsDocTags = (entry: AngularClassMeta): DocgenJsDocTags => {
  const tags: DocgenJsDocTags = {};
  for (const tag of entry.jsdoctags ?? []) {
    const name = tag.tagName?.escapedText;
    if (!name) {
      continue;
    }
    const value = tag.comment === undefined ? '' : String(tag.comment).trim();
    (tags[name] ??= []).push(value);
  }
  return tags;
};

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
    // A story file with no `component` at all documents no Angular component, so the next provider
    // gets its turn. A `component` that is there but unreadable is this provider's failure to
    // report: staying quiet would be indistinguishable from a story that documents nothing.
    if (resolved.reason === 'no-meta-component') {
      logger.debug(`No Angular component resolved from ${storyFilePath}: ${resolved.reason}.`);
      return undefined;
    }

    const unreadableBase = {
      id: getComponentIdFromEntry(input.entry),
      name:
        resolved.reason === 'unreadable-component-expression'
          ? resolved.expression
          : (input.entry.title.split('/').at(-1) ?? input.entry.title),
      path: storyImportPath,
    };
    return errorPayload(
      unreadableBase,
      'AngularComponentMetaNotFound',
      resolved.reason === 'unreadable-component-expression'
        ? `The story file sets \`component: ${resolved.expression}\`, which does not resolve to a class.\n` +
            `Storybook follows an imported name, a namespace-import property access, or a chain of ` +
            `property accesses and spreads through modules it can resolve. ` +
            `Assign the component to a name in ${storyFilePath}.`
        : // `meta.component` may reach this binding through another module (e.g. a spread config
          // object), so the type-only or namespace import is not necessarily written in the story
          // file itself - naming it here would send the reader to the wrong file.
          `Resolving \`meta.component\` from ${storyFilePath} reached a binding that is a type-only ` +
            `or namespace import, which carries no class to document.\n` +
            `Import the component as a value in whichever module declares that binding.`
    );
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
      // `component.importId` may be read from a module `meta.component` only reaches through a
      // chain (e.g. a spread config object), so the import is not necessarily written in the story
      // file itself - naming it here would send the reader to the wrong file.
      `Storybook could not resolve the import of "${displayName}" from "${component.importId}", ` +
        `reached while resolving \`meta.component\` from ${storyFilePath}.\n` +
        `Check the import specifier (and any tsconfig path aliases it relies on) in whichever module ` +
        `actually imports it.`
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
  });

  // Agent documentation is pinned to `api` whatever the user chose for their props table: `all`
  // would hand an agent private wiring it cannot bind, and `inputs` would empty the Outputs section.
  const apiArgTypes =
    options.propsTable === 'api'
      ? argTypes
      : extractArgTypesFromData(meta.entry, {
          metadataJson: meta.json,
          propsTable: 'api',
          logger,
        });

  const jsDocTags: DocgenJsDocTags = meta.jsDocInfo?.jsDocTags ?? analyzerJsDocTags(meta.entry);
  const description =
    describedBy(meta.jsDocInfo?.description) ??
    describedBy(meta.entry.rawdescription) ??
    describedBy(meta.entry.description);

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
