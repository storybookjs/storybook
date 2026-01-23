import type { FC } from 'react';
import React, { useRef } from 'react';

import { TreeView } from '@primer/react';

// import { HighlightStyles } from './HighlightStyles';
// import { Ref } from './Refs';
import type { CombinedDataset, Selection } from './types';

// import { useHighlighted } from './useHighlighted';

export interface ExplorerProps {
  isLoading: boolean;
  isBrowsing: boolean;
  isDevelopment: boolean;
  hasEntries: boolean;
  dataset: CombinedDataset;
  selected: Selection;
}

export const Explorer: FC<ExplorerProps> = React.memo(function Explorer({
  hasEntries,
  isLoading,
  isBrowsing,
  isDevelopment,
  dataset,
  selected,
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track highlighted nodes, keep it in sync with props and enable keyboard navigation
  // const [highlighted, setHighlighted, highlightedRef] = useHighlighted({
  //   containerRef,
  //   isLoading,
  //   isBrowsing,
  //   selected,
  // });

  return (
    <div
      ref={containerRef}
      id="storybook-explorer-tree"
      // data-highlighted-ref-id={highlighted?.refId}
      // data-highlighted-item-id={highlighted?.itemId}
    >
      {/* {highlighted && <HighlightStyles {...highlighted} />} */}

      <TreeView aria-label="Files changed">
        <TreeView.Item id="parent-node-one" defaultExpanded>
          Parent node
          <TreeView.SubTree>
            <TreeView.Item id="child-node-one">Child node one</TreeView.Item>
            <TreeView.Item id="child-node-two" current>
              Child node two
            </TreeView.Item>
          </TreeView.SubTree>
        </TreeView.Item>
        <TreeView.Item id="sibling-node-one">Sibling node one</TreeView.Item>
        <TreeView.Item id="sibling-node-two">Sibling node two</TreeView.Item>
      </TreeView>
      {/* {dataset.entries.map(([refId, ref]) => (
        <Ref
          {...ref}
          key={refId}
          isLoading={isLoading}
          isBrowsing={isBrowsing}
          isDevelopment={isDevelopment}
          hasEntries={hasEntries}
          selectedStoryId={selected?.refId === ref.id ? selected.storyId : null}
          highlightedRef={highlightedRef}
          setHighlighted={setHighlighted}
        />
      ))} */}
    </div>
  );
});
