import type { DeclaredSubcomponent, MetaComponentResolution } from 'storybook/internal/common';
import {
  extractDeclaredSubcomponents,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
} from 'storybook/internal/common';
import type { CsfFile } from 'storybook/internal/csf-tools';
import type {
  DocgenJsDocTags,
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
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
import { parseStoryFile, resolveMetaComponent } from './resolve-component.ts';

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
  // `true`/`false` for a resolvable decorator value, `undefined` when metadata couldn't be read.
  standalone: boolean | undefined;
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
    standalone: entry.standalone,
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

/**
 * The extraction chain every documented component runs, primary or subcomponent: argTypes at the
 * user's `propsTable` mode, agent documentation pinned to `api`, and the JSDoc prose chain.
 */
const docgenFieldsOf = (
  meta: AngularComponentMetaResult,
  options: AngularDocgenOptions,
  logger: ParsingLogger
) => {
  const argTypes = extractArgTypesFromData(meta.entry, {
    metadataJson: meta.json,
    propsTable: options.propsTable,
    logger,
    // Named-type table detail resolves against the analyzer's live context; absent for stubbed
    // analyzers, which keeps those payloads flat.
    context: meta.context,
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
          context: meta.context,
        });

  const jsDocTags: DocgenJsDocTags = meta.jsDocInfo?.jsDocTags ?? analyzerJsDocTags(meta.entry);
  return {
    argTypes,
    jsDocTags,
    description:
      describedBy(meta.jsDocInfo?.description) ??
      describedBy(meta.entry.rawdescription) ??
      describedBy(meta.entry.description),
    summary: jsDocTags.summary?.[0],
    apiDescription: buildApiDescription(apiArgTypes, meta.entry.name),
  };
};

interface DocgenError {
  name: string;
  message: string;
}

/** `default` is an export name, not a class name, so the local binding reads better. */
const displayNameOf = (component: { exportName: string; localName: string }) =>
  component.exportName === 'default' ? component.localName : component.exportName;

/** The best name available for a primary component whose documentation failed. */
const errorNameOf = (resolution: MetaComponentResolution, title: string): string => {
  if ('component' in resolution) {
    return displayNameOf(resolution.component);
  }
  return resolution.reason === 'unreadable-component-expression'
    ? resolution.expression
    : (title.split('/').at(-1) ?? title);
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The remediation text for a resolution that did not name a component class. */
const unresolvedMessage = (
  resolution: Extract<MetaComponentResolution, { reason: string }>,
  subject: string,
  storyFilePath: string
): string => {
  switch (resolution.reason) {
    case 'unreadable-component-expression':
      return (
        `${capitalized(subject)} sets \`${resolution.expression}\`, which does not resolve to a class.\n` +
        `Storybook follows an imported name, a namespace-import property access, or a chain of ` +
        `property accesses and spreads through modules it can resolve. ` +
        `Assign the component to a name in ${storyFilePath}.`
      );
    case 'no-component-import':
      // The binding may be reached through another module (e.g. a spread config object), so the
      // type-only or namespace import is not necessarily written in the story file itself - naming
      // it here would send the reader to the wrong file.
      return (
        `Resolving ${subject} from ${storyFilePath} reached a binding that is a type-only ` +
        `or namespace import, which carries no class to document.\n` +
        `Import the component as a value in whichever module declares that binding.`
      );
    case 'no-meta-component':
      // The primary hands this case to the next provider; a declared entry always carries its node.
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(`Storybook found no component expression for ${subject}.`);
  }
};

type DocumentedComponent =
  | {
      path: string;
      meta: AngularComponentMetaResult;
      fields: ReturnType<typeof docgenFieldsOf>;
    }
  | { error: DocgenError };

/**
 * The chain primary and subcomponent share: resolution → analyzer query → field derivation, with
 * every failure returned as an `error` for the caller to place (error payload or errored entry).
 * `subject` names what was being resolved ("`meta.component`", "the `subcomponents` entry ...").
 *
 * The analyzer query and the field derivation share one `try`: the language service can throw a TS
 * Debug Failure on a single pathological file, and field derivation resolves named-type detail
 * against that same live TS context.
 */
const documentComponent = (
  resolution: MetaComponentResolution,
  subject: string,
  storyFilePath: string,
  context: BuildDocgenContext
): DocumentedComponent => {
  if ('reason' in resolution) {
    return {
      error: {
        name: 'AngularComponentMetaNotFound',
        message: unresolvedMessage(resolution, subject, storyFilePath),
      },
    };
  }

  const { component } = resolution;
  // A component declared in the story file resolves to the story file itself, so no path at all can
  // only mean the import specifier did not resolve.
  if (!component.path) {
    const displayName = displayNameOf(component);
    return {
      error: {
        name: 'AngularComponentMetaNotFound',
        // `component.importId` may be read from a module the chain only reaches through (e.g. a
        // spread config object), so the import is not necessarily written in the story file itself.
        message:
          `Storybook could not resolve the import of "${displayName}" from "${component.importId}", ` +
          `reached while resolving ${subject} from ${storyFilePath}.\n` +
          `Check the import specifier (and any tsconfig path aliases it relies on) in whichever module ` +
          `actually imports it.`,
      },
    };
  }

  const { path } = component;
  const { manager, options, logger } = context;
  try {
    const meta = manager.extractComponentMeta(path, {
      exportName: component.exportName,
      localName: component.localName,
    });
    if (!meta) {
      return {
        error: {
          name: 'AngularComponentMetaNotFound',
          message:
            `No metadata was extracted for the "${component.exportName}" export of ${path}.\n` +
            `Check that the file exports the component class and is covered by a tsconfig.json in or above its directory.`,
        },
      };
    }
    return { path, meta, fields: docgenFieldsOf(meta, options, logger) };
  } catch (err) {
    return {
      error: {
        name: 'AngularComponentMetaExtractionFailed',
        message:
          `The analyzer threw while extracting "${component.exportName}" from ${path}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
};

/** The errored entry a failed subcomponent degrades to, in place of the payload it would have been. */
const subcomponentError = (
  name: string,
  storyFilePath: string,
  error: DocgenError
): DocgenSubcomponent => ({
  name,
  path: storyFilePath,
  jsDocTags: {},
  error,
});

/**
 * Builds one declared subcomponent's docgen entry through the same chain as the primary component.
 *
 * Resolution runs inside the `try` with everything else, so one broken child can never fail the
 * payload documenting the primary component, whatever the resolver or analyzer throws.
 */
const buildSubcomponentDocgen = (
  declared: DeclaredSubcomponent,
  csf: CsfFile,
  storyFilePath: string,
  context: BuildDocgenContext
): DocgenSubcomponent => {
  const subject = `the \`subcomponents\` entry "${declared.name}"`;
  try {
    const resolution = resolveMetaComponent(csf, storyFilePath, declared.node);

    const documented = documentComponent(resolution, subject, storyFilePath, context);
    if ('error' in documented) {
      return subcomponentError(declared.componentName, storyFilePath, documented.error);
    }
    return {
      name: documented.meta.entry.name,
      path: documented.path,
      ...documented.fields,
      renderer: 'angular',
    };
  } catch (err) {
    return subcomponentError(declared.componentName, storyFilePath, {
      name: 'AngularComponentMetaExtractionFailed',
      message: `Documenting ${subject} threw: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};

/**
 * Builds the `subcomponents` record for the story meta's declared subcomponents; empty when none
 * are declared. Takes the already-parsed CSF file so the story file is parsed once.
 */
const buildSubcomponents = (
  csf: CsfFile,
  storyFilePath: string,
  context: BuildDocgenContext
): Record<string, DocgenSubcomponent> =>
  Object.fromEntries(
    extractDeclaredSubcomponents(csf).map((declared): [string, DocgenSubcomponent] => [
      declared.name,
      buildSubcomponentDocgen(declared, csf, storyFilePath, context),
    ])
  );

// `undefined` means "no Angular component here", so callers fall through to the next provider,
// while a payload carrying `error` means "mine, but extraction failed".
export const buildDocgenPayload = (
  input: DocgenProviderInput,
  context: BuildDocgenContext
): AngularDocgenPayload | undefined => {
  const { logger } = context;
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }

  // The index writes `importPath` relative to the Storybook working directory, the worker's cwd.
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => resolve(process.cwd(), importPath));
  const storyFilePath = resolvePath(storyImportPath);
  const csf = parseStoryFile(storyFilePath, input.entry.title);
  if (!csf) {
    // An unparseable story file documents no Angular component, so the next provider gets its turn.
    logger.debug(
      `No Angular component resolved from ${storyFilePath}: could not parse the story file.`
    );
    return undefined;
  }

  const resolved = resolveMetaComponent(csf, storyFilePath);
  // A story file with no `component` at all documents no Angular component, so the next provider
  // gets its turn. A `component` that is there but unreadable is this provider's failure to
  // report: staying quiet would be indistinguishable from a story that documents nothing.
  if ('reason' in resolved && resolved.reason === 'no-meta-component') {
    logger.debug(`No Angular component resolved from ${storyFilePath}: ${resolved.reason}.`);
    return undefined;
  }

  const id = getComponentIdFromEntry(input.entry);
  const documented = documentComponent(resolved, '`meta.component`', storyFilePath, context);
  if ('error' in documented) {
    const name = errorNameOf(resolved, input.entry.title);
    return errorPayload(
      { id, name, path: storyImportPath },
      documented.error.name,
      documented.error.message
    );
  }

  const { meta, fields } = documented;
  const subcomponents = buildSubcomponents(csf, storyFilePath, context);

  return {
    id,
    path: storyImportPath,
    // The analyzer knows the class name even when the story file imported it as a default export.
    name: meta.entry.name,
    ...fields,
    renderer: 'angular',
    angularComponentMeta: metaToSnippetMeta(meta),
    // Omitted entirely when the meta declares none, so existing payloads stay unchanged.
    ...(Object.keys(subcomponents).length > 0 ? { subcomponents } : {}),
  };
};
