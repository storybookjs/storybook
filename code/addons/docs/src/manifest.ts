import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { groupBy } from 'storybook/internal/common';
import { Tag, analyzeMdx } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type {
  ComponentManifest,
  DocsIndexEntry,
  IndexEntry,
  Manifests,
  Path,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

export interface DocsManifestEntry {
  id: string;
  name: string;
  path: Path;
  title: string;
  content?: string;
  summary?: string;
  error?: { name: string; message: string };
}

interface DocsManifest {
  v: number;
  docs: Record<string, DocsManifestEntry>;
}

interface ComponentManifestWithDocs extends ComponentManifest {
  docs?: Record<string, DocsManifestEntry>;
}

interface ComponentsManifestWithDocs {
  v: number;
  components: Record<string, ComponentManifestWithDocs>;
}

interface ManifestsWithDocs extends Manifests {
  docs?: DocsManifest;
  components?: ComponentsManifestWithDocs;
}

/** Converts a DocsIndexEntry to a DocsManifestEntry by reading its file content. */
export async function createDocsManifestEntry(entry: DocsIndexEntry): Promise<DocsManifestEntry> {
  const absolutePath = path.join(process.cwd(), entry.importPath);
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');

    /*
      TODO: This isn't the most performant option, as we're already analyzing the MDX file
      during story index generation, and analyzing it requires compiling the file.
      We should find a way to only do it once and cache/access the analysis somehow
    */
    const { summary } = await analyzeMdx(content);

    return {
      id: entry.id,
      name: entry.name,
      path: entry.importPath,
      title: entry.title,
      content,
      ...(summary && { summary }),
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
 * Extracts unattached MDX entries (standalone docs not attached to any component). These are added
 * to a separate `docs` manifest.
 */
export async function extractUnattachedDocsEntries(
  entries: DocsIndexEntry[]
): Promise<Record<string, DocsManifestEntry>> {
  if (entries.length === 0) {
    return {};
  }
  const entriesWithContent = await Promise.all(entries.map(createDocsManifestEntry));
  return Object.fromEntries(entriesWithContent.map((entry) => [entry.id, entry]));
}

/**
 * Extracts attached docs entries by adding them to their corresponding component manifests.
 *
 * Returns the updated components manifest with docs added to each component.
 */
export async function extractAttachedDocsEntries(
  entries: DocsIndexEntry[],
  existingComponents: ComponentsManifestWithDocs | undefined
): Promise<ComponentsManifestWithDocs | undefined> {
  if (!existingComponents || entries.length === 0) {
    return existingComponents;
  }

  const entriesWithContent = await Promise.all(entries.map(createDocsManifestEntry));

  // Add docs to their corresponding components based on the entry id prefix
  for (const docsEntry of entriesWithContent) {
    const componentId = docsEntry.id.split('--')[0];

    const component = existingComponents.components[componentId];
    if (component) {
      if (!component.docs) {
        component.docs = {};
      }
      component.docs[docsEntry.id] = docsEntry;
    }
  }

  return existingComponents;
}

/**
 * Generates a manifest of docs entries. This extends the existing manifest system to include docs
 * entries.
 *
 * - Unattached MDX entries (with 'unattached-mdx' tag) are added to a separate `docs` manifest.
 * - Attached MDX entries (with 'attached-mdx' tag) are added to their corresponding component
 *   manifests under a `docs` property.
 * - Docs entries without either tag are ignored.
 */
export const manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[] }
> = async (existingManifests = {}, { manifestEntries }) => {
  const startPerformance = performance.now();

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

  const [unattachedDocs, updatedComponents] = await Promise.all([
    extractUnattachedDocsEntries(unattachedEntries),
    extractAttachedDocsEntries(attachedEntries, existingManifestsWithDocs.components),
  ]);

  const processedCount = unattachedEntries.length + attachedEntries.length;
  logger.verbose(
    `Docs manifest generation took ${performance.now() - startPerformance}ms for ${processedCount} entries (${unattachedEntries.length} unattached, ${attachedEntries.length} attached)`
  );

  const result = { ...existingManifestsWithDocs };

  // Add unattached docs to the docs manifest
  if (Object.keys(unattachedDocs).length > 0) {
    result.docs = {
      v: 0,
      docs: unattachedDocs,
    };
  }

  // Update the components manifest with attached docs
  if (updatedComponents) {
    result.components = updatedComponents;
  }

  return result;
};
