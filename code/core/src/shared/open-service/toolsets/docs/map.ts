import type { DocgenPayload } from '../../services/docgen/types.ts';
import type { StoryDocsPayload } from '../../services/story-docs/types.ts';
import type { DocsClassification } from './classify-services.ts';

export type MdxDoc = {
  id: string;
  name: string;
  path?: string;
  title?: string;
  content?: string;
  summary?: string;
  error?: { name: string; message: string };
};

export type MdxPayload = {
  id: string;
  name: string;
  docs: Record<string, MdxDoc>;
};

/**
 * Picks a component's attached MDX docs out of its payload, shared by the Markdown and JSON docs
 * paths so the two cannot drift. `undefined` when the component has no attached docs, letting
 * callers omit the key entirely.
 */
export function selectAttachedDocs(
  classification: DocsClassification,
  id: string,
  mdx: MdxPayload | undefined
): Record<string, MdxDoc> | undefined {
  const attached = classification.attachedDocsByComponent.get(id) ?? [];
  if (attached.length === 0 || !mdx?.docs) {
    return undefined;
  }

  const docs: Record<string, MdxDoc> = {};
  for (const docsId of attached) {
    const doc = mdx.docs[docsId];
    if (doc) {
      docs[docsId] = doc;
    }
  }
  return docs;
}

export type DocsListResult = {
  components: Array<{
    id: string;
    name: string;
    summary?: string;
    storyIds?: string[];
  }>;
  docs: Array<{
    id: string;
    name: string;
    title?: string;
    summary?: string;
  }>;
};

export type DocsShowResult =
  | {
      kind: 'component';
      id: string;
      name: string;
      path?: string;
      description?: string;
      summary?: string;
      import?: string;
      jsDocTags?: Record<string, string[]>;
      reactDocgen?: unknown;
      reactDocgenTypescript?: unknown;
      reactComponentMeta?: unknown;
      stories?: Array<{
        id?: string;
        name: string;
        description?: string;
        summary?: string;
        snippet?: string;
        error?: { name: string; message: string };
      }>;
      subcomponents?: Record<string, unknown>;
      docs?: Record<string, MdxDoc>;
      error?: { name: string; message: string };
    }
  | {
      kind: 'docs';
      id: string;
      name: string;
      title?: string;
      path?: string;
      content?: string;
      summary?: string;
      error?: { name: string; message: string };
    }
  | { kind: 'not-found'; id: string };

export type DocsShowStoryResult =
  | {
      kind: 'story';
      component: { id: string; name: string; import?: string };
      story: {
        id?: string;
        name: string;
        description?: string;
        summary?: string;
        snippet?: string;
        error?: { name: string; message: string };
      };
    }
  | { kind: 'component-not-found'; componentId: string }
  | {
      kind: 'story-not-found';
      componentId: string;
      storyName: string;
      availableStoryNames: string[];
    };

function summaryOf(item: { summary?: string; description?: string }): string | undefined {
  return item.summary ?? item.description;
}

/** Builds the transport-neutral `docs.list` payload from settled dependency data. */
export function mapDocsList(params: {
  classification: DocsClassification;
  allDocgen: Record<string, DocgenPayload | undefined>;
  allStoryDocs: Record<string, StoryDocsPayload | undefined>;
  allMdx: Record<string, MdxPayload | undefined>;
  withStoryIds: boolean;
}): DocsListResult {
  const { classification, allDocgen, allStoryDocs, allMdx, withStoryIds } = params;

  const components = classification.componentIds.map((id) => {
    const payload = allDocgen[id];
    const component: DocsListResult['components'][number] = {
      id,
      name: payload?.name ?? id,
    };
    const summary = summaryOf(payload ?? {});
    if (summary !== undefined) {
      component.summary = summary;
    }
    if (withStoryIds && classification.storyBasedIds.has(id)) {
      const stories = allStoryDocs[id]?.stories;
      component.storyIds = stories
        ? Object.values(stories)
            .map((story) => story.id)
            .filter((storyId): storyId is string => typeof storyId === 'string')
        : [];
    }
    return component;
  });

  const docs = [...classification.unattachedDocs.entries()].map(([docId, name]) => {
    const payload = allMdx[docId]?.docs?.[docId];
    const doc: DocsListResult['docs'][number] = {
      id: docId,
      name,
    };
    if (payload?.title !== undefined) {
      doc.title = payload.title;
    }
    if (payload?.summary !== undefined) {
      doc.summary = payload.summary;
    }
    return doc;
  });

  return { components, docs };
}

/** Maps story-docs entries to the transport-neutral story shape, omitting absent fields. */
export function mapStoryDocsEntries(stories: NonNullable<StoryDocsPayload['stories']>) {
  return Object.values(stories).map((story) => ({
    ...(story.id !== undefined ? { id: story.id } : {}),
    name: story.name,
    ...(story.description !== undefined ? { description: story.description } : {}),
    ...(story.summary !== undefined ? { summary: story.summary } : {}),
    ...(story.snippet !== undefined ? { snippet: story.snippet } : {}),
    ...(story.error !== undefined ? { error: story.error } : {}),
  }));
}

/** A story-docs import statement wins over docgen's; either may be absent. */
export function resolveImportStatement(
  storyDocs?: StoryDocsPayload,
  docgen?: DocgenPayload
): string | undefined {
  return typeof storyDocs?.import === 'string'
    ? storyDocs.import
    : typeof docgen?.import === 'string'
      ? docgen.import
      : undefined;
}

/** Builds the transport-neutral `docs.show` payload for one id. */
export function mapDocsShow(params: {
  id: string;
  classification: DocsClassification;
  docgen?: DocgenPayload;
  storyDocs?: StoryDocsPayload;
  mdx?: MdxPayload;
}): DocsShowResult {
  const { id, classification, docgen, storyDocs, mdx } = params;

  if (classification.unattachedDocs.has(id)) {
    const doc = mdx?.docs?.[id];
    if (!doc) {
      return { kind: 'not-found', id };
    }
    return {
      kind: 'docs',
      id: doc.id,
      name: doc.name,
      ...(doc.title !== undefined ? { title: doc.title } : {}),
      ...(doc.path !== undefined ? { path: doc.path } : {}),
      ...(doc.content !== undefined ? { content: doc.content } : {}),
      ...(doc.summary !== undefined ? { summary: doc.summary } : {}),
      ...(doc.error !== undefined ? { error: doc.error } : {}),
    };
  }

  if (!classification.componentIds.includes(id)) {
    return { kind: 'not-found', id };
  }

  const docs = selectAttachedDocs(classification, id, mdx);

  const stories = storyDocs?.stories ? mapStoryDocsEntries(storyDocs.stories) : undefined;

  const importStatement = resolveImportStatement(storyDocs, docgen);

  return {
    kind: 'component',
    id,
    name: docgen?.name ?? id,
    ...(docgen?.path !== undefined ? { path: docgen.path } : {}),
    ...(docgen?.description !== undefined ? { description: docgen.description } : {}),
    ...(docgen?.summary !== undefined ? { summary: docgen.summary } : {}),
    ...(importStatement !== undefined ? { import: importStatement } : {}),
    ...(docgen?.jsDocTags !== undefined ? { jsDocTags: docgen.jsDocTags } : {}),
    ...(docgen?.reactDocgen !== undefined ? { reactDocgen: docgen.reactDocgen } : {}),
    ...(docgen?.reactDocgenTypescript !== undefined
      ? { reactDocgenTypescript: docgen.reactDocgenTypescript }
      : {}),
    ...(docgen?.reactComponentMeta !== undefined
      ? { reactComponentMeta: docgen.reactComponentMeta }
      : {}),
    ...(stories ? { stories } : {}),
    ...(docgen?.subcomponents !== undefined ? { subcomponents: docgen.subcomponents } : {}),
    ...(docs && Object.keys(docs).length > 0 ? { docs } : {}),
    ...(docgen?.error !== undefined ? { error: docgen.error } : {}),
  };
}

/** Builds the transport-neutral `docs.showStory` payload. */
export function mapDocsShowStory(params: {
  componentId: string;
  storyName: string;
  show: DocsShowResult;
}): DocsShowStoryResult {
  const { componentId, storyName, show } = params;

  if (show.kind !== 'component') {
    return { kind: 'component-not-found', componentId };
  }

  const stories = show.stories ?? [];
  const story = stories.find((entry) => entry.name === storyName);
  if (!story) {
    return {
      kind: 'story-not-found',
      componentId,
      storyName,
      availableStoryNames: stories.map((entry) => entry.name),
    };
  }

  return {
    kind: 'story',
    component: {
      id: show.id,
      name: show.name,
      ...(show.import !== undefined ? { import: show.import } : {}),
    },
    story,
  };
}
