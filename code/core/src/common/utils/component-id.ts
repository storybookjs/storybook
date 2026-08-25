import type { IndexEntry } from 'storybook/internal/types';

/**
 * Derives the componentId portion of a story index entry id.
 *
 * Storybook story ids have the shape `<componentId>--<storyName>`; the prefix before the first
 * `--` is the stable component identifier shared by every story (and attached docs entry) that
 * targets the same component. Centralising the split keeps the docgen service, manifest generator,
 * and any future consumers on one definition.
 */
export function getComponentIdFromEntry(entry: Pick<IndexEntry, 'id'>): string {
  return entry.id.split('--')[0];
}
