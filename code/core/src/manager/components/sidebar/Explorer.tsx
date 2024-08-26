import type { FC } from 'react';
import React, { useRef } from 'react';

import { HighlightStyles } from './HighlightStyles';
import { Ref } from './Refs';
import type { CombinedDataset, Selection } from './types';
import { useHighlighted } from './useHighlighted';

export interface ExplorerProps {
  isLoading: boolean;
  isBrowsing: boolean;
  dataset: CombinedDataset;
  selected: Selection;
}

export const Explorer: FC<ExplorerProps> = React.memo(function Explorer({
  isLoading,
  isBrowsing,
  dataset,
  selected,
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track highlighted nodes, keep it in sync with props and enable keyboard navigation
  const [highlighted, setHighlighted, highlightedRef] = useHighlighted({
    // @ts-expect-error (non strict)
    containerRef,
    isLoading,
    isBrowsing,
    dataset,
    selected,
  });

  return (
    <div
      ref={containerRef}
      id="storybook-explorer-tree"
      data-highlighted-ref-id={highlighted?.refId}
      data-highlighted-item-id={highlighted?.itemId}
    >
      {highlighted && <HighlightStyles {...highlighted} />}
      {dataset.entries.map(([refId, ref]) => (
        <Ref
          {...ref}
          key={refId}
          isLoading={isLoading}
          isBrowsing={isBrowsing}
          selectedStoryId={selected?.refId === ref.id ? selected.storyId : null}
          highlightedRef={highlightedRef}
          setHighlighted={setHighlighted}
        />
      ))}
    </div>
  );
});
