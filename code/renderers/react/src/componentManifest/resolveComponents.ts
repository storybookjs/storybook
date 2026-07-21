import { recast } from 'storybook/internal/babel';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';

import { getCodeSnippet } from './generateCodeSnippet.ts';
import {
  type ComponentRef,
  type DocgenEngine,
  type TypescriptOptions,
  getComponents,
} from './getComponentImports.ts';
import { extractJSDocInfo } from './jsdocTags.ts';
import { extractDeclaredSubcomponents, findExactComponentMatch } from './subcomponents.ts';
import { cachedReadTextFileSync } from './utils.ts';

export type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;

/** A declared subcomponent paired with the component ref it resolved to (if any). */
export interface ResolvedSubcomponent {
  name: string;
  component: ComponentRef | undefined;
}

/**
 * Everything resolved from a single CSF story file, before any output-specific shaping.
 *
 * This is the unit the manifest generator maps over (once per component) and the docgen provider
 * runs for a single file. It deliberately stops short of `ComponentMetaManager.batchExtract`: the
 * manifest batches extraction across *all* files in one call (its main perf win), while the docgen
 * provider batches its single file — so the extraction step stays with each caller.
 */
export interface ResolvedStoryFile {
  storyPath: string;
  /** Raw source text of the story file (used by the manifest generator for error frames). */
  storyFile: string;
  csf: ParsedCsf;
  /** `meta.component`'s local name, if the story file declares one. */
  componentName: string | undefined;
  /** Every component ref discovered in the story file. */
  allComponents: ComponentRef[];
  /** The primary component for this file, matched from `meta.component` or the title. */
  component: ComponentRef | undefined;
  /** Declared subcomponents, each paired with its resolved ref (or undefined when unresolved). */
  subcomponents: ResolvedSubcomponent[];
}

/**
 * Pick the component a story file documents.
 *
 * When `meta.component` is set, find the exact match. `meta.component` is the local variable name
 * (e.g. "Button", "Accordion"), and `getComponents` adds it to the component set as-is when it maps
 * cleanly to a component ref. If that strict lookup misses (for example `const Root =
 * Accordion.Root`), fall back to title-based candidate selection.
 */
export function findMatchingComponent(
  components: ComponentRef[],
  componentName: string | undefined,
  title: string
) {
  const exactMatch = findExactComponentMatch(components, componentName);
  if (exactMatch) {
    return exactMatch;
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

  // Prefer the outermost component (shallowest JSX nesting depth).
  // jsxDepth 0 means top-level JSX — can't get shallower, so pick it immediately.
  let best = matches[0];
  for (const cur of matches) {
    if (cur.jsxDepth === 0) {
      return cur;
    }
    if ((cur.jsxDepth ?? Infinity) < (best.jsxDepth ?? Infinity)) {
      best = cur;
    }
  }
  return best;
}

/**
 * Resolve a single CSF story file into its primary component and declared subcomponents.
 *
 * Reads + parses the file, scans it for component references via {@link getComponents}, then
 * matches the primary component and resolves each declared subcomponent. Throws if the file
 * cannot be read or parsed — callers decide whether that is fatal (manifest) or a skip (docgen).
 */
export async function resolveStoryFileComponents(options: {
  storyPath: string;
  title: string;
  typescriptOptions?: Partial<TypescriptOptions>;
  docgenEngine: DocgenEngine;
}): Promise<ResolvedStoryFile> {
  const { storyPath, title, typescriptOptions, docgenEngine } = options;

  const storyFile = cachedReadTextFileSync(storyPath);
  const csf = loadCsf(storyFile, { makeTitle: () => title }).parse();
  const componentName = csf._meta?.component;

  const declaredSubcomponents = extractDeclaredSubcomponents(csf);
  const allComponents = await getComponents({
    additionalComponentNames: declaredSubcomponents.map(
      (subcomponent) => subcomponent.componentName
    ),
    csf,
    storyFilePath: storyPath,
    typescriptOptions,
    docgenEngine,
  });

  const component = findMatchingComponent(allComponents, componentName, title);
  const subcomponents = declaredSubcomponents.map((declared) => ({
    name: declared.name,
    component: findExactComponentMatch(allComponents, declared.componentName),
  }));

  return { storyPath, storyFile, csf, componentName, allComponents, component, subcomponents };
}

/** Snippet + metadata for one story, before output-specific shaping. */
export interface ResolvedStory {
  id: string;
  name: string;
  snippet?: string;
  description?: string;
  summary?: string;
  error?: { name: string; message: string };
}

/**
 * Extract per-story code snippets + JSDoc metadata from a parsed CSF file.
 *
 * Pass `filterStoryIds` to limit the result to a subset (the manifest generator only emits stories
 * carrying the manifest tag); omit it to include every story in the file (the docgen provider).
 */
export function extractStorySnippets(
  csf: ParsedCsf,
  componentName: string | undefined,
  filterStoryIds?: ReadonlySet<string>
): ResolvedStory[] {
  return Object.entries(csf._stories)
    .filter(([, story]) => !filterStoryIds || filterStoryIds.has(story.id))
    .map(([storyExport, story]): ResolvedStory => {
      const name = story.name ?? storyNameFromExport(storyExport);
      try {
        const jsdocComment = extractDescription(csf._storyStatements[storyExport]);
        const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
        const finalDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

        return {
          id: story.id,
          name,
          snippet: recast.print(getCodeSnippet(csf, storyExport, componentName)).code,
          description: finalDescription?.trim(),
          summary: tags.summary?.[0],
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        return { id: story.id, name, error: { name: err.name, message: err.message } };
      }
    });
}
