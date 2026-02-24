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

import { logger } from 'storybook/internal/node-logger';

import { getCodeSnippet } from './generateCodeSnippet';
import {
  type TypescriptOptions,
  docgenTimings,
  getComponents,
  getImports,
  resetDocgenTimings,
} from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { PropExtractionManager } from './lsp';
import type { ComponentDoc } from './propExtractor';
import { type DocObj } from './reactDocgen';
import { type ComponentDocWithExportName, invalidateParser } from './reactDocgenTypescript';
import { cachedFindUp, cachedReadFileSync, invalidateCache, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
  reactPropTypes?: ComponentDoc;
}

// ---------------------------------------------------------------------------
// Lazy singleton PropExtractionManager — survives across dev requests,
// dies on build process exit. TypeScript is an optional peer dep.
// ---------------------------------------------------------------------------

let propTypesManagerPromise: Promise<PropExtractionManager | null> | undefined;

function getPropTypesManager(): Promise<PropExtractionManager | null> {
  if (!propTypesManagerPromise) {
    propTypesManagerPromise = (async () => {
      try {
        const ts = await import('typescript');
        return new PropExtractionManager(ts);
      } catch (error) {
        logger.debug('[reactPropTypes] TypeScript not available, skipping prop extraction');
        return null;
      }
    })();
  }
  return propTypesManagerPromise;
}

/**
 * Context needed for prop extraction, kept separate from the manifest object.
 * Avoids injecting temp fields onto the manifest and cleaning them up via `any`.
 */
interface PropTypesContext {
  componentPath: string;
  importName?: string;
  importId?: string;
  storyFilePath: string;
  /**
   * For compound components (e.g. `<Accordion.Root>`), the sub-property
   * name detected from the story's JSX usage. Tells the probe to generate
   * `<Accordion.Root />` instead of `<Accordion />`.
   */
  memberAccess?: string;
}

function findMatchingComponent(
  components: ReturnType<typeof getComponents>,
  componentName: string | undefined,
  trimmedTitle: string
) {
  const isMatch = (it: (typeof components)[number]) =>
    componentName
      ? [it.componentName, it.localImportName, it.importName].includes(componentName)
      : trimmedTitle.includes(it.componentName) ||
        (it.localImportName && trimmedTitle.includes(it.localImportName)) ||
        (it.importName && trimmedTitle.includes(it.importName));

  const matches = components.filter(isMatch);
  if (matches.length <= 1) return matches[0];

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
  csf: ReturnType<ReturnType<typeof loadCsf>['parse']>,
  docgen: { description?: string } | undefined
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
> = async (existingManifests = {}, options) => {
  const { manifestEntries, presets } = options;
  const typescriptOptions =
    (await presets?.apply<Partial<TypescriptOptions>>('typescript', {})) ?? {};

  invalidateCache();
  invalidateParser();

  const startTime = performance.now();

  // Kick off TypeScript import + manager creation immediately.
  // This runs in parallel with the docgen pass below, so by the time
  // the sequential reactPropTypes loop starts, TS is already loaded.
  const managerWarmup = getPropTypesManager();

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

  resetDocgenTimings();
  const docgenStartTime = performance.now();

  const results = (
    await Promise.all(
      entriesByUniqueComponent.map(async (entry): Promise<{ manifest: ReactComponentManifest; propTypesCtx?: PropTypesContext } | undefined> => {
      const storyFilePath =
        entry.type === 'story'
          ? entry.importPath
          : // For attached docs entries, storiesImports[0] points to the stories file being attached to
            (entry as DocsIndexEntry).storiesImports[0];
      const absoluteImportPath = path.join(process.cwd(), storyFilePath);
      const storyFile = cachedReadFileSync(absoluteImportPath, 'utf-8') as string;
      const csf = loadCsf(storyFile, { makeTitle: () => entry.title }).parse();

      const componentName = csf._meta?.component;
      const id = entry.id.split('--')[0];
      const title = entry.title.split('/').at(-1)!.replace(/\s+/g, '');

      const allComponents = getComponents({
        csf,
        storyFilePath: absoluteImportPath,
        typescriptOptions,
      });
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

      const hasDocgen = component?.reactDocgen || component?.reactDocgenTypescript;

      if (!hasDocgen) {
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
          manifest: {
            ...base,
            error: {
              name: error.name,
              message:
                (csf._metaStatementPath?.buildCodeFrameError(error.message).message ??
                  error.message) + `\n\n${entry.importPath}:\n${storyFile}`,
            },
          },
        };
      }

      // Extract description from whichever engine is active
      const docgenResult = component.reactDocgen;
      const docgen = docgenResult?.type === 'success' ? docgenResult.data : undefined;
      const reactDocgenTypescriptDoc = component.reactDocgenTypescript;

      // Use react-docgen description if available, fall back to RDT description
      const docgenDescription = docgen?.description ?? reactDocgenTypescriptDoc?.description;
      const { description, summary, jsDocTags } = extractComponentDescription(
        csf,
        docgenDescription ? { description: docgenDescription } : undefined
      );

      return {
        manifest: {
          ...base,
          description,
          summary,
          import: imports,
          ...(docgen ? { reactDocgen: docgen } : {}),
          ...(reactDocgenTypescriptDoc ? { reactDocgenTypescript: reactDocgenTypescriptDoc } : {}),
          jsDocTags,
          error:
            (docgenResult?.type === 'error' ? docgenResult.error : undefined) ??
            component.reactDocgenTypescriptError,
        } satisfies ReactComponentManifest,
        propTypesCtx: component.path
          ? {
              componentPath: component.path,
              importName: component.importName,
              importId: component.importId,
              storyFilePath: absoluteImportPath,
              memberAccess: component.member,
            }
          : undefined,
      };
    })
    )
  ).filter((r) => r !== undefined);

  const docgenDurationMs = Math.round(performance.now() - docgenStartTime);

  const components = results.map((r) => r.manifest);
  const componentsById = new Map(components.map((c) => [c.id, c] as const));
  const propTypesContextById = new Map(
    results
      .filter((r) => r.propTypesCtx)
      .map((r) => [r.manifest.id, r.propTypesCtx!] as const)
  );

  // --- reactPropTypes: bulk extraction (one probe + one getProgram per project) ---
  const propTypesStartTime = performance.now();
  let propTypesCount = 0;
  const manager = await managerWarmup;
  const propTypesDebug: Record<string, unknown> = {};
  if (manager) {
    const t0 = performance.now();
    manager.invalidate();
    propTypesDebug.invalidateMs = Math.round(performance.now() - t0);

    // Group local-file contexts by project for bulk extraction
    const localByProject = new Map<ReturnType<typeof manager.getProjectForFile>, { id: string; ctx: PropTypesContext }[]>();
    const packageContexts: { id: string; ctx: PropTypesContext }[] = [];

    const t1 = performance.now();
    for (const component of components) {
      const ctx = propTypesContextById.get(component.id);
      if (!ctx) continue;
      const isPackageImport = ctx.importId && !ctx.importId.startsWith('.');
      if (isPackageImport) {
        packageContexts.push({ id: component.id, ctx });
        continue;
      }
      try {
        const project = manager.getProjectForFile(ctx.componentPath);
        let group = localByProject.get(project);
        if (!group) {
          group = [];
          localByProject.set(project, group);
        }
        group.push({ id: component.id, ctx });
      } catch {
        // skip files that can't find a project
      }
    }
    propTypesDebug.groupingMs = Math.round(performance.now() - t1);
    propTypesDebug.localProjects = localByProject.size;
    propTypesDebug.localFiles = [...localByProject.values()].reduce((s, g) => s + g.length, 0);
    propTypesDebug.packageImports = packageContexts.length;

    // Bulk-extract local files: one probe + one getProgram() per project
    const bulkDebug: Array<Record<string, unknown>> = [];
    for (const [project, entries] of localByProject) {
      try {
        const filePaths = entries.map((e) => e.ctx.componentPath);
        const tBulk = performance.now();
        const bulkResults = project.extractDocsBulk(filePaths);
        const bulkMs = Math.round(performance.now() - tBulk);
        bulkDebug.push({ files: filePaths.length, ms: bulkMs, config: project.configPath ?? 'inferred', ...project.lastBulkDebug });

        for (const entry of entries) {
          const docs = bulkResults.get(entry.ctx.componentPath);
          const doc = docs?.find((d) => d.exportName === (entry.ctx.importName ?? 'default'));
          if (doc) {
            const component = componentsById.get(entry.id);
            if (component) {
              (component as ReactComponentManifest).reactPropTypes = doc;
              propTypesCount++;
            }
          }
        }
      } catch (error) {
        logger.debug(`[reactPropTypes] bulk extraction failed`);
      }
    }
    propTypesDebug.bulkExtractions = bulkDebug;

    // Package imports: group by project, then bulk-extract per project
    const tPkg = performance.now();
    let pkgCount = 0;
    const pkgByProject = new Map<ReturnType<typeof manager.getProjectForFile>, { id: string; ctx: PropTypesContext }[]>();
    for (const entry of packageContexts) {
      if (!entry.ctx.importName) continue;
      try {
        const project = manager.getProjectForFile(entry.ctx.storyFilePath);
        let group = pkgByProject.get(project);
        if (!group) {
          group = [];
          pkgByProject.set(project, group);
        }
        group.push(entry);
      } catch {
        // skip
      }
    }
    const pkgBulkDebug: Array<Record<string, unknown>> = [];
    for (const [project, entries] of pkgByProject) {
      try {
        const bulkEntries = entries.map((e) => ({
          importSpecifier: e.ctx.importId!,
          exportName: e.ctx.importName!,
          memberAccess: e.ctx.memberAccess,
        }));
        const tBulk = performance.now();
        const bulkResults = project.extractDocsByImportBulk(bulkEntries);
        const bulkMs = Math.round(performance.now() - tBulk);
        pkgBulkDebug.push({ specifiers: bulkEntries.length, ms: bulkMs, config: project.configPath ?? 'inferred' });

        for (const entry of entries) {
          const mapKey = `${entry.ctx.importId!}::${entry.ctx.importName!}`;
          const doc = bulkResults.get(mapKey);
          if (doc) {
            const component = componentsById.get(entry.id);
            if (component) {
              (component as ReactComponentManifest).reactPropTypes = doc;
              propTypesCount++;
              pkgCount++;
            }
          }
        }
      } catch {
        logger.debug(`[reactPropTypes] bulk package extraction failed`);
      }
    }
    if (packageContexts.length > 0) {
      propTypesDebug.packageImportsMs = Math.round(performance.now() - tPkg);
      propTypesDebug.packageImportsExtracted = pkgCount;
      propTypesDebug.packageBulkExtractions = pkgBulkDebug;
    }
  }
  const propTypesDurationMs = Math.round(performance.now() - propTypesStartTime);

  const durationMs = Math.round(performance.now() - startTime);

  return {
    ...existingManifests,
    components: {
      v: 0,
      components: Object.fromEntries(components.map((component) => [component.id, component])),
      meta: {
        docgen: typescriptOptions.reactDocgen ?? 'react-docgen',
        durationMs,
        timings: {
          docgen: docgenDurationMs,
          reactDocgen: Math.round(docgenTimings.reactDocgenMs),
          reactDocgenTypescript: Math.round(docgenTimings.reactDocgenTypescriptMs),
          reactPropTypes: propTypesDurationMs,
          reactPropTypesComponents: propTypesCount,
        },
        debug: propTypesDebug,
      },
    },
  };
};
