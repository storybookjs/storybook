import { recast } from 'storybook/internal/babel';
import { Tag } from 'storybook/internal/core-server';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { DocsIndexEntry, IndexEntry } from 'storybook/internal/types';
import {
  type ComponentManifest,
  type PresetPropertyFn,
  type StorybookConfigRaw,
} from 'storybook/internal/types';

import { uniqBy } from 'es-toolkit/array';
import path from 'pathe';

import { getCodeSnippet } from './generateCodeSnippet';
import { getComponents, getImports } from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj } from './reactDocgen';
import { type ComponentDocWithExportName, invalidateParser } from './reactDocgenTypescript';
import { cachedFindUp, cachedReadFileSync, invalidateCache, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
}

function findMatchingComponent(
  components: ReturnType<typeof getComponents>,
  componentName: string | undefined,
  trimmedTitle: string
) {
  return components.find((it) =>
    componentName
      ? [it.componentName, it.localImportName, it.importName].includes(componentName)
      : trimmedTitle.includes(it.componentName) ||
        (it.localImportName && trimmedTitle.includes(it.localImportName)) ||
        (it.importName && trimmedTitle.includes(it.importName))
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
  csf: ReturnType<ReturnType<typeof loadCsf>['parse']>,
  docgen: DocObj | undefined
) {
  const jsdocComment = extractDescription(csf._metaStatement) || docgen?.description;
  const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
  return {
    description: ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim(),
    summary: tags.summary?.[0],
    jsDocTags: tags,
  };
}

export const manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[] }
> = async (existingManifests = {}, { manifestEntries }) => {
  invalidateCache();
  invalidateParser();

  const startPerformance = performance.now();

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

  const components = entriesByUniqueComponent
    .map((entry): ReactComponentManifest | undefined => {
      const storyFilePath =
        entry.type === 'story'
          ? entry.importPath
          : // For attached docs entries, storiesImports[0] points to the stories file being attached to
            (entry as DocsIndexEntry).storiesImports[0];
      const absoluteImportPath = path.join(process.cwd(), storyFilePath);
      const storyFile = cachedReadFileSync(absoluteImportPath, 'utf-8') as string;
      const csf = loadCsf(storyFile, { makeTitle: (title) => title ?? 'No title' }).parse();

      const componentName = csf._meta?.component;
      const id = entry.id.split('--')[0];
      const title = entry.title.split('/').at(-1)!.replace(/\s+/g, '');

      const allComponents = getComponents({ csf, storyFilePath: absoluteImportPath });
      const component = findMatchingComponent(
        allComponents,
        componentName,
        entry.title.replace(/\s+/g, '')
      );

      const packageName = getPackageInfo(component?.path, absoluteImportPath);
      const fallbackImport =
        packageName && componentName ? `import { ${componentName} } from "${packageName}";` : '';
      const imports =
        getImports({ components: allComponents, packageName }).join('\n').trim() || fallbackImport;

      const stories = extractStories(csf, component?.componentName, manifestEntries);

      const base = {
        id,
        name: componentName ?? title,
        path: storyFilePath,
        stories,
        import: imports,
        jsDocTags: {},
      } satisfies Partial<ComponentManifest>;

      if (!component?.reactDocgen) {
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
          error: {
            name: error.name,
            message:
              (csf._metaStatementPath?.buildCodeFrameError(error.message).message ??
                error.message) + `\n\n${entry.importPath}:\n${storyFile}`,
          },
        };
      }

      const docgenResult = component.reactDocgen;
      const docgen = docgenResult.type === 'success' ? docgenResult.data : undefined;
      const { description, summary, jsDocTags } = extractComponentDescription(csf, docgen);

      return {
        ...base,
        description,
        summary,
        import: imports,
        reactDocgen: docgen,
        ...(component.reactDocgenTypescript
          ? { reactDocgenTypescript: component.reactDocgenTypescript }
          : {}),
        jsDocTags,
        error: docgenResult.type === 'error' ? docgenResult.error : undefined,
      };
    })
    .filter((component) => component !== undefined);

  logger.verbose(`Component manifest generation took ${performance.now() - startPerformance}ms`);

  return {
    ...existingManifests,
    components: {
      v: 0,
      components: Object.fromEntries(components.map((component) => [component.id, component])),
    },
  };
};
