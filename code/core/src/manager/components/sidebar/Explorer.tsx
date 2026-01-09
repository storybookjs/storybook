import type { FC } from 'react';
import React, { useRef } from 'react';

import { useLandmark } from '../../hooks/useLandmark';
import { HighlightStyles } from './HighlightStyles';
import { Ref } from './Refs';
import type { CombinedDataset, Selection } from './types';
import { useHighlighted } from './useHighlighted';

export interface ExplorerProps {
  className?: string;
  isLoading: boolean;
  isBrowsing: boolean;
  hasEntries: boolean;
  dataset: CombinedDataset;
  selected: Selection;
}

export const Explorer: FC<ExplorerProps> = React.memo(function Explorer({
  hasEntries,
  isLoading,
  isBrowsing,
  dataset,
  selected,
  ...restProps
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track highlighted nodes, keep it in sync with props and enable keyboard navigation
  const [highlighted, setHighlighted, highlightedRef] = useHighlighted({
    containerRef,
    isLoading,
    isBrowsing,
    selected,
  });

  const { landmarkProps } = useLandmark(
    {
      'aria-labelledby': 'storybook-explorer-tree-heading',
      role: 'navigation',
    },
    containerRef
  );

  return (
    <nav
      ref={containerRef}
      id="storybook-explorer-tree"
      data-highlighted-ref-id={highlighted?.refId}
      data-highlighted-item-id={highlighted?.itemId}
      {...landmarkProps}
      {...restProps}
    >
      <h2 id="storybook-explorer-tree-heading" className="sb-sr-only">
        Stories
      </h2>
      {highlighted && <HighlightStyles {...highlighted} />}
      {dataset.entries.map(([refId, ref]) => (
        <Ref
          {...ref}
          key={refId}
          isLoading={isLoading}
          isBrowsing={isBrowsing}
          hasEntries={hasEntries}
          selectedStoryId={selected?.refId === ref.id ? selected.storyId : null}
          highlightedRef={highlightedRef}
          setHighlighted={setHighlighted}
        />
      ))}
    </nav>
  );
});
