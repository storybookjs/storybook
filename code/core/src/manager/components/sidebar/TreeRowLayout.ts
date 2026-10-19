import type { Key, Node } from '@react-types/shared';

import { Layout, LayoutInfo, Rect, Size } from 'react-aria-components/Virtualizer';

import {
  SECTION_GAP,
  TREE_ROW_HEIGHT,
  findFirstRowBelow,
  flattenRows,
  type FlatRows,
} from './treeGeometry.ts';

export interface TreeRowLayoutOptions {
  rows?: FlatRows;
}

const EMPTY_ROWS: FlatRows = flattenRows([], new Set());

/**
 * Places the tree's rows exactly where the tree's row geometry puts them.
 *
 * A measuring layout estimates rows it has not materialized, so its reported content height and
 * the absolute position of everything below an unmaterialized section drift from that geometry by
 * the section gap — the tree then under-reports its height and the next sidebar block overlaps its
 * rows. This layout derives every position and the content size from `flattenRows`, the same
 * geometry that drives the sticky rows and scroll targeting, so they cannot disagree.
 */
export class TreeRowLayout extends Layout<Node<object>, TreeRowLayoutOptions> {
  private rows: FlatRows = EMPTY_ROWS;
  private cache = new Map<string, LayoutInfo>();
  private cachedWidth = 0;

  /**
   * Also set directly during render, so even the very first layout build uses the real geometry;
   * `layoutOptions` carries the same object to invalidate the virtualizer on change.
   */
  setRows(rows: FlatRows) {
    if (this.rows !== rows) {
      this.rows = rows;
      this.cache.clear();
    }
  }

  update(invalidationContext: Parameters<Layout<Node<object>, TreeRowLayoutOptions>['update']>[0]) {
    if (invalidationContext.layoutOptions?.rows) {
      this.setRows(invalidationContext.layoutOptions.rows);
    }
    const width = this.virtualizer?.visibleRect.width ?? 0;
    if (width !== this.cachedWidth) {
      this.cachedWidth = width;
      this.cache.clear();
    }
  }

  shouldInvalidateLayoutOptions(
    newOptions: TreeRowLayoutOptions,
    oldOptions: TreeRowLayoutOptions
  ) {
    return newOptions.rows !== oldOptions.rows;
  }

  private layoutInfoAt(index: number): LayoutInfo {
    const { ids, offsets, sectionStartIds } = this.rows;
    const id = ids[index];
    let info = this.cache.get(id);
    if (!info) {
      // The section gap is part of the row's box, above its content, matching the row's CSS.
      const gap = sectionStartIds.has(id) ? SECTION_GAP : 0;
      const rect = new Rect(0, offsets[index] - gap, this.cachedWidth, TREE_ROW_HEIGHT + gap);
      info = new LayoutInfo('item', id, rect);
      this.cache.set(id, info);
    }
    return info;
  }

  getVisibleLayoutInfos(rect: Rect) {
    const { ids, offsets, indexById } = this.rows;
    const infos: LayoutInfo[] = [];
    const first = findFirstRowBelow(this.rows, rect.y);
    let last = first;
    for (; last < ids.length && offsets[last] - SECTION_GAP < rect.maxY; last += 1) {
      infos.push(this.layoutInfoAt(last));
    }
    // Keep the persisted rows mounted wherever the viewport is. React-aria persists the row that
    // holds the roving tabindex, so that a Tab back into the tree can land on it after the scroll
    // position moved on (a Tab to the next block scrolls the row away). The virtualizer leaves
    // this to the layout.
    for (const key of this.virtualizer?.persistedKeys ?? []) {
      const index = indexById.get(String(key));
      if (index !== undefined && (index < first || index >= last)) {
        infos.push(this.layoutInfoAt(index));
      }
    }
    return infos;
  }

  getLayoutInfo(key: Key) {
    const index = this.rows.indexById.get(String(key));
    return index === undefined ? null : this.layoutInfoAt(index);
  }

  getContentSize() {
    const { ids, offsets } = this.rows;
    const height = ids.length > 0 ? offsets[ids.length - 1] + TREE_ROW_HEIGHT : 0;
    return new Size(this.cachedWidth, height);
  }
}
