import { logger } from 'storybook/internal/node-logger';
import type {
  DocsIndexEntry,
  IndexEntry,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

const ATTACHED_MDX_TAG = 'attached-mdx';
const UNATTACHED_MDX_TAG = 'unattached-mdx';

interface MdxManifestEntry {
  id: string;
  name: string;
  path: string;
  title: string;
  tags: string[];
  storiesImports?: string[];
}

interface MdxManifest {
  v: number;
  entries: Record<string, MdxManifestEntry>;
}

/**
 * Generates a manifest of MDX documentation files.
 * This extends the existing manifest system to include MDX files with the
 * 'attached-mdx' or 'unattached-mdx' tags.
 */
export const experimental_manifests: PresetPropertyFn<
  'experimental_manifests',
  StorybookConfigRaw,
  { manifestEntries: IndexEntry[] }
> = async (existingManifests = {}, { manifestEntries }) => {
  const startPerformance = performance.now();

  // Filter for MDX docs entries that have the manifest tag
  const mdxEntries = manifestEntries.filter(
    (entry): entry is DocsIndexEntry =>
      entry.type === 'docs' &&
      entry.tags?.includes('manifest') === true &&
      (entry.tags?.includes(ATTACHED_MDX_TAG) === true ||
        entry.tags?.includes(UNATTACHED_MDX_TAG) === true)
  );

  if (mdxEntries.length === 0) {
    logger.verbose('No MDX entries found with manifest tag for documentation manifest');
    return existingManifests;
  }

  // Convert MDX entries to manifest format
  const entries: Record<string, MdxManifestEntry> = {};

  for (const entry of mdxEntries) {
    entries[entry.id] = {
      id: entry.id,
      name: entry.name,
      path: entry.importPath,
      title: entry.title,
      tags: entry.tags || [],
      storiesImports: entry.storiesImports || [],
    };
  }

  logger.verbose(
    `MDX manifest generation took ${performance.now() - startPerformance}ms for ${mdxEntries.length} entries`
  );

  return {
    ...existingManifests,
    mdx: {
      v: 0,
      entries,
    } satisfies MdxManifest,
  };
};
