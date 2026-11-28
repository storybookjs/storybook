import {
  componentPathFromStory,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
  readDeclarationDocs,
  type TypeScriptSpecifierForDocgen,
} from 'storybook/internal/common';
import type { MetaComponentResolution, ResolvedMetaComponent } from 'storybook/internal/common';
import type {
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
  DocgenSummary,
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
import { type ResolvedStorySubcomponent, resolveStoryComponents } from './resolve-component.ts';

// Structured-cloned onto the worker thread, so every field must be plain JSON data.
export interface AngularDocgenOptions {
  propsTable: PropsTableMode;
  typeScriptSpecifier?: TypeScriptSpecifierForDocgen;
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

type DocgenError = NonNullable<DocgenPayload['error']>;

// What the analyzer reports of one resolved class, or why it reports nothing.
type ClassDocgen =
  | { error: DocgenError }
  | (Pick<DocgenPayload, 'apiDescription'> &
      Required<Pick<DocgenPayload, 'argTypes'>> & {
        angularComponentMeta: AngularComponentSnippetMeta;
      });

const notFound = (message: string): { error: DocgenError } => ({
  error: { name: 'AngularComponentMetaNotFound', message },
});

// Why a reference in the meta did not resolve to a class. `reference` is how the story file writes
// it, such as `component` or `subcomponents.Header`.
const unresolvedError = (
  resolution: Exclude<MetaComponentResolution, { component: unknown }>,
  reference: string,
  storyFilePath: string
): { error: DocgenError } => {
  switch (resolution.reason) {
    case 'unreadable-component-expression':
      return notFound(
        `The story file sets \`${reference}: ${resolution.expression}\`, which does not resolve to a class.\n` +
          `Storybook follows an imported name, a namespace-import property access, or a chain of ` +
          `property accesses and spreads through modules it can resolve. ` +
          `Assign the component to a name in ${storyFilePath}.`
      );
    case 'no-component-import':
      // The reference may reach this binding through another module (e.g. a spread config object),
      // so the type-only or namespace import is not necessarily written in the story file itself -
      // naming it here would send the reader to the wrong file.
      return notFound(
        `Resolving \`meta.${reference}\` from ${storyFilePath} reached a binding that is a type-only ` +
          `or namespace import, which carries no class to document.\n` +
          `Import the component as a value in whichever module declares that binding.`
      );
    case 'missing-export':
      return notFound(
        `The story file sets \`${reference}: ${resolution.expression}\`, but "${resolution.importId}" ` +
          `has no export "${resolution.exportName}".\n` +
          `Check the name against the module's exports, and any barrel that re-exports it.`
      );
    case 'no-meta-component':
      return notFound(`The story file ${storyFilePath} sets no \`meta.${reference}\`.`);
    default: {
      const unhandled: never = resolution;
      throw new Error(`Unhandled resolution ${JSON.stringify(unhandled)}`);
    }
  }
};

// `default` is an export name, not a class name, so the local binding is the best name so far.
const displayNameOf = (component: ResolvedMetaComponent) =>
  component.exportName === 'default' ? component.localName : component.exportName;

// What the source says of one resolved class: its name, and the docs in the docblock above it. The
// description is the docblock up to its first tag, or else its `@description`.
const readClassDocs = (component: ResolvedMetaComponent) => {
  const docs = readDeclarationDocs(component);
  return {
    // The declaration has the class name even when the story file imported it as a default export.
    name: docs?.name ?? displayNameOf(component),
    description: describedBy(docs?.description) ?? describedBy(docs?.tags.description?.[0]),
    summary: docs?.tags.summary?.[0],
    jsDocTags: docs?.tags ?? {},
  };
};

// The props of one resolved class, for the meta's component or one of its subcomponents.
const extractClassDocgen = (
  component: ResolvedMetaComponent,
  displayName: string,
  reference: string,
  storyFilePath: string,
  { manager, options, logger }: BuildDocgenContext
): ClassDocgen => {
  // A component declared in the story file resolves to the story file itself, so no path at all can
  // only mean the import specifier did not resolve.
  if (!component.path) {
    return notFound(
      // The import can be written in another module the reference reaches, such as a barrel, so the
      // message names the module that writes it.
      `Storybook could not resolve the import "${component.importId}" of "${displayName}" in ` +
        `${component.importer ?? storyFilePath}, reached while resolving \`meta.${reference}\` from ` +
        `${storyFilePath}.\n` +
        `Check the import specifier there, and any tsconfig path aliases it relies on.`
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
    return {
      error: {
        name: 'AngularComponentMetaExtractionFailed',
        message:
          `The analyzer threw while extracting "${component.exportName}" from ${component.path}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  if (!meta) {
    return notFound(
      `No metadata was extracted for the "${component.exportName}" export of ${component.path}.\n` +
        `Check that the file exports the component class and is covered by a tsconfig.json in or above its directory.`
    );
  }

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

  return {
    argTypes,
    apiDescription: buildApiDescription(apiArgTypes, meta.entry.name),
    angularComponentMeta: metaToSnippetMeta(meta),
  };
};

// What a payload is named when the meta's `component` resolved to no class.
const nameOfUnresolved = (
  resolution: Exclude<MetaComponentResolution, { component: unknown }>,
  title: string
) =>
  resolution.reason === 'unreadable-component-expression'
    ? resolution.expression
    : (title.split('/').at(-1) ?? title);

// One declared subcomponent's entry. A failure stays in the entry's `error`, so one broken
// subcomponent cannot fail the payload that documents the main component.
const buildSubcomponentDocgen = (
  { name, resolution }: ResolvedStorySubcomponent,
  storyFilePath: string,
  storyImportPath: string,
  context: BuildDocgenContext
): DocgenSubcomponent => {
  const reference = `subcomponents.${name}`;
  if ('reason' in resolution) {
    const { error } = unresolvedError(resolution, reference, storyFilePath);
    return { name, path: storyImportPath, jsDocTags: {}, error };
  }

  const docs = readClassDocs(resolution.component);
  const docgen = extractClassDocgen(
    resolution.component,
    displayNameOf(resolution.component),
    reference,
    storyFilePath,
    context
  );
  if ('error' in docgen) {
    return { ...docs, name, path: storyImportPath, error: docgen.error };
  }
  const { angularComponentMeta: _, ...props } = docgen;
  // Like Vue and Svelte, a documented subcomponent points at the file that declares it.
  const { path } = resolution.component;
  return {
    ...docs,
    ...props,
    path: path ? componentPathFromStory(storyImportPath, storyFilePath, path) : storyImportPath,
    renderer: 'angular',
  };
};

type DescribedStoryComponent = {
  // The fields of the payload that the source gives.
  docs: Pick<
    AngularDocgenPayload,
    'id' | 'name' | 'path' | 'jsDocTags' | 'description' | 'summary'
  >;
  storyFilePath: string;
} & (
  | { error: DocgenError }
  | { component: ResolvedMetaComponent; subcomponents: ResolvedStorySubcomponent[] }
);

// The part of docgen that needs no analyzer: what the source says of the component a story file
// documents, and which class the props are to be extracted from, or why there is none. `undefined`
// means "no Angular component here", so callers fall through to the next provider.
export const describeStoryComponent = (
  input: DocgenProviderInput,
  context: Pick<BuildDocgenContext, 'resolvePath'> & Partial<Pick<BuildDocgenContext, 'logger'>>
): DescribedStoryComponent | undefined => {
  const storyImportPath = getStoryImportPathFromEntry(input.entry);
  if (!storyImportPath) {
    return undefined;
  }

  // The index writes `importPath` relative to the Storybook working directory, the worker's cwd.
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => resolve(process.cwd(), importPath));
  const storyFilePath = resolvePath(storyImportPath);
  const { component: resolved, subcomponents } = resolveStoryComponents(
    storyFilePath,
    input.entry.title
  );
  const id = getComponentIdFromEntry(input.entry);

  if ('reason' in resolved) {
    // A story file with no `component` at all documents no Angular component, so the next provider
    // gets its turn. A `component` that is there but unreadable is this provider's failure to
    // report: staying quiet would be indistinguishable from a story that documents nothing.
    if (resolved.reason === 'no-meta-component') {
      context.logger?.debug(
        `No Angular component resolved from ${storyFilePath}: ${resolved.reason}.`
      );
      return undefined;
    }

    return {
      docs: {
        id,
        name: nameOfUnresolved(resolved, input.entry.title),
        path: storyImportPath,
        jsDocTags: {},
      },
      storyFilePath,
      ...unresolvedError(resolved, 'component', storyFilePath),
    };
  }

  return {
    docs: { id, path: storyImportPath, ...readClassDocs(resolved.component) },
    storyFilePath,
    component: resolved.component,
    subcomponents,
  };
};

export const buildDocgenSummary = (
  input: DocgenProviderInput,
  context: Pick<BuildDocgenContext, 'resolvePath'> = {}
): DocgenSummary | undefined => {
  const described = describeStoryComponent(input, context);
  if (!described) {
    return undefined;
  }
  const { name, description, summary } = described.docs;
  return { name, description, summary };
};

// What `describeStoryComponent` reads from source, and the props the analyzer finds through the
// type checker. A payload carrying `error` means "mine, but extraction failed".
export const buildDocgenPayload = (
  input: DocgenProviderInput,
  context: BuildDocgenContext
): AngularDocgenPayload | undefined => {
  const described = describeStoryComponent(input, context);
  if (!described) {
    return undefined;
  }
  const { docs, storyFilePath } = described;
  if ('error' in described) {
    return { ...docs, error: described.error };
  }

  const { component, subcomponents } = described;
  const docgen = extractClassDocgen(
    component,
    displayNameOf(component),
    'component',
    storyFilePath,
    context
  );
  if ('error' in docgen) {
    return { ...docs, error: docgen.error };
  }

  // The key is left out when nothing is declared, so payloads without subcomponents stay the same.
  const subcomponentEntries = Object.fromEntries(
    subcomponents.map((subcomponent) => [
      subcomponent.name,
      buildSubcomponentDocgen(subcomponent, storyFilePath, docs.path, context),
    ])
  );

  return {
    ...docs,
    ...docgen,
    renderer: 'angular',
    ...(subcomponents.length > 0 ? { subcomponents: subcomponentEntries } : {}),
  };
};
