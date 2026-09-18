import { dedent } from 'ts-dedent';

import { once } from 'storybook/internal/node-logger';

import { Tag } from '../../shared/constants/tags.ts';
import type { DocsIndexEntry, IndexEntry } from '../../types/modules/indexer.ts';

import { getComponentIdFromEntry } from './component-id.ts';

/**
 * Filename test for CSF story files (e.g. `Button.stories.tsx`, `stories.ts`). Single source of
 * truth shared by the CSF indexer and the React docgen provider so both agree on which files count
 * as story files. Has no `g` flag, so the shared instance is safe to reuse across `.test()` calls.
 */
export const STORY_FILE_TEST_REGEXP = /(stories|story)\.(m?js|ts)x?$/;

function isAttachedDocsEntry(
  entry: IndexEntry
): entry is DocsIndexEntry & { storiesImports: [string, ...string[]] } {
  return (
    entry.type === 'docs' &&
    entry.tags?.includes(Tag.ATTACHED_MDX) === true &&
    entry.storiesImports.length > 0
  );
}

function isEligibleStoryEntry(entry: IndexEntry): boolean {
  return entry.type === 'story' && entry.subtype === 'story';
}

/**
 * CSF story file path used for component resolution — the story entry's `importPath`, or the first
 * `storiesImports` entry for attached MDX docs (same rule as the React component manifest generator).
 */
export function getStoryImportPathFromEntry(entry: IndexEntry): string | undefined {
  if (entry.type === 'story') {
    return entry.importPath;
  }
  if (isAttachedDocsEntry(entry)) {
    return entry.storiesImports[0];
  }
  return undefined;
}

// The paths are sorted so the same collision produces a byte-identical message regardless of index
// order, which is what `once` deduplicates on.
function buildCollisionWarning(
  componentId: string,
  importPaths: Set<string>,
  winner: IndexEntry
): string {
  const sortedPaths = Array.from(importPaths).sort();
  return dedent`
    Multiple story files share the component id '${componentId}':
    ${sortedPaths.map((path) => `  - ${path}`).join('\n')}
    Component-level docs (props tables, code snippets, manifests, MCP docs) for this id are generated from '${winner.importPath}' only, so stories in the other files are left out of them. If these files document different components, give each file a unique title so every component keeps its docs.
  `;
}

/**
 * Picks one index entry per componentId: story entries win; attached docs fill gaps only where no
 * story exists for that componentId.
 *
 * Several story files can collapse onto one componentId by sharing a title. The selection cannot
 * represent that, so it warns (deduplicated per distinct collision) that component-level docs cover
 * only the winning file.
 */
export function selectComponentEntriesByComponentId(
  indexEntries: IndexEntry[]
): Map<string, IndexEntry> {
  const entriesByComponentId = new Map<string, IndexEntry>();
  const storyImportPathsByComponentId = new Map<string, Set<string>>();

  for (const entry of indexEntries) {
    if (!isEligibleStoryEntry(entry)) {
      continue;
    }
    const componentId = getComponentIdFromEntry(entry);
    entriesByComponentId.set(componentId, entry);
    const importPaths = storyImportPathsByComponentId.get(componentId) ?? new Set();
    importPaths.add(entry.importPath);
    storyImportPathsByComponentId.set(componentId, importPaths);
  }

  for (const [componentId, importPaths] of storyImportPathsByComponentId) {
    const winner = entriesByComponentId.get(componentId);
    if (importPaths.size > 1 && winner) {
      once.warn(buildCollisionWarning(componentId, importPaths, winner));
    }
  }

  for (const entry of indexEntries) {
    if (!isAttachedDocsEntry(entry)) {
      continue;
    }
    const componentId = getComponentIdFromEntry(entry);
    if (!entriesByComponentId.has(componentId)) {
      entriesByComponentId.set(componentId, entry);
    }
  }

  return entriesByComponentId;
}
