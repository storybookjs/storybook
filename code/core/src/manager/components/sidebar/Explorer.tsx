import type { FC } from 'react';
import React, { useRef } from 'react';

import { global } from '@storybook/global';

import { ChecklistModule } from './ChecklistModule';
import { HighlightStyles } from './HighlightStyles';
import { Ref } from './Refs';
import type { CombinedDataset, Selection } from './types';
import { useHighlighted } from './useHighlighted';

export interface ExplorerProps {
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
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track highlighted nodes, keep it in sync with props and enable keyboard navigation
  const [highlighted, setHighlighted, highlightedRef] = useHighlighted({
    containerRef,
    isLoading,
    isBrowsing,
    selected,
  });

  return (
    <div
      ref={containerRef}
      id="storybook-explorer-tree"
      data-highlighted-ref-id={highlighted?.refId}
      data-highlighted-item-id={highlighted?.itemId}
    >
      {global.CONFIG_TYPE === 'DEVELOPMENT' && <ChecklistModule />}
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
    </div>
  );
});
