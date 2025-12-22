import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import type {
  DocsIndexEntry,
  IndexEntry,
  Path,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

interface DocsManifestEntry {
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

/**
 * Generates a manifest of docs entries. This extends the existing manifest system to include docs
 * entries.
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

  const entriesWithContent = await Promise.all(
    docsEntries.map(async (entry): Promise<DocsManifestEntry> => {
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
    })
  );

  const docsManifests: Record<string, DocsManifestEntry> = Object.fromEntries(
    entriesWithContent.map((entry) => [entry.id, entry])
  );

  logger.verbose(
    `Docs manifest generation took ${performance.now() - startPerformance}ms for ${docsEntries.length} entries`
  );

  return {
    ...existingManifests,
    docs: {
      v: 0,
      docs: docsManifests,
    } satisfies DocsManifest,
  };
};
