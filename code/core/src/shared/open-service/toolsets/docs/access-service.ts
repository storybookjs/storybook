/**
 * Docs access backed by the live open services (docgen-server mode, selected when the docgen
 * services actually registered — see `createLocalDocsAccess`).
 *
 * Two properties make this different from reading the service aggregates directly. Visibility comes
 * from the story index, so the listing matches what core's manifest generator would emit — same
 * `manifest` tag filter, same component selection, same order — instead of whatever happens to have
 * been extracted so far. And single-entry lookups use the per-id queries, so resolving one
 * component never triggers docgen extraction for every component.
 */

import type { StoryIndex } from 'storybook/internal/types';

import { getComponentIdFromEntry } from '../../../../common/utils/component-id.ts';
import { selectComponentEntriesByComponentId } from '../../../../common/utils/select-component-entry.ts';
import {
  OpenServiceDocgenMissingComponentError,
  OpenServiceMissingServiceError,
} from '../../../../server-errors.ts';
import { Tag } from '../../../constants/tags.ts';
import type { DocgenService } from '../../services/docgen/definition.ts';
import type { StoryDocsService } from '../../services/story-docs/definition.ts';
import type { ToolsetGetService } from '../../toolset-definition.ts';
import { toShallowManifests, type DocsAccess, type ResolvedDocsEntry } from './access.ts';
import type { DocsClassification } from './classify-services.ts';
import {
  adaptCoreComponent,
  adaptCoreDoc,
  adaptCoreStories,
  type CoreDocgenComponent,
} from './manifest-formatter/adapt-core-manifest.ts';
import type { ComponentManifestV1, DocV1 } from './manifest-formatter/manifest-types.ts';
import { selectAttachedDocs, type MdxPayload } from './map.ts';

/** Stable addon-docs MDX service id. Kept local so the docs toolset does not import core-server. */
const MDX_SERVICE_ID = 'addon-docs/mdx';

type MdxService = {
  queries: {
    mdxForAllComponents: {
      loaded: () => Promise<Record<string, MdxPayload | undefined>>;
    };
    mdxForComponent: {
      loaded: (input: { id: string }) => Promise<MdxPayload | undefined>;
    };
  };
};

export type ServiceDocsAccessOptions = {
  storyIndex: { getIndex: () => Promise<StoryIndex> };
  getService: ToolsetGetService;
};

/**
 * Derives the visible set from the story index using core's manifest rules.
 *
 * Component ids keep story-index order: the sidebar order is the order a reader expects, and
 * re-sorting here would silently disagree with every other manifest surface.
 */
function classifyIndex(index: StoryIndex): DocsClassification {
  const entries = Object.values(index.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const selected = selectComponentEntriesByComponentId(entries);

  const storyBasedIds = new Set<string>();
  for (const [id, entry] of selected) {
    if (entry.type === 'story') {
      storyBasedIds.add(id);
    }
  }

  const attachedDocsByComponent = new Map<string, string[]>();
  const unattachedDocs = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type !== 'docs') {
      continue;
    }
    if (entry.tags?.includes(Tag.UNATTACHED_MDX)) {
      unattachedDocs.set(entry.id, entry.name);
    } else if (entry.tags?.includes(Tag.ATTACHED_MDX)) {
      const componentId = getComponentIdFromEntry(entry);
      attachedDocsByComponent.set(componentId, [
        ...(attachedDocsByComponent.get(componentId) ?? []),
        entry.id,
      ]);
    }
  }

  return {
    componentIds: [...selected.keys()],
    storyBasedIds,
    unattachedDocs,
    attachedDocsByComponent,
  };
}

/** Optional services resolve to `undefined` rather than throwing when they are not registered. */
function tryGetService<T>(getService: ToolsetGetService, serviceId: string): T | undefined {
  try {
    return getService<T>(serviceId, { internal: true });
  } catch (error) {
    if (error instanceof OpenServiceMissingServiceError) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Component payload loads throw when an id has no component entry in the index. Standalone docs ids
 * and ids that don't exist at all both land there, and both are answered by absence rather than a
 * failure, so the typed error becomes `undefined`.
 */
async function loadOptionalComponentPayload<T>(
  load: Promise<T | undefined>
): Promise<T | undefined> {
  try {
    return await load;
  } catch (error) {
    if (error instanceof OpenServiceDocgenMissingComponentError) {
      return undefined;
    }
    throw error;
  }
}

export function createServiceDocsAccess({
  storyIndex,
  getService,
}: ServiceDocsAccessOptions): DocsAccess {
  // The index and the services are read on every call. Both cache internally, and re-reading is
  // what keeps the toolset in lock-step with HMR.
  const classify = async () => classifyIndex(await storyIndex.getIndex());
  const getDocgen = () => getService<DocgenService>('core/docgen', { internal: true });
  const getStoryDocs = () => getService<StoryDocsService>('core/story-docs', { internal: true });
  const getMdx = () => tryGetService<MdxService>(getService, MDX_SERVICE_ID);

  async function listComponents(
    classification: DocsClassification,
    withStoryIds: boolean
  ): Promise<Record<string, ComponentManifestV1>> {
    // Every component must be listed even without a prior extraction, so load rather than read.
    const allDocgen = await getDocgen().queries.docgenForAllComponents.loaded();

    const storyDocs = getStoryDocs();
    const storyBasedIds = withStoryIds
      ? classification.componentIds.filter((id) => classification.storyBasedIds.has(id))
      : [];
    // Per-id loads, so listing without story ids never pays for story-docs extraction.
    const storiesById = new Map(
      await Promise.all(
        storyBasedIds.map(
          async (id) =>
            [
              id,
              await loadOptionalComponentPayload(storyDocs.queries.storyDocs.loaded({ id })),
            ] as const
        )
      )
    );

    const components: Record<string, ComponentManifestV1> = {};
    for (const id of classification.componentIds) {
      const payload = allDocgen[id];
      components[id] = {
        id,
        name: payload?.name ?? id,
        ...(payload?.description !== undefined ? { description: payload.description } : {}),
        ...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
        ...(classification.storyBasedIds.has(id) && withStoryIds
          ? { stories: adaptCoreStories(storiesById.get(id)?.stories) ?? [] }
          : {}),
      };
    }

    return components;
  }

  async function listDocs(classification: DocsClassification): Promise<Record<string, DocV1>> {
    if (classification.unattachedDocs.size === 0) {
      return {};
    }

    const allMdx = (await getMdx()?.queries.mdxForAllComponents.loaded()) ?? {};

    const docs: Record<string, DocV1> = {};
    for (const [docId, name] of classification.unattachedDocs) {
      // The display name comes from the index entry: it exists even when the MDX service does not.
      const payload = allMdx[docId]?.docs?.[docId];
      docs[docId] = {
        id: docId,
        name,
        ...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
      };
    }

    return docs;
  }

  async function resolveComponent(
    id: string,
    classification: DocsClassification
  ): Promise<ResolvedDocsEntry> {
    const mdx = getMdx();
    const [docgenPayload, storyDocsPayload] = await Promise.all([
      loadOptionalComponentPayload(getDocgen().queries.docgen.loaded({ id })),
      loadOptionalComponentPayload(getStoryDocs().queries.storyDocs.loaded({ id })),
    ]);

    const hasAttachedDocs = (classification.attachedDocsByComponent.get(id)?.length ?? 0) > 0;
    const mdxPayload =
      hasAttachedDocs && mdx
        ? await loadOptionalComponentPayload(mdx.queries.mdxForComponent.loaded({ id }))
        : undefined;
    const docs = selectAttachedDocs(classification, id, mdxPayload);

    const core: CoreDocgenComponent = {
      ...docgenPayload,
      id,
      name: docgenPayload?.name ?? id,
      ...(storyDocsPayload?.stories ? { stories: storyDocsPayload.stories } : {}),
      ...(storyDocsPayload?.import ? { import: storyDocsPayload.import } : {}),
      ...(docs ? { docs } : {}),
    };

    return { kind: 'component', component: adaptCoreComponent(core) };
  }

  async function resolveStandaloneDoc(id: string): Promise<ResolvedDocsEntry | undefined> {
    const mdx = getMdx();
    const payload = mdx
      ? await loadOptionalComponentPayload(mdx.queries.mdxForComponent.loaded({ id }))
      : undefined;
    const doc = payload?.docs?.[id];
    return doc ? { kind: 'doc', doc: adaptCoreDoc(doc) } : undefined;
  }

  return {
    async list({ withStoryIds }) {
      const classification = await classify();
      const [components, docs] = await Promise.all([
        listComponents(classification, withStoryIds),
        listDocs(classification),
      ]);
      return toShallowManifests(components, docs);
    },

    async resolve(id) {
      const classification = await classify();

      if (classification.unattachedDocs.has(id)) {
        return resolveStandaloneDoc(id);
      }
      if (classification.componentIds.includes(id)) {
        return resolveComponent(id, classification);
      }
      return undefined;
    },
  };
}
