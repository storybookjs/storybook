/**
 * Docs access backed by the live open services (docgen-server mode, selected when the docgen
 * services actually registered — see `createLocalDocsAccess`).
 *
 * Two properties make this different from reading the service aggregates directly. Visibility comes
 * from `core/docgen`'s `manifestEntries`, which the server derives from the story index, so the
 * listing matches what core's manifest generator would emit — same `manifest` tag filter, same
 * component selection, same order — instead of whatever happens to have been extracted so far. And
 * single-entry lookups use the per-id queries, so resolving one component never triggers docgen
 * extraction for every component.
 */

import {
  OpenServiceDocgenMissingComponentError,
  OpenServiceMissingServiceError,
} from '../../../../server-errors.ts';
import type { DocgenService, ManifestEntries } from '../../services/docgen/definition.ts';
import type { StoryDocsService } from '../../services/story-docs/definition.ts';
import type { ToolsetGetService } from '../../toolset-definition.ts';
import { toShallowManifests, type DocsAccess, type ResolvedDocsEntry } from './access.ts';
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
  getService: ToolsetGetService;
};

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

export function createServiceDocsAccess({ getService }: ServiceDocsAccessOptions): DocsAccess {
  const getDocgen = () => getService<DocgenService>('core/docgen', { internal: true });
  const getStoryDocs = () => getService<StoryDocsService>('core/story-docs', { internal: true });
  const getMdx = () => tryGetService<MdxService>(getService, MDX_SERVICE_ID);
  // Loaded, not read, on every call: the server re-reads its index, which keeps the toolset in
  // lock-step with HMR.
  const loadManifestEntries = () => getDocgen().queries.manifestEntries.loaded();

  async function listComponents(
    entries: ManifestEntries['components'],
    withStoryIds: boolean
  ): Promise<Record<string, ComponentManifestV1>> {
    // Every component must be listed even without a prior extraction, so load rather than read.
    const allDocgen = await getDocgen().queries.docgenForAllComponents.loaded();

    const storyDocs = getStoryDocs();
    const storyBased = withStoryIds ? entries.filter((entry) => entry.storyBased) : [];
    // Per-id loads, so listing without story ids never pays for story-docs extraction.
    const storiesById = new Map(
      await Promise.all(
        storyBased.map(
          async ({ id }) =>
            [
              id,
              await loadOptionalComponentPayload(storyDocs.queries.storyDocs.loaded({ id })),
            ] as const
        )
      )
    );

    const components: Record<string, ComponentManifestV1> = {};
    for (const { id } of entries) {
      const payload = allDocgen[id];
      components[id] = {
        id,
        name: payload?.name ?? id,
        ...(payload?.description !== undefined ? { description: payload.description } : {}),
        ...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
        ...(storiesById.has(id)
          ? { stories: adaptCoreStories(storiesById.get(id)?.stories) ?? [] }
          : {}),
      };
    }

    return components;
  }

  async function listDocs(entries: ManifestEntries['docs']): Promise<Record<string, DocV1>> {
    if (entries.length === 0) {
      return {};
    }

    const allMdx = (await getMdx()?.queries.mdxForAllComponents.loaded()) ?? {};

    const docs: Record<string, DocV1> = {};
    for (const { id, name } of entries) {
      // The display name comes from the index entry: it exists even when the MDX service does not.
      const payload = allMdx[id]?.docs?.[id];
      docs[id] = {
        id,
        name,
        ...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
      };
    }

    return docs;
  }

  async function resolveComponent({
    id,
    attachedDocIds,
  }: ManifestEntries['components'][number]): Promise<ResolvedDocsEntry> {
    const mdx = getMdx();
    const [docgenPayload, storyDocsPayload] = await Promise.all([
      loadOptionalComponentPayload(getDocgen().queries.docgen.loaded({ id })),
      loadOptionalComponentPayload(getStoryDocs().queries.storyDocs.loaded({ id })),
    ]);

    const mdxPayload =
      attachedDocIds.length > 0 && mdx
        ? await loadOptionalComponentPayload(mdx.queries.mdxForComponent.loaded({ id }))
        : undefined;
    const docs = selectAttachedDocs(attachedDocIds, mdxPayload);

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
      const entries = await loadManifestEntries();
      const [components, docs] = await Promise.all([
        listComponents(entries.components, withStoryIds),
        listDocs(entries.docs),
      ]);
      return toShallowManifests(components, docs);
    },

    async resolve(id) {
      const entries = await loadManifestEntries();

      if (entries.docs.some((doc) => doc.id === id)) {
        return resolveStandaloneDoc(id);
      }
      const component = entries.components.find((entry) => entry.id === id);
      return component ? resolveComponent(component) : undefined;
    },
  };
}
