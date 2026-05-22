import type { IndexEntry } from 'storybook/internal/types';

/**
 * Determines whether a story index entry was authored by the `sb ai setup` flow.
 * Currently checks title prefix. When we migrate to a tag-based approach,
 * swap this to check for the tag instead — this is the single swap point.
 */
export function isStoryCreatedByAISetup(entry: IndexEntry): boolean {
  return entry.type === 'story' && (entry.tags?.includes('ai-generated') ?? false);
}
