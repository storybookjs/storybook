import type { Node } from '@react-types/shared';

import { ListLayout, type ListLayoutOptions } from 'react-aria-components/Virtualizer';

import { SECTION_GAP, TREE_ROW_HEIGHT } from './treeGeometry.ts';

export interface TreeRowLayoutOptions extends ListLayoutOptions {
  /** Rows that start a top-level section and carry the section gap as padding. */
  sectionStartIds?: ReadonlySet<string>;
}

/**
 * Lays the tree's rows out at the model's exact heights instead of measuring them.
 *
 * With estimated heights, rows the user has never scrolled past sit at the estimate until they
 * render once, so after a deep link the DOM disagrees with `flattenRows` by the section gap for
 * every unmeasured section. Every consumer of the model — the sticky rows, the indent lines,
 * scroll targeting — would inherit that drift. Row heights are deterministic, so the layout takes
 * them from the same rule as the model and ignores DOM measurements; a row that violates the
 * fixed height shows up as visible overlap instead of silently shifting everything below it.
 */
export class TreeRowLayout extends ListLayout<object, TreeRowLayoutOptions> {
  private sectionStartIds: ReadonlySet<string> = new Set();

  constructor() {
    super({ rowHeight: TREE_ROW_HEIGHT });
  }

  /**
   * Also set directly during render, so even the very first layout build uses the real section
   * starts and the tree's reported height never under-counts — a following block would otherwise
   * overlap the tree's rows. `layoutOptions` still carries the set, to invalidate on change.
   */
  setSectionStartIds(ids: ReadonlySet<string>) {
    this.sectionStartIds = ids;
  }

  update(invalidationContext: Parameters<ListLayout<object, TreeRowLayoutOptions>['update']>[0]) {
    this.sectionStartIds =
      invalidationContext.layoutOptions?.sectionStartIds ?? this.sectionStartIds;
    super.update(invalidationContext);
  }

  shouldInvalidateLayoutOptions(
    newOptions: TreeRowLayoutOptions,
    oldOptions: TreeRowLayoutOptions
  ) {
    return (
      newOptions.sectionStartIds !== oldOptions.sectionStartIds ||
      super.shouldInvalidateLayoutOptions(newOptions, oldOptions)
    );
  }

  protected buildItem(node: Node<object>, x: number, y: number) {
    const layoutNode = super.buildItem(node, x, y);
    if (this.sectionStartIds.has(String(node.key))) {
      layoutNode.layoutInfo.rect.height = TREE_ROW_HEIGHT + SECTION_GAP;
      layoutNode.validRect = layoutNode.layoutInfo.rect.intersection(this.requestedRect);
    }
    return layoutNode;
  }

  updateItemSize() {
    return false;
  }
}
