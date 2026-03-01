import { Tag } from 'storybook/internal/core-server';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription as extractCsfDescription, loadCsf } from 'storybook/internal/csf-tools';
import type {
  ComponentManifest,
  IndexEntry,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { uniqBy } from 'es-toolkit/array';
import path from 'pathe';

import type { Component, Directive } from '../client/compodoc-types';
import {
  extractDescription as extractCompodocDescription,
  findComponentInCompodoc,
  getComponentFilePath,
  invalidateCompodocCache,
  loadCompodocJson,
} from './compodocDocgen';
import { generateAngularSnippet, mergeArgsFromAst } from './generateCodeSnippet';
import { buildComponentImport } from './getComponentImports';
import { extractJSDocInfo } from './jsdocTags';
import { cachedFindUp, cachedReadFileSync, invalidateCache, invariant } from './utils';

type ComponentOrDirective = Component | Directive;

/** Angular-specific extension of ComponentManifest with Compodoc raw data. */
interface AngularComponentManifest extends ComponentManifest {
  /** Raw Compodoc data for future extensions */
  compodocData?: ComponentOrDirective;
}

/**
 * Find the nearest package.json and return its `name` field.
 */
function getPackageInfo(componentPath: string | undefined, fallbackPath: string): string | undefined {
  const nearestPkg = cachedFindUp('package.json', {
    cwd: path.dirname(componentPath ?? fallbackPath),
  });

  try {
    return nearestPkg
      ? (JSON.parse(cachedReadFileSync(nearestPkg, 'utf-8') as string) as { name?: string }).name
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract stories from a parsed CSF file, generating Angular template snippets.
 */
function extractStories(
  csf: ReturnType<ReturnType<typeof loadCsf>['parse']>,
  componentData: ComponentOrDirective | undefined,
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
        const jsdocComment = extractCsfDescription(csf._storyStatements[storyExport]);
        const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
        const finalDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

        // Merge meta + story args from AST and generate the Angular template snippet
        const args = mergeArgsFromAst(csf._metaNode, csf._storyAnnotations[storyExport]);
        const snippet = generateAngularSnippet(
          Object.keys(args).length > 0 ? args : undefined,
          componentData
        );

        return {
          id: story.id,
          name: story.name ?? storyNameFromExport(storyExport),
          snippet,
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

/**
 * Extract component-level description from CSF meta and/or Compodoc data.
 */
function extractComponentDescription(
  csf: ReturnType<ReturnType<typeof loadCsf>['parse']>,
  compodocDescription: string | undefined
) {
  const jsdocComment = extractCsfDescription(csf._metaStatement) || compodocDescription;
  const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
  return {
    description: ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim(),
    summary: tags.summary?.[0],
    jsDocTags: tags,
  };
}

/**
 * Main manifest generator for Angular.
 *
 * Implements the `experimental_manifests` preset property.
 * Reads Compodoc's `documentation.json` to extract component metadata,
 * then iterates over tagged IndexEntries to build ComponentManifest objects.
 */
export const manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[] }
> = async (existingManifests = {}, options) => {
  const { manifestEntries } = options;

  // Invalidate caches between runs
  invalidateCache();
  invalidateCompodocCache();

  const startTime = performance.now();

  // Load Compodoc JSON from disk
  const workspaceRoot = process.cwd();
  const compodocJson = loadCompodocJson(workspaceRoot);

  if (!compodocJson) {
    // Compodoc JSON not found — return existing manifests with a warning
    return {
      ...existingManifests,
      components: {
        v: 0,
        components: {},
        meta: {
          docgen: 'compodoc' as const,
          durationMs: Math.round(performance.now() - startTime),
        },
      },
    };
  }

  // Deduplicate entries by component (first part of story id before --)
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
    .map((entry): AngularComponentManifest | undefined => {
      try {
        const storyFilePath =
          entry.type === 'story'
            ? entry.importPath
            : entry.storiesImports[0];

        const absoluteImportPath = path.join(workspaceRoot, storyFilePath);
        const storyFile = cachedReadFileSync(absoluteImportPath, 'utf-8') as string;
        const csf = loadCsf(storyFile, { makeTitle: () => entry.title }).parse();

        const componentName = csf._meta?.component;
        const id = entry.id.split('--')[0];
        const title = entry.title.split('/').at(-1)?.replaceAll(/\s+/g, '') ?? '';

        // Look up the component in Compodoc JSON
        const componentData = componentName
          ? findComponentInCompodoc(componentName, compodocJson)
          : undefined;

        // Build import statement
        const componentFilePath = componentData
          ? getComponentFilePath(componentData as ComponentOrDirective)
          : undefined;
        const packageName = getPackageInfo(componentFilePath, absoluteImportPath);
        const importStatement = componentData
          ? buildComponentImport(componentData as ComponentOrDirective, storyFilePath, packageName)
          : '';

        // Extract stories with Angular template snippets
        const stories = extractStories(
          csf,
          componentData as ComponentOrDirective | undefined,
          manifestEntries
        );

        // Extract component-level description from CSF and Compodoc
        const compodocDescription = extractCompodocDescription(componentData);
        const { description, summary, jsDocTags } = extractComponentDescription(
          csf,
          compodocDescription
        );

        const base: AngularComponentManifest = {
          id,
          name: componentName ?? title,
          path: storyFilePath,
          stories,
          import: importStatement,
          description,
          summary,
          jsDocTags,
          compodocData: componentData as ComponentOrDirective | undefined,
        };

        if (!componentData) {
          const error = componentName
            ? {
                name: 'Component not found in Compodoc',
                message: `Component "${componentName}" was not found in the Compodoc documentation.json. ` +
                  `Make sure Compodoc has been run and the component is included in the tsconfig used by Compodoc.`,
              }
            : {
                name: 'No component found',
                message:
                  'We could not detect the component from your story file. Specify meta.component.',
              };
          return { ...base, error };
        }

        return base;
      } catch (e) {
        const id = entry.id.split('--')[0];
        const title = entry.title.split('/').at(-1)?.replaceAll(/\s+/g, '') ?? '';
        return {
          id,
          name: title,
          path: entry.importPath,
          stories: [],
          jsDocTags: {},
          error: {
            name: e instanceof Error ? e.name : 'Unknown error',
            message: e instanceof Error ? e.message : String(e),
          },
        };
      }
    })
    .filter((component): component is AngularComponentManifest => component !== undefined);

  const durationMs = Math.round(performance.now() - startTime);
  
  return {
    ...existingManifests,
    components: {
      v: 0,
      components: Object.fromEntries(components.map((component) => [component.id, component])),
      meta: {
        docgen: 'compodoc' as const,
        durationMs,
      },
    },
  };
};
