import type { IndexEntry, PreviewWarmupTargets, StoryIndex } from 'storybook/internal/types';

import { Tag } from '../../shared/constants/tags.ts';

/**
 * Whether the sidebar shows an entry by default. Mirrors the manager's static `dev` filter
 * (`computeStaticFilterFn`), minus the rarely-used `excludeFromSidebar` tag presets: CSF autodocs
 * always show, while stories and MDX docs must carry the `dev` tag.
 */
function isSidebarVisible(entry: IndexEntry): boolean {
  const tags = entry.tags ?? [];
  const isCsfAutodocsEntry =
    entry.type === 'docs' && !tags.includes(Tag.ATTACHED_MDX) && !tags.includes(Tag.UNATTACHED_MDX);
  return isCsfAutodocsEntry || tags.includes(Tag.DEV);
}

/** The modules the preview imports to render an entry — see `StoryStore.loadEntry`. */
function entryImportPaths(entry: IndexEntry): string[] {
  return entry.type === 'docs' ? [entry.importPath, ...entry.storiesImports] : [entry.importPath];
}

/**
 * Computes which preview modules to warm up so that, by the time the browser's iframe requests the
 * first story, a lazy builder (e.g. Vite) has already started transforming it.
 *
 * `index.entries` is already ordered by `storySort`, so:
 *
 * - The raw first entry is what the preview renders immediately for the `id=*` specifier.
 * - The first sidebar-visible entry is what the manager ultimately navigates to.
 *
 * These coincide in the common case (every entry is `dev` by default); when they differ we warm
 * both, so the first render is fast regardless of which one wins.
 */
export function getWarmupTargets(index: StoryIndex): PreviewWarmupTargets | undefined {
  const entries = Object.values(index.entries);
  if (entries.length === 0) {
    return undefined;
  }

  const rawFirst = entries[0];
  const sidebarFirst = entries.find(isSidebarVisible);

  const chosen = sidebarFirst && sidebarFirst !== rawFirst ? [rawFirst, sidebarFirst] : [rawFirst];

  return { importPaths: Array.from(new Set(chosen.flatMap(entryImportPaths))) };
}
