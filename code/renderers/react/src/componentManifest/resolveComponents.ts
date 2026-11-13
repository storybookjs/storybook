import {
  createMetaComponentResolver,
  extractDeclaredSubcomponents,
} from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf/csf-utils';
import {
  type ESTreeNode,
  type ImportRef,
  type StoryReferences,
  collectImportBindings,
  createStoryArgsResolver,
  extractStoryJSDocInfo,
  loadCsf,
  unresolvedWarning,
} from 'storybook/internal/csf-tools';

import type { StoryDoc } from 'storybook/internal/types';

import { getCodeSnippet } from './generateCodeSnippet.ts';
import {
  type ComponentRef,
  type DocgenEngine,
  type DocgenTarget,
  type TypescriptOptions,
  getComponents,
} from './getComponentImports.ts';
import { findExactComponentMatch } from './subcomponents.ts';
import { cachedReadTextFileSync } from './utils.ts';

export type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;

// One instance per process: the resolver caches its module resolutions.
const resolveMetaComponent = createMetaComponentResolver();

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
  const csf = loadCsf(storyFile, { makeTitle: () => title, fileName: storyPath }).parse();
  const componentName = csf._meta?.component;

  const declaredSubcomponents = extractDeclaredSubcomponents(csf);

  // The meta's component and subcomponents resolve as in every other renderer, so a name the story
  // file's import cannot reach, such as a barrel's `export * as UI`, still finds its declaration.
  // react-component-meta reads them through the TypeScript checker, which follows such names itself.
  const docgenTargets = new Map<string, DocgenTarget>();
  const storyImports = collectImportBindings(csf.editor.program);
  // The name the story file refers to the component by. `parts.Button` after
  // `const parts = { Button }` is the file's own `Button` import, so the ref, the snippets and the
  // import lines all use `Button`.
  const resolveName = (name: string, node?: ESTreeNode) => {
    const resolved = resolveMetaComponent(csf, storyPath, node);
    if ('reason' in resolved) {
      return name;
    }
    const { localName, importId, path, exportName } = resolved.component;
    const own = storyImports.get(localName);
    const ownName =
      !storyImports.has(name.split('.')[0]) &&
      own !== undefined &&
      own.importId === importId &&
      own.importName === exportName
        ? localName
        : name;
    if (importId && path && docgenEngine !== 'react-component-meta') {
      docgenTargets.set(ownName, { path, exportName });
    }
    return ownName;
  };
  const metaComponentName = componentName && resolveName(componentName);
  const declared = declaredSubcomponents.map((subcomponent) => ({
    name: subcomponent.name,
    componentName: resolveName(subcomponent.componentName, subcomponent.node),
  }));

  const allComponents = await getComponents({
    additionalComponentNames: [
      ...(metaComponentName ? [metaComponentName] : []),
      ...declared.map((subcomponent) => subcomponent.componentName),
    ],
    csf,
    storyFilePath: storyPath,
    typescriptOptions,
    docgenEngine,
    docgenTargets,
  });

  const component = findMatchingComponent(allComponents, metaComponentName, title);
  const subcomponents = declared.map((subcomponent) => ({
    name: subcomponent.name,
    component: findExactComponentMatch(allComponents, subcomponent.componentName),
  }));

  return { storyPath, storyFile, csf, componentName, allComponents, component, subcomponents };
}

/** Every story's snippet, plus the imports they need beyond the components in the file. */
export interface ExtractedStorySnippets {
  stories: StoryDoc[];
  imports: ImportRef[];
}

/**
 * Extract per-story code snippets + JSDoc metadata from a parsed CSF file.
 *
 * Pass `filterStoryIds` to limit the result to a subset (the manifest generator only emits stories
 * carrying the manifest tag); omit it to include every story in the file (the docgen provider).
 * Pass `references` to let a story's args resolve names other modules own; without it only the story
 * file itself is read, and anything it reaches for elsewhere is reported as unresolved.
 * Pass `withTemplate` to give each story the `template` the preview fills with its changed args.
 */
export function extractStorySnippets(
  csf: ParsedCsf,
  componentName: string | undefined,
  filterStoryIds?: ReadonlySet<string>,
  references?: StoryReferences,
  withTemplate = false
): ExtractedStorySnippets {
  const imports: ImportRef[] = [];
  const resolver = createStoryArgsResolver(csf, references);
  const stories = Object.entries(csf._stories)
    .filter(([, story]) => !filterStoryIds || filterStoryIds.has(story.id))
    .map(([storyExport, story]): StoryDoc => {
      const name = story.name ?? storyNameFromExport(storyExport);
      try {
        const { description, summary } = extractStoryJSDocInfo(
          csf._storyStatements[storyExport],
          csf.editor
        );
        const {
          snippet,
          template,
          imports: needs,
          unresolved,
        } = getCodeSnippet(csf, storyExport, componentName, resolver);
        imports.push(...needs);
        const warning = unresolvedWarning(unresolved);

        return {
          id: story.id,
          name,
          snippet,
          ...(withTemplate && { template }),
          description,
          summary,
          ...(warning ? { warning } : {}),
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        return { id: story.id, name, error: { name: err.name, message: err.message } };
      }
    });

  return { stories, imports };
}
