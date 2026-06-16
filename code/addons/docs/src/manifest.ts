import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { getComponentIdFromEntry, groupBy } from 'storybook/internal/common';
import {
  type DocsManifestEntry,
  type DocsManifestRefEntry,
  type MdxDocPayload,
  Tag,
  analyzeMdx,
  mdxManifestRef,
} from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type {
  ComponentManifest,
  ComponentsManifest,
  DocsIndexEntry,
  IndexEntry,
  Manifests,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { extractDocsSummary } from './extract-docs-summary.ts';

export type { DocsManifestEntry } from 'storybook/internal/core-server';

interface DocsManifest {
  v: number;
  docs: Record<string, DocsManifestEntry>;
}

/**
 * A component row carrying docs. In legacy mode this is a full {@link ComponentManifest}; in
 * `experimentalDocgenServer` mode core builds the real component rows from docgen, so attached docs
 * may be synthesized onto a minimal `{ id, name }` shell — hence the `Partial`.
 */
type ComponentManifestWithDocs = Partial<ComponentManifest> & {
  id: string;
  name: string;
  docs?: Record<string, DocsManifestEntry>;
};

interface ComponentsManifestWithDocs {
  v: number;
  components: Record<string, ComponentManifestWithDocs>;
  meta?: ComponentsManifest['meta'];
}

/**
 * `Manifests` view that also exposes the docs-augmented `docs`/`components` shapes. Uses
 * `Omit<Manifests, 'components'>` so every other manifest keeps its `Manifests` typing while
 * `components` is specialized to carry docs.
 */
interface ManifestsWithDocs extends Omit<Manifests, 'components'> {
  docs?: DocsManifest;
  components?: ComponentsManifestWithDocs;
}

/** Builds the manifest entry for one docs index entry, owning the single component-id context. */
type DocBuilder = (
  entry: DocsIndexEntry,
  componentId: string
) => Promise<DocsManifestEntry> | DocsManifestEntry;

/**
 * Reads one MDX file into a full payload (content + derived summary).
 *
 * `summary` is derived once here — an explicit `Meta summary` when present, falling back to text
 * extracted from the content — so the service, the legacy inline manifest, and the ref index all
 * share one summary. It is omitted (like `content`) when the file cannot be read.
 */
export async function createDocsManifestEntry(entry: DocsIndexEntry): Promise<MdxDocPayload> {
  const absolutePath = path.join(process.cwd(), entry.importPath);
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');

    /*
      TODO: This isn't the most performant option, as we're already analyzing the MDX file
      during story index generation, and analyzing it requires compiling the file.
      We should find a way to only do it once and cache/access the analysis somehow
    */
    const { summary } = await analyzeMdx(content);
    const derivedSummary = summary ?? extractDocsSummary(content);

    return {
      id: entry.id,
      name: entry.name,
      path: entry.importPath,
      title: entry.title,
      content,
      ...(derivedSummary !== undefined && { summary: derivedSummary }),
    };
  } catch (err) {
    return {
      id: entry.id,
      name: entry.name,
      path: entry.importPath,
      title: entry.title,
      error: {
        name: err instanceof Error ? err.name : 'Error',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Builds a shallow `$ref` row. No file I/O: the MDX service owns the full payload (content +
 * summary); core layers the summary into the static index by reading those snapshots.
 */
function createDocsManifestRefEntry(
  entry: DocsIndexEntry,
  componentId: string
): DocsManifestRefEntry {
  return {
    id: entry.id,
    name: entry.name,
    mdx: { $ref: mdxManifestRef(componentId, entry.id) },
  };
}

/** Builds the unattached `docs` map (standalone docs keyed by their own id). */
async function buildUnattachedDocs(
  entries: DocsIndexEntry[],
  build: DocBuilder
): Promise<Record<string, DocsManifestEntry>> {
  const docs = await Promise.all(
    entries.map(async (entry) => [entry.id, await build(entry, entry.id)] as const)
  );

  return Object.fromEntries(docs);
}

/**
 * Adds attached docs to their owning component, immutably synthesizing a minimal component row when
 * one does not exist yet (the docgen-server components manifest starts empty).
 */
async function applyAttachedDocs(
  entries: DocsIndexEntry[],
  existingComponents: ComponentsManifestWithDocs | undefined,
  build: DocBuilder
): Promise<ComponentsManifestWithDocs | undefined> {
  if (!existingComponents || entries.length === 0) {
    return existingComponents;
  }

  const docs = await Promise.all(
    entries.map(async (entry) => {
      const componentId = getComponentIdFromEntry(entry);
      return { componentId, doc: await build(entry, componentId) };
    })
  );

  const components = { ...existingComponents.components };
  for (const { componentId, doc } of docs) {
    const component = components[componentId] ?? { id: componentId, name: componentId };
    components[componentId] = {
      ...component,
      docs: { ...component.docs, [doc.id]: doc },
    };
  }

  return { ...existingComponents, components };
}

/**
 * Generates a manifest of docs entries. This extends the existing manifest system to include docs
 * entries.
 *
 * - Unattached MDX entries (with 'unattached-mdx' tag) are added to a separate `docs` manifest.
 * - Attached MDX entries (with 'attached-mdx' tag) are added to their corresponding component
 *   manifests under a `docs` property.
 * - Docs entries without either tag are ignored.
 *
 * In `experimentalDocgenServer` mode docs become shallow `$ref` rows (resolved from the MDX service
 * snapshots); otherwise the full content is inlined.
 */
export const manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[] }
> = async (existingManifests = {}, { manifestEntries, presets }) => {
  const startPerformance = performance.now();
  const features = await presets?.apply?.('features');
  const useMdxService = features?.experimentalDocgenServer === true;

  const docsEntries = manifestEntries.filter(
    (entry): entry is DocsIndexEntry => entry.type === 'docs'
  );

  if (docsEntries.length === 0) {
    return existingManifests;
  }

  const { attachedEntries = [], unattachedEntries = [] } = groupBy(docsEntries, (entry) => {
    switch (true) {
      case entry.tags?.includes(Tag.UNATTACHED_MDX):
        return 'unattachedEntries';
      case entry.tags?.includes(Tag.ATTACHED_MDX):
        return 'attachedEntries';
      default:
        return 'ignored';
    }
  });

  if (unattachedEntries.length === 0 && attachedEntries.length === 0) {
    return existingManifests;
  }

  const existingManifestsWithDocs = existingManifests as ManifestsWithDocs;
  const build: DocBuilder = useMdxService ? createDocsManifestRefEntry : createDocsManifestEntry;

  const [unattachedDocs, updatedComponents] = await Promise.all([
    buildUnattachedDocs(unattachedEntries, build),
    applyAttachedDocs(attachedEntries, existingManifestsWithDocs.components, build),
  ]);

  const processedCount = unattachedEntries.length + attachedEntries.length;
  logger.verbose(
    `Docs manifest generation took ${performance.now() - startPerformance}ms for ${processedCount} entries (${unattachedEntries.length} unattached, ${attachedEntries.length} attached)`
  );

  const result: ManifestsWithDocs = { ...existingManifestsWithDocs };

  if (Object.keys(unattachedDocs).length > 0) {
    result.docs = {
      v: useMdxService ? 1 : 0,
      docs: unattachedDocs,
    };
  }

  if (updatedComponents) {
    result.components = updatedComponents;
  }

  // Augmented with docs but structurally a `Manifests` at runtime; component rows may be the
  // minimal `{ id, name }` shells synthesized for attached docs in docgen-server mode.
  return result as Manifests;
};
