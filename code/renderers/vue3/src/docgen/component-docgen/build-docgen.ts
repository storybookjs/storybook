import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  extractComponentDescription,
  extractDescription,
  loadCsf,
} from 'storybook/internal/csf-tools';
import type { CsfFile } from 'storybook/internal/csf-tools';
import type {
  DocgenError,
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
} from 'storybook/internal/types';

import type ts from 'typescript';

import {
  type DeclaredSubcomponent,
  extractDeclaredSubcomponents,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
} from 'storybook/internal/common';

import { extractArgTypes } from './arg-types/extractArgTypes.ts';

import type { ComponentMetaChecker } from 'vue-component-meta';

import { buildApiDescription } from './api-description/api-description.ts';
import { createNamedTypeDetailResolver } from './arg-types/named-type-detail.ts';
import { type MetaSource, collectComponentMetaSources } from './component-meta/component-meta.ts';
import { followReExport } from './resolve-component/follow-re-export.ts';
import {
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
function componentNameFromTitle(title: string): string {
  return title.split('/').at(-1)!.replace(/\s+/g, '');
}

function getUsableComponentName(component: string | undefined): string | undefined {
  const name = component?.trim();
  if (!name || NON_COMPONENT_NAMES.has(name.split('.')[0]!) || !META_COMPONENT_NAME.test(name)) {
    return undefined;
  }
  return name;
}

/**
 * Either the extraction failed with a {@link DocgenError}, or it produced the fields both the
 * primary payload and a subcomponent entry need — the followed module `path` plus the
 * `vue-component-meta` source they render from.
 */
type ExtractedVueComponentDocgen =
  | { error: DocgenError }
  | (Pick<
      DocgenSubcomponent,
      'description' | 'summary' | 'jsDocTags' | 'argTypes' | 'apiDescription'
    > & {
      path: string;
      componentMeta: MetaSource;
    });

/**
 * The one extraction chain behind the primary component and each declared subcomponent: follow
 * re-exports, collect `vue-component-meta` sources for the declaring module, then derive the
 * description, argTypes, and API description in that module's scope. Returns a {@link DocgenError}
 * instead of throwing when the module has no metadata for the export, so each caller decides how
 * the failure surfaces.
 */
async function extractVueComponentDocgen(
  context: BuildDocgenContext,
  resolvedComponent: { path: string; exportName: string },
  { metaJsDoc, errorContext = '' }: { metaJsDoc?: string; errorContext?: string } = {}
): Promise<ExtractedVueComponentDocgen> {
  const checker = context.getChecker(resolvedComponent.path);
  // Resolving the barrel first also means the description pass reads the declaring SFC rather than
  // the index file, which has no component in it to read descriptions from.
  const declaredExport = followReExport(
    checker,
    resolvedComponent.path,
    resolvedComponent.exportName
  ) ?? {
    path: resolvedComponent.path,
    exportName: resolvedComponent.exportName,
  };
  const metaSources = await collectComponentMetaSources(
    checker,
    declaredExport.path,
    context.typescript
  );
  const componentMeta = metaSources.find((meta) => meta.exportName === declaredExport.exportName);
  if (!componentMeta) {
    return {
      error: {
        name: 'No docgen found',
        message: `vue-component-meta extracted no component metadata for the "${declaredExport.exportName}" export of ${declaredExport.path}${errorContext}.`,
      } satisfies DocgenError,
    };
  }

  const { description, summary, jsDocTags } = extractComponentDescription(
    metaJsDoc,
    componentMeta.description,
    componentMeta.jsDocTags
  );

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
    description,
    summary,
    jsDocTags,
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
  const failure = (error: DocgenError): DocgenSubcomponent => ({
    name: declared.componentName,
    path: storyFilePath,
    jsDocTags: {},
    error,
  });

  try {
    const resolved = resolveMetaComponent(csf, storyPath, declared.node);
    if ('reason' in resolved) {
      return failure(
        unresolvedComponentError(resolved.reason, `meta.subcomponents.${declared.name}`)
      );
    }

    const extracted = await extractVueComponentDocgen(context, resolved.component, {
      errorContext: ` (subcomponent "${declared.name}")`,
    });
    if ('error' in extracted) {
      return failure(extracted.error);
    }

    return {
      name: declared.componentName,
      path: extracted.path,
      description: extracted.description,
      summary: extracted.summary,
      jsDocTags: extracted.jsDocTags,
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

/**
 * Builds a {@link DocgenPayload} for the component one CSF story file documents.
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<VueDocgenPayload | undefined> {
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

  const baseFor = (name: string) =>
    ({
      id: getComponentIdFromEntry(input.entry),
      name,
      path: storyFilePath,
      jsDocTags: {},
    }) satisfies Partial<VueDocgenPayload>;

  let csf;
  try {
    csf = loadCsf(storyFile, { makeTitle: () => input.entry.title }).parse();
  } catch (error) {
    return {
      ...baseFor(fallbackName),
      error: {
        name: 'Story file could not be parsed',
        message:
          `${error instanceof Error ? error.message : String(error)}` +
          `\n\n${input.entry.importPath}:\n${storyFile}`,
      },
    };
  }

  const authoredComponentName = getUsableComponentName(csf._meta?.component);
  const base = baseFor(authoredComponentName ?? fallbackName);

  const resolved = resolveMetaComponent(csf, storyPath);
  if ('reason' in resolved) {
    // Without meta.component there is no declaration to name — the story file itself is what is
    // missing; every other reason points at the meta.component reference it could not follow.
    const error = unresolvedComponentError(
      resolved.reason,
      resolved.reason === 'no-meta-component' ? 'your story file' : 'meta.component'
    );
    return {
      ...base,
      error: {
        name: error.name,
        message:
          (csf._metaStatementPath?.buildCodeFrameError(error.message).message ?? error.message) +
          `\n\n${input.entry.importPath}:\n${storyFile}`,
      },
    };
  }

  const { component } = resolved;
  const metaJsDoc = extractDescription(csf._metaStatement) || undefined;

  // The primary and its declared subcomponents share one extraction chain and run concurrently:
  // the children are independent and every failure stays isolated to its own entry, while
  // Promise.all keeps the CSF declaration order in the record. The key is omitted entirely when
  // nothing is declared, so payloads for story files without subcomponents stay byte-identical.
  const [primaryDocgen, subcomponentEntries] = await Promise.all([
    extractVueComponentDocgen(context, component, { metaJsDoc }),
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
    return { ...base, error: primaryDocgen.error };
  }

  return {
    ...baseFor((authoredComponentName ?? primaryDocgen.componentMeta.displayName) || fallbackName),
    description: primaryDocgen.description,
    summary: primaryDocgen.summary,
    jsDocTags: primaryDocgen.jsDocTags,
    vueComponentMeta: primaryDocgen.componentMeta,
    argTypes: primaryDocgen.argTypes,
    apiDescription: primaryDocgen.apiDescription,
    renderer: 'vue3',
    ...(Object.keys(subcomponentEntries).length > 0 ? { subcomponents: subcomponentEntries } : {}),
  };
}
