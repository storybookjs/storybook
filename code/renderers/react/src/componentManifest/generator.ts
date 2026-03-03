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

import { ComponentMetaManager } from './checker';
import type { ComponentDoc } from './componentMetaExtractor';
import { getCodeSnippet } from './generateCodeSnippet';
import {
  type TypescriptOptions,
  docgenTimings,
  getComponents,
  getImports,
  resetDocgenTimings,
} from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { type DocObj } from './reactDocgen';
import { type ComponentDocWithExportName, invalidateParser } from './reactDocgenTypescript';
import { cachedFindUp, cachedReadFileSync, invalidateCache, invariant } from './utils';

interface ReactComponentManifest extends ComponentManifest {
  reactDocgen?: DocObj;
  reactDocgenTypescript?: ComponentDocWithExportName;
  reactComponentMeta?: ComponentDoc;
}

// ---------------------------------------------------------------------------
// Eager singleton ComponentMetaManager — created as soon as this preset is
// loaded so TypeScript is already warm by the first manifests() call.
// Survives across dev requests, dies on build process exit.
// TypeScript is an optional peer dep.
//
// Dev mode (primary flow): the `watch` flag from the preset options enables
// file watching. Actual fs.watch instances are created lazily when projects
// are discovered during the first extraction. Subsequent requests benefit
// from incremental updates — only changed files are recompiled.
//
// Build mode: watch is false — no watchers, no event handling. One-shot.
// ---------------------------------------------------------------------------

const managerWarmup: Promise<ComponentMetaManager | null> = (async () => {
  try {
    const ts = await import('typescript');
    const manager = new ComponentMetaManager(ts);

    // Clean up TS LanguageService instances + watchers on process exit.
    // The dev server has no shutdown hook, so we rely on process events.
    process.on('exit', () => manager.dispose());
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        try {
          manager.dispose();
        } catch {
          // Best-effort cleanup — don't prevent the process from exiting.
        }
        process.kill(process.pid, signal);
      });
    }

    return manager;
  } catch {
    logger.debug(
      '[reactComponentMeta] TypeScript not available, skipping component meta extraction'
    );
    return null;
  }
})();

/**
 * Context needed for prop extraction, kept separate from the manifest object. Avoids injecting temp
 * fields onto the manifest and cleaning them up via `any`.
 */
interface ComponentMetaContext {
  componentPath: string;
  importName?: string;
  importId?: string;
  storyFilePath: string;
  /**
   * For compound components (e.g. `<Accordion.Root>`), the sub-property name detected from the
   * story's JSX usage. Tells the extractor to match `<Accordion.Root />` JSX elements.
   */
  memberAccess?: string;
}

function findMatchingComponent(
  components: ReturnType<typeof getComponents>,
  componentName: string | undefined,
  trimmedTitle: string
) {
  const byName = (it: (typeof components)[number]) =>
    [it.componentName, it.localImportName, it.importName].includes(componentName!);
  const byTitle = (it: (typeof components)[number]) =>
    trimmedTitle.includes(it.componentName) ||
    (it.localImportName && trimmedTitle.includes(it.localImportName)) ||
    (it.importName && trimmedTitle.includes(it.importName));

  let matches = componentName ? components.filter(byName) : components.filter(byTitle);

  // If componentName was given but none of the matches have JSX usage,
  // the component is likely a namespace object (e.g. Accordion) rather than
  // a renderable component. Fall back to title matching instead.
  if (componentName && matches.length > 0 && matches.every((m) => m.jsxDepth === undefined)) {
    matches = components.filter(byTitle);
  }

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
  // `watch` is injected by the dev server but not declared in the preset function signature.
  const { manifestEntries, presets, watch } = options as typeof options & { watch?: boolean };
  const typescriptOptions =
    (await presets?.apply<Partial<TypescriptOptions>>('typescript', {})) ?? {};

  invalidateCache();
  invalidateParser();

  const startTime = performance.now();

  // managerWarmup was kicked off at module load time — TypeScript should
  // already be imported and the manager ready by now.

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

  const results = entriesByUniqueComponent
    .map(
      (
        entry
      ):
        | { manifest: ReactComponentManifest; componentMetaCtx?: ComponentMetaContext }
        | undefined => {
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
            ...(reactDocgenTypescriptDoc
              ? { reactDocgenTypescript: reactDocgenTypescriptDoc }
              : {}),
            jsDocTags,
            error:
              (docgenResult?.type === 'error' ? docgenResult.error : undefined) ??
              component.reactDocgenTypescriptError,
          } satisfies ReactComponentManifest,
          componentMetaCtx: component.path
            ? {
                componentPath: component.path,
                importName: component.importName,
                importId: component.importId,
                storyFilePath: absoluteImportPath,
                memberAccess: component.member,
              }
            : undefined,
        };
      }
    )
    .filter((r) => r !== undefined);

  const docgenDurationMs = Math.round(performance.now() - docgenStartTime);

  const components = results.map((r) => r.manifest);
  const componentMetaContextById = new Map(
    results
      .filter((r) => r.componentMetaCtx)
      .map((r) => [r.manifest.id, r.componentMetaCtx!] as const)
  );

  // --- reactComponentMeta: probe-free extraction from story JSX ---
  let componentMetaCount = 0;
  const manager = await managerWarmup;
  const componentMetaStartTime = performance.now();
  const componentMetaDebug: Record<string, unknown> = {};
  if (manager) {
    // Group components by project for batch extraction — one getProgram() per project.
    type ProjectEntry = { component: ComponentManifest; ctx: ComponentMetaContext };
    const byProject = new Map<ReturnType<typeof manager.getProjectForFile>, ProjectEntry[]>();
    for (const component of components) {
      const ctx = componentMetaContextById.get(component.id);
      if (!ctx) {
        continue;
      }
      try {
        const project = manager.getProjectForFile(ctx.storyFilePath);
        let entries = byProject.get(project);
        if (!entries) {
          entries = [];
          byProject.set(project, entries);
        }
        entries.push({ component, ctx });
      } catch (err) {
        logger.debug(
          `[reactComponentMeta] Failed to find project for ${ctx.storyFilePath}: ${err}`
        );
      }
    }

    const t1 = performance.now();
    for (const [project, entries] of byProject) {
      const extractionResults = project.extractPropsFromStories(
        entries.map(({ ctx }) => ({
          storyFilePath: ctx.storyFilePath,
          componentPath: ctx.componentPath,
          exportName: ctx.importName ?? 'default',
          importId: ctx.importId,
          memberAccess: ctx.memberAccess,
        }))
      );

      for (const { component, ctx } of entries) {
        const docs = extractionResults.get(ctx.storyFilePath)?.get(ctx.importName ?? 'default');
        if (docs && docs.length > 0) {
          (component as ReactComponentManifest).reactComponentMeta = docs[0];
          componentMetaCount++;
        }
      }
    }
    componentMetaDebug.extractionMs = Math.round(performance.now() - t1);
    componentMetaDebug.components = components.length;

    // Start watching AFTER extraction — projects and TS programs are now populated,
    // so watchProgramSourceDirs() can discover all source file directories
    // (including those reached via path aliases in monorepo setups).
    if (watch) {
      manager.startWatching();
    }
  }
  const componentMetaDurationMs = Math.round(performance.now() - componentMetaStartTime);

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
          reactComponentMeta: componentMetaDurationMs,
          reactComponentMetaComponents: componentMetaCount,
        },
        debug: componentMetaDebug,
      },
    },
  };
};
