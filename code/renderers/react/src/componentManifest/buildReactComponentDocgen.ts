import { getComponentIdFromEntry } from 'storybook/internal/common';
import { extractDescription } from 'storybook/internal/csf-tools';
import type {
  ComponentManifest,
  ComponentSubcomponentManifest,
  IndexEntry,
} from 'storybook/internal/types';

import path from 'pathe';

import type { ComponentDoc, PropItem } from './componentMeta/componentMetaExtractor.ts';
import { extractComponentDescription } from './extractComponentDescription.ts';
import { type ComponentRef, getImports } from './getComponentImports.ts';
import { type DocObj } from './reactDocgen.ts';
import { type ComponentDocWithExportName } from './reactDocgenTypescript.ts';
import {
  type ParsedCsf,
  type ResolvedStory,
  type ResolvedSubcomponent,
  extractStorySnippets,
} from './resolveComponents.ts';
import { cachedFindUp, cachedReadTextFileSync } from './utils.ts';

export type DocgenEngine = 'react-docgen' | 'react-docgen-typescript' | 'react-component-meta';

/** Resolved subcomponent docgen for one declared CSF subcomponent. */
export interface ReactResolvedSubcomponentDocgen {
  name: string;
  path: string;
  description?: string;
  summary?: string;
  import?: string;
  jsDocTags: Record<string, string[]>;
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
  reactComponentMeta?: ComponentDoc;
  error?: { name: string; message: string };
}

/**
 * Canonical React component docgen for one CSF file + index entry. The docgen open service consumes
 * this shape directly; the experimental component manifest adapts it via {@link toReactComponentManifest}.
 */
export interface ReactResolvedComponentDocgen {
  componentId: string;
  name: string;
  path: string;
  stories: ResolvedStory[];
  import?: string;
  description?: string;
  summary?: string;
  jsDocTags: Record<string, string[]>;
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
  reactComponentMeta?: ComponentDoc;
  subcomponents?: Record<string, ReactResolvedSubcomponentDocgen>;
  error?: { name: string; message: string };
}

/** Manifest output still uses `id`; maps from {@link ReactResolvedComponentDocgen}. */
export interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
  reactComponentMeta?: ComponentDoc;
  subcomponents?: Record<string, ReactSubcomponentManifest>;
}

export interface ReactSubcomponentManifest extends ComponentSubcomponentManifest {
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
  reactComponentMeta?: ComponentDoc;
}

function getPackageInfo(componentPath: string | undefined, fallbackPath: string) {
  const nearestPkg = cachedFindUp('package.json', {
    cwd: path.dirname(componentPath ?? fallbackPath),
  });

  try {
    if (!nearestPkg) {
      return undefined;
    }

    const parsed = JSON.parse(cachedReadTextFileSync(nearestPkg));
    return typeof parsed === 'object' &&
      parsed &&
      'name' in parsed &&
      typeof parsed.name === 'string'
      ? parsed.name
      : undefined;
  } catch {
    return undefined;
  }
}

function getFallbackImport(packageName: string | undefined, componentName: string | undefined) {
  const exportName = componentName?.split('.').at(-1);
  return packageName && exportName ? `import { ${exportName} } from "${packageName}";` : '';
}

/**
 * Rewrites the absolute `fileName`s the RCM extractor records on each prop's `parent` /
 * `declarations` into paths relative to the current working directory, so the emitted docgen (both
 * the component manifest and the docgen service) stays portable and machine-independent. Returns a
 * new {@link ComponentDoc}; the cached extractor result is left untouched.
 */
function relativizeComponentMetaPaths(doc: ComponentDoc): ComponentDoc {
  const relativize = (fileName: string) => path.relative(process.cwd(), fileName);
  const relativizeProp = (prop: PropItem): PropItem => ({
    ...prop,
    parent: prop.parent
      ? { ...prop.parent, fileName: relativize(prop.parent.fileName) }
      : prop.parent,
    declarations: prop.declarations?.map((declaration) => ({
      ...declaration,
      fileName: relativize(declaration.fileName),
    })),
  });

  return {
    ...doc,
    props: Object.fromEntries(
      Object.entries(doc.props).map(([name, prop]) => [name, relativizeProp(prop)])
    ),
  };
}

function getComponentDocgenData(component: ComponentRef | undefined, docgenEngine: DocgenEngine) {
  let reactDocgen;
  let reactDocgenTypescript;
  let reactComponentMeta;
  let docgenDescription;
  let docgenJsDocTags;
  let docgenError;

  if (docgenEngine === 'react-docgen') {
    const result = component?.reactDocgen;
    reactDocgen = result?.type === 'success' ? result.data : undefined;
    docgenDescription = reactDocgen?.description;
    docgenError = result?.type === 'error' ? result.error : undefined;
  } else if (docgenEngine === 'react-docgen-typescript') {
    reactDocgenTypescript = component?.reactDocgenTypescript;
    docgenDescription = reactDocgenTypescript?.description;
    docgenError = component?.reactDocgenTypescriptError;
  } else {
    reactComponentMeta = component?.reactComponentMeta
      ? relativizeComponentMetaPaths(component.reactComponentMeta)
      : undefined;
    docgenDescription = reactComponentMeta?.description;
    docgenJsDocTags = component?.componentJsDocTags;
  }

  return {
    docgenDescription,
    docgenError,
    docgenJsDocTags,
    reactComponentMeta,
    reactDocgen,
    reactDocgenTypescript,
  };
}

function createSubcomponentDocgen({
  component,
  declaredName,
  docgenEngine,
  packageName,
  storyFilePath,
}: {
  component: ComponentRef | undefined;
  declaredName: string;
  docgenEngine: DocgenEngine;
  packageName: string | undefined;
  storyFilePath: string;
}): ReactResolvedSubcomponentDocgen {
  const imports =
    getImports({ components: component ? [component] : [], packageName })
      .join('\n')
      .trim() || getFallbackImport(packageName, component?.componentName);
  const {
    reactDocgen,
    reactDocgenTypescript,
    reactComponentMeta,
    docgenDescription,
    docgenJsDocTags,
    docgenError,
  } = getComponentDocgenData(component, docgenEngine);
  const { description, summary, jsDocTags } = extractComponentDescription(
    undefined,
    docgenDescription,
    docgenJsDocTags
  );

  return {
    name: declaredName,
    path: component?.path ?? storyFilePath,
    description,
    summary,
    import: imports || undefined,
    jsDocTags,
    reactDocgen,
    reactDocgenTypescript,
    reactComponentMeta,
    error:
      docgenError ??
      (!component
        ? {
            name: 'No component import found',
            message: `No component file found for the "${declaredName}" subcomponent.`,
          }
        : undefined),
  };
}

/**
 * Builds resolved React component docgen from a parsed CSF file and index entry. Shared by the
 * docgen provider (RCM) and the experimental manifest generator (all docgen engines).
 */
export function buildReactComponentDocgenFromResolved({
  entry,
  storyPath,
  storyFilePath,
  storyFile,
  csf,
  componentName,
  component,
  allComponents,
  subcomponents,
  docgenEngine,
  filterStoryIds,
}: {
  entry: IndexEntry;
  storyPath: string;
  storyFilePath: string;
  storyFile: string;
  csf: ParsedCsf;
  componentName: string | undefined;
  component: ComponentRef | undefined;
  allComponents: ComponentRef[];
  subcomponents: ResolvedSubcomponent[];
  docgenEngine: DocgenEngine;
  /** When set, only stories whose ids are in the set are included (manifest tag filtering). */
  filterStoryIds?: ReadonlySet<string>;
}): ReactResolvedComponentDocgen {
  const componentId = getComponentIdFromEntry(entry);
  const title = entry.title.split('/').at(-1)!.replace(/\s+/g, '');

  const packageName = getPackageInfo(component?.path, storyPath);
  const fallbackImport = getFallbackImport(packageName, componentName);
  const imports =
    getImports({ components: allComponents, packageName }).join('\n').trim() || fallbackImport;

  const stories = extractStorySnippets(csf, component?.componentName, filterStoryIds);

  const base = {
    componentId,
    name: componentName ?? title,
    path: storyFilePath,
    stories,
    import: imports || undefined,
    jsDocTags: {},
  } satisfies Partial<ReactResolvedComponentDocgen>;

  const {
    reactDocgen,
    reactDocgenTypescript,
    reactComponentMeta,
    docgenDescription,
    docgenJsDocTags,
    docgenError,
  } = getComponentDocgenData(component, docgenEngine);

  if (!reactDocgen && !reactDocgenTypescript && !reactComponentMeta) {
    const error = !csf._meta?.component
      ? {
          name: 'No component found',
          message:
            'We could not detect the component from your story file. Specify meta.component.',
        }
      : {
          name: 'No component import found',
          message: `No component file found for the "${csf.meta.component}" component.`,
        };

    return {
      ...base,
      jsDocTags: base.jsDocTags ?? {},
      error: docgenError ?? {
        name: error.name,
        message:
          (csf._metaStatementPath?.buildCodeFrameError(error.message).message ?? error.message) +
          `\n\n${entry.importPath}:\n${storyFile}`,
      },
    };
  }

  const metaJsDoc = extractDescription(csf._metaStatement) || undefined;
  const { description, summary, jsDocTags } = extractComponentDescription(
    metaJsDoc,
    docgenDescription,
    docgenJsDocTags
  );
  const subcomponentEntries = Object.fromEntries(
    subcomponents.map((subcomponent) => [
      subcomponent.name,
      createSubcomponentDocgen({
        component: subcomponent.component,
        declaredName: subcomponent.name,
        docgenEngine,
        packageName,
        storyFilePath,
      }),
    ])
  );

  return {
    ...base,
    description,
    summary,
    import: imports || undefined,
    reactDocgen,
    reactDocgenTypescript,
    reactComponentMeta,
    jsDocTags,
    ...(Object.keys(subcomponentEntries).length > 0 ? { subcomponents: subcomponentEntries } : {}),
    error: docgenError,
  };
}

/** Adapts resolved docgen into the experimental component manifest schema (`id` instead of `componentId`). */
export function toReactComponentManifest(
  resolved: ReactResolvedComponentDocgen
): ReactComponentManifest {
  const { componentId, subcomponents, ...rest } = resolved;
  return {
    ...rest,
    id: componentId,
    ...(subcomponents
      ? {
          subcomponents: Object.fromEntries(
            Object.entries(subcomponents).map(([key, sub]) => [
              key,
              {
                name: sub.name,
                path: sub.path,
                description: sub.description,
                summary: sub.summary,
                import: sub.import,
                jsDocTags: sub.jsDocTags,
                error: sub.error,
                reactDocgen: sub.reactDocgen,
                reactDocgenTypescript: sub.reactDocgenTypescript,
                reactComponentMeta: sub.reactComponentMeta,
              },
            ])
          ),
        }
      : {}),
  };
}
