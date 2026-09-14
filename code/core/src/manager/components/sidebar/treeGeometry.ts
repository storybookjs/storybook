import type { IndexTree, TreeEntry } from '../../utils/tree.ts';

/** Height of a tree row in px. Rows are single-line (labels ellipsize), so this is constant. */
export const TREE_ROW_HEIGHT = 28;

/** Gap above a top-level section that follows another section's subtree, carried as row padding. */
export const SECTION_GAP = 14;

/** Horizontal distance in px between one indent level and the next. */
export const TREE_INDENT_STEP = 20;

/** Padding in px between the start of a row's own indent level and its icon. */
export const TREE_CONTENT_INSET = 7;

/**
 * Geometry of the visible rows, in render order. The tree is virtualized, so most rows have no DOM
 * node to measure. Every position comes from the fixed row height plus the section gaps.
 */
export interface FlatRows {
  /** Row ids, in render order. */
  ids: string[];
  /** Rows that start a top-level section and carry the section gap as padding. */
  sectionStartIds: Set<string>;
  /** Distance in px from the top of the scroll content to the top of each row. */
  offsets: number[];
  /** Indent depth of each row. A top-level root has depth 0. */
  depths: number[];
  /** Index into the arrays above, by row id. */
  indexById: Map<string, number>;
  /** Distance in px from the top of the scroll content to the bottom of each row's subtree. */
  subtreeBottoms: Map<string, number>;
}

/** Walk the expanded tree and record the geometry of every visible row. */
export function flattenRows(tree: IndexTree, expanded: Set<string>): FlatRows {
  const ids: string[] = [];
  const sectionStartIds = new Set<string>();
  const offsets: number[] = [];
  const depths: number[] = [];
  const indexById = new Map<string, number>();
  const subtreeBottoms = new Map<string, number>();
  let y = 0;
  let prevLevel1 = true;

  const walk = (entries: TreeEntry[], level: number) => {
    for (const entry of entries) {
      const isLevel1 = level === 1;
      const hasGap = isLevel1 && ids.length > 0 && !prevLevel1;
      if (hasGap) {
        sectionStartIds.add(entry.id);
      }
      indexById.set(entry.id, ids.length);
      ids.push(entry.id);
      depths.push(level - 1);
      offsets.push(y + (hasGap ? SECTION_GAP : 0));
      y += TREE_ROW_HEIGHT + (hasGap ? SECTION_GAP : 0);
      prevLevel1 = isLevel1;
      if (entry.resolvedChildren?.length && expanded.has(entry.id)) {
        walk(entry.resolvedChildren, level + 1);
      }
      subtreeBottoms.set(entry.id, y);
    }
  };

  walk(tree, 1);
  return { ids, sectionStartIds, offsets, depths, indexById, subtreeBottoms };
}

/**
 * Index of the first row whose bottom edge is below `y`. Returns `ids.length` when `y` is past the
 * last row. Rows are ordered by offset, so a binary search keeps this independent of tree size.
 */
export function findFirstRowBelow({ ids, offsets }: FlatRows, y: number): number {
  let low = 0;
  let high = ids.length - 1;
  let found = ids.length;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const bottom = mid + 1 < ids.length ? offsets[mid + 1] : offsets[mid] + TREE_ROW_HEIGHT;
    if (bottom <= y) {
      low = mid + 1;
    } else {
      found = mid;
      high = mid - 1;
    }
  }
  return found;
}
