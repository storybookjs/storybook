// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import type { IndexHash } from 'storybook/manager-api';

import { getStickyRowIds } from './TreeStickyRows.tsx';
import { TREE_ROW_HEIGHT, type FlatRows } from './treeGeometry.ts';

/**
 * A root with two groups, each holding two stories:
 *
 * ```text
 * root      depth 0   y 0
 *   groupA  depth 1   y 28
 *     a1    depth 2   y 56
 *     a2    depth 2   y 84
 *   groupB  depth 1   y 112
 *     b1    depth 2   y 140
 *     b2    depth 2   y 168
 * ```
 */
const order = ['root', 'groupA', 'a1', 'a2', 'groupB', 'b1', 'b2'];
const depthOf: Record<string, number> = {
  root: 0,
  groupA: 1,
  a1: 2,
  a2: 2,
  groupB: 1,
  b1: 2,
  b2: 2,
};
const parentOf: Record<string, string | undefined> = {
  root: undefined,
  groupA: 'root',
  a1: 'groupA',
  a2: 'groupA',
  groupB: 'root',
  b1: 'groupB',
  b2: 'groupB',
};
/** The y just past the last row of each subtree. */
const subtreeBottomOf: Record<string, number> = {
  root: 196,
  groupA: 112,
  a1: 84,
  a2: 112,
  groupB: 196,
  b1: 168,
  b2: 196,
};

const rows: FlatRows = {
  ids: order,
  sectionStartIds: new Set(),
  offsets: order.map((_, index) => index * TREE_ROW_HEIGHT),
  depths: order.map((id) => depthOf[id]),
  indexById: new Map(order.map((id, index) => [id, index])),
  subtreeBottoms: new Map(Object.entries(subtreeBottomOf)),
};

const data = Object.fromEntries(
  order.map((id) => [id, { id, parent: parentOf[id], type: 'group', name: id, depth: depthOf[id] }])
) as unknown as IndexHash;

/** Where a row is drawn, measured from the top of the visible area. */
const rowTop = (id: string, scrollTop: number) => {
  const slot = getStickyRowIds(rows, data, scrollTop).indexOf(id);
  return slot >= 0 ? slot * TREE_ROW_HEIGHT : rows.offsets[rows.indexById.get(id)!] - scrollTop;
};

describe('getStickyRowIds', () => {
  it('holds no row at the top of the tree', () => {
    expect(getStickyRowIds(rows, data, 0)).toEqual([]);
  });

  it('gives a row the slot at its own depth', () => {
    expect(getStickyRowIds(rows, data, 1)).toEqual(['root', 'groupA']);
  });

  it('takes a container before the scroll reaches the container itself', () => {
    // groupA sits 28px down, and it holds the second slot, which is also 28px down. It is sticky
    // as soon as the tree scrolls at all, rather than once 28px have gone past.
    expect(getStickyRowIds(rows, data, 1)).toContain('groupA');
  });

  it('never moves a container as it becomes sticky', () => {
    for (const id of ['root', 'groupA', 'groupB']) {
      let previous = rowTop(id, 0);
      for (let scrollTop = 1; scrollTop <= 196; scrollTop += 1) {
        const current = rowTop(id, scrollTop);
        // The row either holds still or follows the scroll, one pixel at a time. A jump would mean
        // the sticky copy appeared somewhere other than where the row already was.
        //
        // Rows that have left the top edge are not compared: a row hands its slot to the next
        // section from above that edge, where nothing of it is on screen.
        const onScreen = current > -TREE_ROW_HEIGHT && previous > -TREE_ROW_HEIGHT;
        if (onScreen) {
          expect(Math.abs(current - previous)).toBeLessThanOrEqual(1);
        }
        previous = current;
      }
    }
  });

  it('hands the slot to the next section instead of covering its header', () => {
    // groupA keeps the second slot while its own rows are still below it...
    expect(getStickyRowIds(rows, data, 29)).toEqual(['root', 'groupA']);
    // ...and lets go as groupB's header reaches the slot.
    expect(getStickyRowIds(rows, data, 57)).toEqual(['root']);
  });

  it('never holds a leaf', () => {
    for (let scrollTop = 0; scrollTop <= 196; scrollTop += 1) {
      const sticky = getStickyRowIds(rows, data, scrollTop);
      expect(sticky.filter((id) => ['a1', 'a2', 'b1', 'b2'].includes(id))).toEqual([]);
    }
  });

  it('keeps the rows in depth order with no gap', () => {
    for (let scrollTop = 0; scrollTop <= 196; scrollTop += 1) {
      const sticky = getStickyRowIds(rows, data, scrollTop);
      expect(sticky.map((id) => depthOf[id])).toEqual(sticky.map((_, index) => index));
    }
  });
});
