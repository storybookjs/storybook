import { readFile } from 'node:fs/promises';
import { join, parse } from 'node:path';

import {
  extractComponentDescription,
  extractDescription,
  loadCsf,
  storyShapeError,
} from 'storybook/internal/csf-tools';
import type { CsfFile } from 'storybook/internal/csf-tools';
import type {
  DocgenError,
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
  DocgenSummary,
} from 'storybook/internal/types';

import type ts from 'typescript';

import {
  type DeclaredSubcomponent,
  componentPathFromStory,
  extractDeclaredSubcomponents,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
} from 'storybook/internal/common';

import { extractArgTypes } from './arg-types/extractArgTypes.ts';

import type { ComponentMetaChecker } from 'vue-component-meta';

import { buildApiDescription } from './api-description/api-description.ts';
import { createNamedTypeDetailResolver } from './arg-types/named-type-detail.ts';
import { type MetaSource, collectComponentMetaSources } from './component-meta/component-meta.ts';
import { readComponentDocs } from './component-docs.ts';
import { followReExport } from './resolve-component/follow-re-export.ts';
import {
  type ResolvedVueComponent,
  type UnresolvedComponentReason,
  resolveMetaComponent,
} from './resolve-component/resolve-component.ts';

type VueDocgenPayload = DocgenPayload & { vueComponentMeta?: MetaSource };

const META_COMPONENT_NAME = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const NON_COMPONENT_NAMES = new Set([
  'null',
  'undefined',
  'true',
  'false',
  'NaN',
  'Infinity',
  'this',
  'import',
]);

export interface BuildDocgenContext {
  getChecker: (componentFilePath: string) => ComponentMetaChecker;
  resolvePath?: (importPath: string) => string;
  typescript: typeof ts;
}

export type DescribeContext = Pick<BuildDocgenContext, 'resolvePath'>;

/**
 * One message factory per resolver reason, parameterized by the declaration the story file names —
 * `meta.component` for the primary component, the failed `meta.subcomponents.<Key>` entry for a
 * child. The error names stay stable because consumers match on them.
 */
const UNRESOLVED_COMPONENT_MESSAGES: Record<
  UnresolvedComponentReason,
  (subject: string) => DocgenError
> = {
  'no-meta-component': (subject) => ({
    name: 'No component found',
    message: `We could not detect the component from ${subject}. Specify meta.component.`,
  }),
  'no-component-import': (subject) => ({
    name: 'No component import found',
    message: `No component file found for the component declared in ${subject}. Import it into the story file.`,
  }),
  'missing-export': (subject) => ({
    name: 'No component found',
    message: `${subject} names an export that its module does not have. Check the name against the module's exports, and any barrel that re-exports it.`,
  }),
  'unreadable-component-expression': (subject) => ({
    name: 'No component found',
    message: `We could not follow ${subject} to a component. Storybook follows an imported name, a namespace-import property access, or a chain of property accesses and spreads through modules it can resolve.`,
  }),
};

function unresolvedComponentError(reason: UnresolvedComponentReason, subject: string): DocgenError {
  return UNRESOLVED_COMPONENT_MESSAGES[reason](subject);
}

/**
 * Get last segment of a story title
 */
export function componentNameFromTitle(title: string): string {
  return title.split('/').at(-1)!.replace(/\s+/g, '');
}

export function getUsableComponentName(component: string | undefined): string | undefined {
  const name = component?.trim();
  if (!name || NON_COMPONENT_NAMES.has(name.split('.')[0]!) || !META_COMPONENT_NAME.test(name)) {
    return undefined;
  }
  return name;
}

/**
 * Either the extraction failed with a {@link DocgenError}, or it produced what the type checker
 * knows of a component — the followed module `path` plus the `vue-component-meta` source and the
 * props derived from it.
 */
type ExtractedVueComponentDocgen =
  | { error: DocgenError }
  | (Pick<DocgenSubcomponent, 'argTypes' | 'apiDescription'> & {
      path: string;
      componentMeta: MetaSource;
    });

/**
 * The one extraction chain behind the primary component and each declared subcomponent: follow
 * re-exports, collect `vue-component-meta` sources for the declaring module, then derive the
 * argTypes and API description in that module's scope. Returns a {@link DocgenError} instead of
 * throwing when the module has no metadata for the export, so each caller decides how the failure
 * surfaces.
 */
async function extractVueComponentDocgen(
  context: BuildDocgenContext,
  resolvedComponent: { path: string; exportName: string },
  errorContext = ''
): Promise<ExtractedVueComponentDocgen> {
  const checker = context.getChecker(resolvedComponent.path);
  const declaredExport = followReExport(
    checker,
    resolvedComponent.path,
    resolvedComponent.exportName
  ) ?? {
    path: resolvedComponent.path,
    exportName: resolvedComponent.exportName,
  };
  const metaSources = await collectComponentMetaSources(checker, declaredExport.path);
  const componentMeta = metaSources.find((meta) => meta.exportName === declaredExport.exportName);
  if (!componentMeta) {
    return {
      error: {
        name: 'No docgen found',
        message: `vue-component-meta extracted no component metadata for the "${declaredExport.exportName}" export of ${declaredExport.path}${errorContext}.`,
      } satisfies DocgenError,
    };
  }

  // Server-only named-type expansion for `table.type.detail`; the legacy Vite-plugin path never
  // constructs one, keeping its output byte-identical. No-op when the checker has no program.
  const resolveNamedTypeDetail = createNamedTypeDetailResolver({
    checker,
    typescript: context.typescript,
    componentPath: declaredExport.path,
  });

  return {
    path: declaredExport.path,
    componentMeta,
    argTypes: extractArgTypes({ __docgenInfo: componentMeta }, resolveNamedTypeDetail) ?? undefined,
    apiDescription: buildApiDescription(componentMeta),
  };
}

/**
 * Builds one declared subcomponent's docgen entry through the shared extraction chain.
 *
 * Every failure — resolution, extraction, anything thrown — is isolated to the entry's `error`, so
 * one broken child cannot fail the payload that documents the primary component.
 */
async function buildSubcomponentDocgen(
  csf: CsfFile,
  storyPath: string,
  storyFilePath: string,
  declared: DeclaredSubcomponent,
  context: BuildDocgenContext
): Promise<DocgenSubcomponent> {
  const failure = (
    error: DocgenError,
    docs: Pick<DocgenSubcomponent, 'description' | 'summary' | 'jsDocTags'> = { jsDocTags: {} }
  ): DocgenSubcomponent => ({
    name: declared.componentName,
    path: storyFilePath,
    ...docs,
    error,
  });

  try {
    const resolved = resolveMetaComponent(csf, storyPath, declared.node);
    if ('reason' in resolved) {
      return failure(
        unresolvedComponentError(resolved.reason, `meta.subcomponents.${declared.name}`)
      );
    }

    const componentDocs = readComponentDocs(resolved.component);
    const docs = extractComponentDescription(
      undefined,
      componentDocs?.description,
      componentDocs?.tags
    );
    const extracted = await extractVueComponentDocgen(
      context,
      resolved.component,
      ` (subcomponent "${declared.name}")`
    );
    if ('error' in extracted) {
      return failure(extracted.error, docs);
    }

    return {
      name: declared.componentName,
      // Written like the story's index path, as in the other renderers, not as a machine path.
      path: componentPathFromStory(storyFilePath, storyPath, extracted.path),
      ...docs,
      argTypes: extracted.argTypes,
      apiDescription: extracted.apiDescription,
      renderer: 'vue3',
    };
  } catch (error) {
    return failure({
      name: 'Subcomponent extraction failed',
      message: `Extracting docgen for the declared subcomponent "${declared.name}" failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}

type DescribedStoryComponent = {
  // The fields of the payload that the source gives.
  docs: Pick<VueDocgenPayload, 'id' | 'name' | 'path' | 'jsDocTags' | 'description' | 'summary'>;
} & (
  | { error: DocgenError }
  | { csf: CsfFile; storyPath: string; storyFilePath: string; component: ResolvedVueComponent }
);

// The part of docgen that needs no type checker: what the source says of the component a story
// file documents, and which component the props are to be extracted from, or why there is none.
// `undefined` when the story file is gone.
export async function describeStoryComponent(
  input: DocgenProviderInput,
  context: DescribeContext = {}
): Promise<DescribedStoryComponent | undefined> {
  const storyFilePath = getStoryImportPathFromEntry(input.entry);
  if (!storyFilePath) {
    return undefined;
  }

  // Import paths in the index are relative to the project root the server runs from.
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => join(process.cwd(), importPath));
  const storyPath = resolvePath(storyFilePath);

  let storyFile: string;
  try {
    storyFile = await readFile(storyPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // The file backing an indexed entry is gone. Nothing to document, so fall through.
      return undefined;
    }
    throw error;
  }

  // IF the story has no meta.component
  const fallbackName = componentNameFromTitle(input.entry.title);
  const id = getComponentIdFromEntry(input.entry);

  let csf;
  try {
    csf = loadCsf(storyFile, {
      makeTitle: () => input.entry.title,
      fileName: storyPath,
    }).parse();
  } catch (error) {
    return {
      docs: { id, name: fallbackName, path: storyFilePath, jsDocTags: {} },
      error: {
        name: 'Story file could not be parsed',
        message:
          `${error instanceof Error ? error.message : String(error)}` +
          `\n\n${input.entry.importPath}:\n${storyFile}`,
      },
    };
  }

  const authoredComponentName = getUsableComponentName(csf._meta?.component);
  const metaJsDoc = extractDescription(csf._metaStatement, csf.editor) || undefined;

  const resolved = resolveMetaComponent(csf, storyPath);
  if ('reason' in resolved) {
    // Without meta.component there is no declaration to name — the story file itself is what is
    // missing; every other reason points at the meta.component reference it could not follow.
    const error = unresolvedComponentError(
      resolved.reason,
      resolved.reason === 'no-meta-component' ? 'your story file' : 'meta.component'
    );
    return {
      docs: {
        id,
        name: authoredComponentName ?? fallbackName,
        path: storyFilePath,
        ...extractComponentDescription(metaJsDoc, undefined),
      },
      error: {
        name: error.name,
        message:
          (csf._metaStatement
            ? storyShapeError(error.message, csf._metaStatement, csf.editor).message
            : error.message) + `\n\n${input.entry.importPath}:\n${storyFile}`,
      },
    };
  }

  const { component } = resolved;
  const componentDocs = readComponentDocs(component);
  // A default export has no name of its own, so its file names it.
  const exportedName =
    component.exportName === 'default' ? parse(component.path).name : component.exportName;
  return {
    docs: {
      id,
      name: (authoredComponentName ?? exportedName) || fallbackName,
      path: storyFilePath,
      ...extractComponentDescription(metaJsDoc, componentDocs?.description, componentDocs?.tags),
    },
    csf,
    storyPath,
    storyFilePath,
    component,
  };
}

export async function buildDocgenSummary(
  input: DocgenProviderInput,
  context: DescribeContext = {}
): Promise<DocgenSummary | undefined> {
  const described = await describeStoryComponent(input, context);
  if (!described) {
    return undefined;
  }
  const { name, description, summary } = described.docs;
  return { name, description, summary };
}

/**
 * Builds a {@link DocgenPayload} for the component one CSF story file documents.
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<VueDocgenPayload | undefined> {
  const described = await describeStoryComponent(input, context);
  if (!described) {
    return undefined;
  }
  const { docs } = described;
  if ('error' in described) {
    return { ...docs, error: described.error };
  }
  const { csf, storyPath, storyFilePath, component } = described;

  // The primary and its declared subcomponents share one extraction chain and run concurrently:
  // the children are independent and every failure stays isolated to its own entry, while
  // Promise.all keeps the CSF declaration order in the record. The key is omitted entirely when
  // nothing is declared, so payloads for story files without subcomponents stay byte-identical.
  const [primaryDocgen, subcomponentEntries] = await Promise.all([
    extractVueComponentDocgen(context, component),
    Promise.all(
      extractDeclaredSubcomponents(csf).map(
        async (declaredSubcomponent) =>
          [
            declaredSubcomponent.name,
            await buildSubcomponentDocgen(
              csf,
              storyPath,
              storyFilePath,
              declaredSubcomponent,
              context
            ),
          ] as const
      )
    ).then((entries) => Object.fromEntries(entries)),
  ]);

  if ('error' in primaryDocgen) {
    return { ...docs, error: primaryDocgen.error };
  }

  return {
    ...docs,
    vueComponentMeta: primaryDocgen.componentMeta,
    argTypes: primaryDocgen.argTypes,
    apiDescription: primaryDocgen.apiDescription,
    renderer: 'vue3',
    ...(Object.keys(subcomponentEntries).length > 0 ? { subcomponents: subcomponentEntries } : {}),
  };
}
