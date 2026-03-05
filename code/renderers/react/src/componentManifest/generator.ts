import { recast } from 'storybook/internal/babel';
import { Tag } from 'storybook/internal/core-server';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import type { DocsIndexEntry, IndexEntry } from 'storybook/internal/types';
import {
  type ComponentManifest,
  type PresetPropertyFn,
  type StorybookConfigRaw,
} from 'storybook/internal/types';

import { uniqBy } from 'es-toolkit/array';
import path from 'pathe';

import { ComponentMetaManager } from './checker';
import type { ComponentDoc } from './componentMetaExtractor';
import { getCodeSnippet } from './generateCodeSnippet';
import { type TypescriptOptions, getComponents, getImports } from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj } from './reactDocgen';
import { type ComponentDocWithExportName, invalidateParser } from './reactDocgenTypescript';
import { cachedFindUp, cachedReadFileSync, invalidateCache, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
  reactComponentMeta?: ComponentDoc;
}

function findMatchingComponent(
  components: ReturnType<typeof getComponents>,
  componentName: string | undefined,
  title: string
) {
  // When meta.component is set, find the exact match.
  // meta.component is the local variable name (e.g. "Button", "Accordion"),
  // and getComponents adds it to the component set as-is, so componentName matches directly.
  if (componentName) {
    return components.find((it) => it.componentName === componentName);
  }

  // No meta.component — guess by title match.
  const trimmedTitle = title.replace(/\s+/g, '');
  const matches = components.filter(
    (it) =>
      trimmedTitle.includes(it.componentName) ||
      (it.localImportName && trimmedTitle.includes(it.localImportName)) ||
      (it.importName && trimmedTitle.includes(it.importName))
  );

  if (matches.length <= 1) {
    return matches[0];
  }

  // Prefer the outermost component (shallowest JSX nesting depth)
  return matches.reduce((best, cur) =>
    (cur.jsxDepth ?? Infinity) < (best.jsxDepth ?? Infinity) ? cur : best
  );
}

function getPackageInfo(componentPath: string | undefined, fallbackPath: string) {
  const nearestPkg = cachedFindUp('package.json', {
    cwd: path.dirname(componentPath ?? fallbackPath),
  });

  try {
    return nearestPkg
      ? JSON.parse(cachedReadFileSync(nearestPkg, 'utf-8') as string).name
      : undefined;
  } catch {
    return undefined;
  }
}

function extractStories(
  csf: ReturnType<ReturnType<typeof loadCsf>['parse']>,
  componentName: string | undefined,
  manifestEntries: IndexEntry[]
) {
  const manifestEntryIds = new Set(manifestEntries.map((entry) => entry.id));
  return Object.entries(csf._stories)
    .filter(([, story]) =>
      // Only include stories that are in the list of entries already filtered for the 'manifest' tag
      manifestEntryIds.has(story.id)
    )
    .map(([storyExport, story]) => {
      try {
        const jsdocComment = extractDescription(csf._storyStatements[storyExport]);
        const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
        const finalDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

        return {
          id: story.id,
          name: story.name ?? storyNameFromExport(storyExport),
          snippet: recast.print(getCodeSnippet(csf, storyExport, componentName)).code,
          description: finalDescription?.trim(),
          summary: tags.summary?.[0],
        };
      } catch (e) {
        invariant(e instanceof Error);
        return {
          id: story.id,
          name: story.name ?? storyNameFromExport(storyExport),
          error: { name: e.name, message: e.message },
        };
      }
    });
}

function extractComponentDescription(
  metaJsDoc: string | undefined,
  docgenDescription: string | undefined
) {
  const jsdocComment = metaJsDoc || docgenDescription;
  const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
  return {
    description: ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim(),
    summary: tags.summary?.[0],
    jsDocTags: tags,
  };
}

type DocgenEngine = 'react-docgen' | 'react-docgen-typescript' | 'react-component-meta';

export const manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[]; watch: boolean }
> = async (existingManifests = {}, options) => {
  const { manifestEntries, presets, watch } = options;
  const typescriptOptions =
    (await presets?.apply<Partial<TypescriptOptions>>('typescript', {})) ?? {};
  const features = await presets?.apply('features', {});

  const docgenEngine: DocgenEngine = features?.experimentalReactComponentMeta
    ? 'react-component-meta'
    : (typescriptOptions.reactDocgen ?? 'react-docgen');

  invalidateCache();
  invalidateParser();

  const startTime = performance.now();
  const manager =
    docgenEngine === 'react-component-meta' ? await ComponentMetaManager.getInstance() : null;

  const entriesByUniqueComponent = uniqBy(
    manifestEntries.filter(
      (entry) =>
        (entry.type === 'story' && entry.subtype === 'story') ||
        // addon-docs will add docs entries to these manifest entries afterwards
        // Docs entries have importPath pointing to MDX file, but storiesImports[0] points to the story file
        (entry.type === 'docs' &&
          entry.tags?.includes(Tag.ATTACHED_MDX) &&
          entry.storiesImports.length > 0)
    ),
    (entry) => entry.id.split('--')[0]
  );

  // Step 1: Resolve components for all entries
  const resolvedEntries = entriesByUniqueComponent.map((entry) => {
    const storyFilePath =
      entry.type === 'story'
        ? entry.importPath
        : // For attached docs entries, storiesImports[0] points to the stories file being attached to
          (entry as DocsIndexEntry).storiesImports[0];
    const absoluteImportPath = path.join(process.cwd(), storyFilePath);
    const storyFile = cachedReadFileSync(absoluteImportPath, 'utf-8') as string;
    const csf = loadCsf(storyFile, { makeTitle: () => entry.title }).parse();
    const componentName = csf._meta?.component;
    const allComponents = getComponents({
      csf,
      storyFilePath: absoluteImportPath,
      typescriptOptions,
      experimentalReactComponentMeta: docgenEngine === 'react-component-meta',
    });
    const component = findMatchingComponent(
      allComponents,
      componentName,
      entry.title
    );
    return {
      entry,
      storyFilePath,
      absoluteImportPath,
      storyFile,
      csf,
      componentName,
      allComponents,
      component,
    };
  });

  // Step 2: Batch extract rcm props (one TS program build per tsconfig project)
  const rcmResults =
    docgenEngine === 'react-component-meta' && manager
      ? manager.batchExtract(resolvedEntries)
      : undefined;

  // Step 3: Build manifests
  const components = resolvedEntries
    .map(
      ({
        entry,
        storyFilePath,
        absoluteImportPath,
        storyFile,
        csf,
        componentName,
        allComponents,
        component,
      }): ReactComponentManifest | undefined => {
        const id = entry.id.split('--')[0];
        const title = entry.title.split('/').at(-1)!.replace(/\s+/g, '');

        const packageName = getPackageInfo(component?.path, absoluteImportPath);
        const fallbackImport =
          packageName && componentName ? `import { ${componentName} } from "${packageName}";` : '';
        const imports =
          getImports({ components: allComponents, packageName }).join('\n').trim() ||
          fallbackImport;

        const stories = extractStories(csf, component?.componentName, manifestEntries);

        const base = {
          id,
          name: componentName ?? title,
          path: storyFilePath,
          stories,
          import: imports,
          jsDocTags: {},
        } satisfies Partial<ComponentManifest>;

        // --- Extract props via the active engine ---
        let reactDocgen;
        let reactDocgenTypescript;
        let reactComponentMeta;
        let docgenDescription;
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
          const exportName = component?.importName ?? 'default';
          reactComponentMeta = rcmResults?.get(absoluteImportPath)?.get(exportName)?.[0];
          docgenDescription = reactComponentMeta?.description;
        }

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
            error: docgenError ?? {
              name: error.name,
              message:
                (csf._metaStatementPath?.buildCodeFrameError(error.message).message ??
                  error.message) + `\n\n${entry.importPath}:\n${storyFile}`,
            },
          };
        }

        const metaJsDoc = extractDescription(csf._metaStatement) || undefined;
        const { description, summary, jsDocTags } = extractComponentDescription(
          metaJsDoc,
          docgenDescription
        );

        return {
          ...base,
          description,
          summary,
          import: imports,
          reactDocgen,
          reactDocgenTypescript,
          reactComponentMeta,
          jsDocTags,
          error: docgenError,
        };
      }
    )
    .filter((component) => component !== undefined);

  // Start watching AFTER extraction — projects and TS programs are now populated,
  // so watchProgramSourceDirs() can discover all source file directories.
  if (manager && watch) {
    manager.startWatching();
  }

  const durationMs = Math.round(performance.now() - startTime);

  return {
    ...existingManifests,
    components: {
      v: 0,
      components: Object.fromEntries(components.map((component) => [component.id, component])),
      meta: {
        docgen: docgenEngine,
        durationMs,
      },
    },
  };
};
