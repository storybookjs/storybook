import * as fs from 'node:fs/promises';
import * as path from 'node:path';

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

const UNATTACHED_MDX_TAG = 'unattached-mdx';

export interface DocsManifestEntry {
  id: string;
  name: string;
  path: Path;
  title: string;
  content?: string;
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
    return {
      id: entry.id,
      name: entry.name,
      path: entry.importPath,
      title: entry.title,
      content,
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
 * Processes unattached MDX entries (standalone docs not attached to any component). These are added
 * to a separate `docs` manifest.
 */
export async function processUnattachedDocsEntries(
  entries: DocsIndexEntry[]
): Promise<Record<string, DocsManifestEntry>> {
  const entriesWithContent = await Promise.all(entries.map(createDocsManifestEntry));
  return Object.fromEntries(entriesWithContent.map((entry) => [entry.id, entry]));
}

/**
 * Processes attached docs entries by adding them to their corresponding component manifests.
 *
 * Returns the updated components manifest with docs added to each component.
 */
export async function processAttachedDocsEntries(
  entries: DocsIndexEntry[],
  existingComponents: ComponentsManifestWithDocs | undefined
): Promise<ComponentsManifestWithDocs | undefined> {
  if (!existingComponents || entries.length === 0) {
    return existingComponents;
  }

  const entriesWithContent = await Promise.all(entries.map(createDocsManifestEntry));

  // Create a copy of the components manifest to modify
  const updatedComponents: Record<string, ComponentManifestWithDocs> = {};

  for (const [componentId, component] of Object.entries(existingComponents.components)) {
    updatedComponents[componentId] = { ...component };
  }

  // Add docs to their corresponding components based on the entry id prefix
  for (const docsEntry of entriesWithContent) {
    // Extract the component id from the docs entry id (e.g., "example--docs" -> "example")
    const componentId = docsEntry.id.split('--')[0];

    if (updatedComponents[componentId]) {
      const component = updatedComponents[componentId];
      if (!component.docs) {
        component.docs = {};
      }
      component.docs[docsEntry.id] = docsEntry;
    }
  }

  return {
    ...existingComponents,
    components: updatedComponents,
  };
}

/**
 * Generates a manifest of docs entries. This extends the existing manifest system to include docs
 * entries.
 *
 * - Unattached MDX entries (with 'unattached-mdx' tag) are added to a separate `docs` manifest.
 * - Attached docs entries are added to their corresponding component manifests under a `docs`
 *   property.
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

  // Split entries into unattached (standalone) and attached (component-related)
  const unattachedEntries = docsEntries.filter((entry) => entry.tags?.includes(UNATTACHED_MDX_TAG));
  const attachedEntries = docsEntries.filter((entry) => !entry.tags?.includes(UNATTACHED_MDX_TAG));

  const currentManifests = existingManifests as ManifestsWithDocs;

  // Process both types of entries
  const [unattachedDocs, updatedComponents] = await Promise.all([
    processUnattachedDocsEntries(unattachedEntries),
    processAttachedDocsEntries(attachedEntries, currentManifests.components),
  ]);

  logger.verbose(
    `Docs manifest generation took ${performance.now() - startPerformance}ms for ${docsEntries.length} entries (${unattachedEntries.length} unattached, ${attachedEntries.length} attached)`
  );

  const result: ManifestsWithDocs = { ...currentManifests };

  // Add unattached docs to the docs manifest
  if (Object.keys(unattachedDocs).length > 0) {
    result.docs = {
      v: 0,
      docs: unattachedDocs,
    } satisfies DocsManifest;
  }

  // Update the components manifest with attached docs
  if (updatedComponents) {
    result.components = updatedComponents;
  }

  return result;
};
