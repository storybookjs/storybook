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

import path from 'pathe';

import { ComponentMetaManager } from './checker';
import type { ComponentDoc } from './componentMetaExtractor';
import { getCodeSnippet } from './generateCodeSnippet';
import {
  type ComponentRef,
  type TypescriptOptions,
  getComponents,
  getImports,
} from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj } from './reactDocgen';
import { type ComponentDocWithExportName, invalidateParser } from './reactDocgenTypescript';
import { cachedFindUp, cachedReadTextFileSync, invalidateCache, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
  reactComponentMeta?: ComponentDoc;
}

let componentMetaManager: ComponentMetaManager | undefined;

async function createComponentMetaManager(
  watch: boolean
): Promise<ComponentMetaManager | undefined> {
  if (componentMetaManager && watch) {
    return componentMetaManager;
  }
  try {
    const ts = await import('typescript');
    const manager = new ComponentMetaManager(ts);
    if (watch) {
      componentMetaManager = manager;
    }
    return manager;
  } catch {
    logger.debug(
      '[reactComponentMeta] TypeScript not available, skipping component meta extraction'
    );
  }
}

function isAttachedDocsEntry(
  entry: IndexEntry
): entry is DocsIndexEntry & { storiesImports: [string, ...string[]] } {
  return (
    entry.type === 'docs' &&
    entry.tags?.includes(Tag.ATTACHED_MDX) === true &&
    entry.storiesImports.length > 0
  );
}

function selectComponentEntries(manifestEntries: IndexEntry[]) {
  const entriesByComponentId = new Map<string, IndexEntry>();

  manifestEntries
    .filter(
      (entry) =>
        (entry.type === 'story' && entry.subtype === 'story') ||
        // Attached docs entries are the only docs entries that can contribute to a
        // component manifest, because they point back to a story file through storiesImports.
        isAttachedDocsEntry(entry)
    )
    .forEach((entry) => {
      const componentId = entry.id.split('--')[0];
      const existingEntry = entriesByComponentId.get(componentId);

      if (!existingEntry) {
        // Keep the first eligible entry as a fallback so docs-only manifest coverage
        // continues to work when no story entry for that component carries the manifest tag.
        entriesByComponentId.set(componentId, entry);
        return;
      }

      if (existingEntry.type === 'docs' && entry.type === 'story') {
        // When both entries exist for the same component id, the story entry is authoritative.
        // Attached docs may list unrelated stories first in storiesImports, so using the story
        // entry avoids resolving the manifest from the wrong file.
        entriesByComponentId.set(componentId, entry);
      }
    });

  return [...entriesByComponentId.values()];
}

function findMatchingComponent(
  components: ComponentRef[],
  componentName: string | undefined,
  title: string
) {
  // When meta.component is set, find the exact match.
  // meta.component is the local variable name (e.g. "Button", "Accordion"),
  // and getComponents adds it to the component set as-is when it maps cleanly to a component ref.
  // If that strict lookup misses (for example `const Root = Accordion.Root`), continue into the
  // regular title-based candidate selection below.
  if (componentName) {
    const match = components.find((it) => it.componentName === componentName);
    if (match) {
      return match;
    }
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
  docgenDescription: string | undefined,
  docgenJsDocTags?: Record<string, string[]>
) {
  const jsdocComment = metaJsDoc || docgenDescription;
  const extracted = jsdocComment ? extractJSDocInfo(jsdocComment) : undefined;
  const tags = docgenJsDocTags ?? extracted?.tags ?? {};
  const description = extracted?.description;

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
    : typescriptOptions.reactDocgen || 'react-docgen';

  invalidateCache();
  invalidateParser();

  const startTime = performance.now();
  const manager =
    docgenEngine === 'react-component-meta' ? await createComponentMetaManager(watch) : null;

  try {
    const entriesByUniqueComponent = selectComponentEntries(manifestEntries);

    // Step 1: Resolve components for all entries
    const resolvedEntries = await Promise.all(
      entriesByUniqueComponent.map(async (entry) => {
        const storyFilePath =
          entry.type === 'story'
            ? entry.importPath
            : // For attached docs entries, storiesImports[0] points to the stories file being attached to
              entry.storiesImports[0];
        const storyPath = path.join(process.cwd(), storyFilePath);
        const storyFile = cachedReadTextFileSync(storyPath);
        const csf = loadCsf(storyFile, { makeTitle: () => entry.title }).parse();
        const componentName = csf._meta?.component;
        const allComponents = await getComponents({
          csf,
          storyFilePath: storyPath,
          typescriptOptions,
          docgenEngine,
        });
        const component = findMatchingComponent(allComponents, componentName, entry.title);
        return {
          storyPath,
          component,
          entry,
          storyFilePath,
          storyFile,
          csf,
          componentName,
          allComponents,
        };
      })
    );

    // Step 2: Batch extract rcm props (one TS program build per tsconfig project)
    if (docgenEngine === 'react-component-meta' && manager) {
      manager.batchExtract(resolvedEntries);
    }

    // Step 3: Build manifests
    const components = resolvedEntries
      .map(
        ({
          storyPath,
          component,
          entry,
          storyFilePath,
          storyFile,
          csf,
          componentName,
          allComponents,
        }): ReactComponentManifest | undefined => {
          const id = entry.id.split('--')[0];
          const title = entry.title.split('/').at(-1)!.replace(/\s+/g, '');

          const packageName = getPackageInfo(component?.path, storyPath);
          const fallbackImport =
            packageName && componentName
              ? `import { ${componentName} } from "${packageName}";`
              : '';
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
            reactComponentMeta = component?.reactComponentMeta;
            docgenDescription = reactComponentMeta?.description;
            docgenJsDocTags = component?.componentJsDocTags;
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
            docgenDescription,
            docgenJsDocTags
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
  } finally {
    if (manager && !watch) {
      manager.dispose();
    }
  }
};
