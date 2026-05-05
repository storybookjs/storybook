import type { ImportEdge } from '../parser-registry/index.ts';

export type { ImportEdge };

/**
 * Reverse index from dep file path → story file → shortest forward-walk depth from that story.
 * Inner number preserves the BFS hop-count semantics used by `ChangeDetectionService.buildStatuses`
 * to distinguish `modified` (closest stories) from `affected` (farther stories).
 *
 * Keys are absolute paths normalised via `pathe.normalize`.
 */
export type ReverseIndex = Map<string, Map<string, number>>;

/** Per-file outgoing edges, used by IncrementalPatcher to compute diffs. */
export type DependencyGraph = Map<string, Set<string>>;
