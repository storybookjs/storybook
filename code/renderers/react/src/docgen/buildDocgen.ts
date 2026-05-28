import { recast } from 'storybook/internal/babel';
import { getComponentIdFromEntry } from 'storybook/internal/common';
import { Tag } from 'storybook/internal/core-server';
import { storyNameFromExport } from 'storybook/internal/csf';
import { extractDescription, loadCsf } from 'storybook/internal/csf-tools';
import type {
  DocgenJsDocTags,
  DocgenPayload,
  DocgenProp,
  DocgenProviderInput,
  DocgenStory,
  DocgenSubcomponent,
  DocsIndexEntry,
  IndexEntry,
} from 'storybook/internal/types';

import path from 'pathe';

import type { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { ComponentDoc } from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import { getCodeSnippet } from '../componentManifest/generateCodeSnippet.ts';
import {
  type ComponentRef,
  type StoryRef,
  type TypescriptOptions,
  getComponents,
} from '../componentManifest/getComponentImports.ts';
import { findMatchingComponent } from '../componentManifest/generator.ts';
import { extractJSDocInfo } from '../componentManifest/jsdocTags.ts';
import {
  extractDeclaredSubcomponents,
  findExactComponentMatch,
} from '../componentManifest/subcomponents.ts';
import { cachedReadTextFileSync } from '../componentManifest/utils.ts';

function isAttachedDocsEntry(
  entry: IndexEntry
): entry is DocsIndexEntry & { storiesImports: [string, ...string[]] } {
  return (
    entry.type === 'docs' &&
    entry.tags?.includes(Tag.ATTACHED_MDX) === true &&
    entry.storiesImports.length > 0
  );
}

/**
 * Pick the single most authoritative entry for one componentId — a story entry beats an attached
 * docs entry. Mirrors {@link selectComponentEntries} in the manifest generator, but operates on
 * one component's pre-filtered entry list.
 */
function pickAuthoritativeEntry(
  componentId: string,
  entries: IndexEntry[]
): IndexEntry | undefined {
  const ours = entries.filter((entry) => getComponentIdFromEntry(entry) === componentId);
  return (
    ours.find((entry) => entry.type === 'story' && entry.subtype === 'story') ??
    ours.find(isAttachedDocsEntry) ??
    ours[0]
  );
}

function mapProps(doc: ComponentDoc | undefined): DocgenProp[] {
  if (!doc) {
    return [];
  }
  return Object.values(doc.props).map((prop) => ({
    name: prop.name,
    required: prop.required,
    type: prop.type,
    description: prop.description,
    defaultValue: prop.defaultValue,
  }));
}

function buildSubcomponentEntry(name: string, component: ComponentRef): DocgenSubcomponent {
  const doc = component.reactComponentMeta;
  const description = doc?.description?.trim() || undefined;
  const jsDocTags: DocgenJsDocTags | undefined = component.componentJsDocTags ?? doc?.jsDocTags;
  return {
    name,
    description,
    jsDocTags,
    props: mapProps(doc),
  };
}

function buildStories(
  csf: ReturnType<ReturnType<typeof loadCsf>['parse']>,
  componentName: string | undefined,
  ownedEntryIds: Set<string>
): DocgenStory[] {
  return Object.entries(csf._stories)
    .filter(([, story]) => ownedEntryIds.has(story.id))
    .map(([storyExport, story]): DocgenStory => {
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
        return {
          id: story.id,
          name,
          error: { name: err.name, message: err.message },
        };
      }
    });
}

export interface BuildDocgenContext {
  manager: ComponentMetaManager;
  typescriptOptions?: Partial<TypescriptOptions>;
  /** Resolve a story import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
}

/**
 * Build a {@link DocgenPayload} for one component using RCM-backed extraction.
 *
 * Reads the story file, resolves the component reference (and any declared subcomponents) via
 * {@link getComponents}, kicks the {@link ComponentMetaManager} to extract `ComponentDoc`s in a
 * single batch (so the TS program and file-snapshot cache are shared across the primary component
 * and its subcomponents), then maps the result into the docgen-service schema.
 *
 * The returned payload is always shape-complete — if the story file can't be parsed or the
 * component can't be resolved, an empty payload is returned with an `error` field set, so callers
 * can still validate it against the open-service schema.
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<DocgenPayload> {
  const { componentId, entries } = input;
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => path.join(process.cwd(), importPath));

  const entry = pickAuthoritativeEntry(componentId, entries);
  if (!entry) {
    return emptyPayload(componentId);
  }

  const storyFilePath =
    entry.type === 'story' ? entry.importPath : (entry.storiesImports[0] as string);
  const storyPath = resolvePath(storyFilePath);

  let storyFile: string;
  let csf: ReturnType<ReturnType<typeof loadCsf>['parse']>;
  try {
    storyFile = cachedReadTextFileSync(storyPath);
    csf = loadCsf(storyFile, { makeTitle: () => entry.title }).parse();
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      ...emptyPayload(componentId),
      error: { name: err.name, message: err.message },
    };
  }

  const declaredSubcomponents = extractDeclaredSubcomponents(csf);
  const allComponents = await getComponents({
    additionalComponentNames: declaredSubcomponents.map((s) => s.componentName),
    csf,
    storyFilePath: storyPath,
    typescriptOptions: context.typescriptOptions,
    docgenEngine: 'react-component-meta',
  });

  const metaComponentName = csf._meta?.component;
  const component = findMatchingComponent(allComponents, metaComponentName, entry.title);
  const resolvedSubcomponents = declaredSubcomponents.flatMap((declared) => {
    const ref = findExactComponentMatch(allComponents, declared.componentName);
    return ref ? [{ name: declared.name, component: ref }] : [];
  });

  const storyRefs: StoryRef[] = [
    ...(component ? [{ storyPath, component }] : []),
    ...resolvedSubcomponents.map(({ component: ref }) => ({ storyPath, component: ref })),
  ];

  if (storyRefs.length > 0) {
    context.manager.batchExtract(storyRefs);
  }

  const doc = component?.reactComponentMeta;
  const title = entry.title.split('/').at(-1) ?? componentId;
  const name = component?.componentName ?? metaComponentName ?? title;
  const description = (doc?.description ?? '').trim();
  const jsDocTags: DocgenJsDocTags | undefined = component?.componentJsDocTags ?? doc?.jsDocTags;
  const props = mapProps(doc);

  const ownedEntryIds = new Set(entries.map((e) => e.id));
  const stories = buildStories(csf, component?.componentName, ownedEntryIds);

  const subcomponents =
    resolvedSubcomponents.length > 0
      ? Object.fromEntries(
          resolvedSubcomponents.map(({ name: subName, component: subRef }) => [
            subName,
            buildSubcomponentEntry(subName, subRef),
          ])
        )
      : undefined;

  return {
    componentId,
    name,
    description,
    jsDocTags,
    props,
    ...(subcomponents ? { subcomponents } : {}),
    ...(stories.length > 0 ? { stories } : {}),
  };
}

function emptyPayload(componentId: string): DocgenPayload {
  return {
    componentId,
    name: '',
    description: '',
    props: [],
  };
}
